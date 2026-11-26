#![deny(unsafe_code)] // our code has none; napi macros opt in locally

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use htmd::element_handler::{Context, ContextKind, Handlers};
use htmd::Element;

/// Tags whose *content* ammonia always removes. Allowing them would let code run,
/// and ammonia panics on that config, so we reject it up front.
const CODE_TAGS: [&str; 2] = ["script", "style"];
const CODE_SCHEMES: [&str; 2] = ["javascript", "vbscript"];

/// Sanitize untrusted HTML. Every option replaces ammonia's default list when given.
///
/// - `tags`: allowed tag names.
/// - `attributes`: allowed attributes as `"tag attr"` pairs; tag `*` means any tag.
/// - `schemes`: allowed URL schemes for `href`/`src`.
///
/// Returns `Err` for options that would make the output unsafe, never panics.
pub fn sanitize(
  html: &str,
  tags: Option<Vec<String>>,
  attributes: Option<Vec<String>>,
  schemes: Option<Vec<String>>,
) -> Result<String, String> {
  if tags.is_none() && attributes.is_none() && schemes.is_none() {
    return Ok(ammonia::clean(html));
  }
  let lower = |v: Vec<String>| v.into_iter().map(|s| s.trim().to_ascii_lowercase()).collect::<Vec<_>>();
  let tags = tags.map(lower);
  let schemes = schemes.map(lower);
  let pairs = attributes
    .map(lower)
    .map(|v| {
      v.iter()
        .map(|p| match p.split_once(' ') {
          Some((t, a)) if !t.is_empty() && !a.trim().is_empty() => Ok((t.to_string(), a.trim().to_string())),
          _ => Err(format!("Invalid attribute rule `{p}`.")),
        })
        .collect::<Result<Vec<_>, _>>()
    })
    .transpose()?;

  for t in tags.iter().flatten() {
    if CODE_TAGS.contains(&t.as_str()) {
      return Err(format!("`{t}` can't be allowed: it runs code."));
    }
  }
  for (t, a) in pairs.iter().flatten() {
    if CODE_TAGS.contains(&t.as_str()) {
      return Err(format!("Attributes on `{t}` can't be allowed: it runs code."));
    }
    if a.starts_with("on") {
      return Err(format!("`{a}` can't be allowed: event handler attributes run code."));
    }
  }
  for s in schemes.iter().flatten() {
    if CODE_SCHEMES.contains(&s.as_str()) {
      return Err(format!("`{s}:` URLs can't be allowed: they run code."));
    }
  }

  let mut b = ammonia::Builder::default();
  if let Some(tags) = &tags {
    b.tags(tags.iter().map(String::as_str).collect());
  }
  if let Some(pairs) = &pairs {
    let mut generic = HashSet::new();
    let mut per_tag: HashMap<&str, HashSet<&str>> = HashMap::new();
    for (t, a) in pairs {
      if t == "*" {
        generic.insert(a.as_str());
      } else {
        per_tag.entry(t.as_str()).or_default().insert(a.as_str());
      }
    }
    if generic.contains("rel") || per_tag.get("a").is_some_and(|a| a.contains("rel")) {
      b.link_rel(None); // the caller manages rel themselves
    }
    b.generic_attributes(generic).tag_attributes(per_tag);
  }
  if let Some(schemes) = &schemes {
    b.url_schemes(schemes.iter().map(String::as_str).collect());
  }
  Ok(b.clean(html).to_string())
}

/// Convert HTML to Markdown. Scripts, styles, SVG and other non-content tags are dropped.
pub fn to_markdown(html: &str) -> Result<String, String> {
  static CONVERTER: LazyLock<htmd::HtmlToMarkdown> = LazyLock::new(|| {
    htmd::HtmlToMarkdown::builder()
      .skip_tags(vec!["script", "style", "noscript", "template", "iframe", "head", "svg"])
      .options(htmd::options::Options {
        bullet_list_marker: htmd::options::BulletListMarker::Dash,
        ul_bullet_spacing: 1,
        ..Default::default()
      })
      .add_handler(vec!["del", "s", "strike"], strikethrough)
      .build()
  });
  CONVERTER.convert(html).map(|md| collapse_encoded_newlines(&md)).map_err(|e| e.to_string())
}

/// `<del>old</del>` → `~~old~~` (GitHub Flavored Markdown).
fn strikethrough(handlers: &dyn Handlers, el: &Element) -> Option<htmd::element_handler::HandlerResult> {
  let content = handlers.walk_children_content(el.node, Context { kind: ContextKind::Inline, ..el.context });
  let inner = content.trim();
  if inner.is_empty() {
    return Some(content.into());
  }
  // Keep surrounding whitespace outside the markers: `~~ a ~~` is not valid GFM.
  let lead = &content[..content.len() - content.trim_start().len()];
  let trail = &content[content.trim_end().len()..];
  Some(format!("{lead}~~{inner}~~{trail}").into())
}

/// htmd writes line breaks inside link text as `&#10;` so the link stays valid.
/// A single space reads better for people and LLMs: `[Title Desc](/x)`.
// ponytail: also rewrites a literal "&#10;" inside a code block; add a custom `a` handler if that ever matters.
fn collapse_encoded_newlines(md: &str) -> String {
  const NL: [&str; 2] = ["&#10;", "&#13;"];
  if !NL.iter().any(|e| md.contains(e)) {
    return md.to_string();
  }
  let mut out = String::with_capacity(md.len());
  let mut rest = md;
  while let Some((i, len)) = NL.iter().filter_map(|e| rest.find(e).map(|i| (i, e.len()))).min() {
    out.push_str(&rest[..i]);
    rest = &rest[i + len..];
    // Swallow the rest of the run: more encoded newlines and spaces.
    loop {
      let t = rest.trim_start_matches(' ');
      match NL.iter().find_map(|e| t.strip_prefix(*e)) {
        Some(after) => rest = after,
        None => {
          rest = t;
          break;
        }
      }
    }
    out.truncate(out.trim_end_matches(' ').len());
    if !out.ends_with('[') && !rest.starts_with(']') {
      out.push(' ');
    }
  }
  out.push_str(rest);
  out
}

// Both bindings expose the same raw, positional API; lib/wrap.js turns it into the public one.

#[cfg(feature = "napi")]
mod node {
  use napi_derive::napi;

  #[napi]
  pub fn sanitize_raw(
    html: String,
    tags: Option<Vec<String>>,
    attributes: Option<Vec<String>>,
    schemes: Option<Vec<String>>,
  ) -> napi::Result<String> {
    super::sanitize(&html, tags, attributes, schemes).map_err(napi::Error::from_reason)
  }

  #[napi]
  pub fn to_markdown(html: String) -> napi::Result<String> {
    super::to_markdown(&html).map_err(napi::Error::from_reason)
  }
}

#[cfg(feature = "wasm")]
mod web {
  use wasm_bindgen::prelude::*;

  #[wasm_bindgen(js_name = sanitizeRaw)]
  pub fn sanitize_raw(
    html: &str,
    tags: Option<Vec<String>>,
    attributes: Option<Vec<String>>,
    schemes: Option<Vec<String>>,
  ) -> Result<String, JsError> {
    super::sanitize(html, tags, attributes, schemes).map_err(|e| JsError::new(&e))
  }

  #[wasm_bindgen(js_name = toMarkdown)]
  pub fn to_markdown(html: &str) -> Result<String, JsError> {
    super::to_markdown(html).map_err(|e| JsError::new(&e))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn s(v: &[&str]) -> Option<Vec<String>> {
    Some(v.iter().map(|x| x.to_string()).collect())
  }

  #[test]
  fn strips_xss() {
    let out = sanitize(r#"<p onclick="x()">hi<script>alert(1)</script><a href="javascript:alert(1)">l</a><img src=x onerror=alert(1)></p>"#, None, None, None).unwrap();
    assert!(!out.contains("script") && !out.contains("onclick") && !out.contains("onerror") && !out.contains("javascript:"), "{out}");
    assert!(out.contains("<p>hi"));
  }

  #[test]
  fn custom_tags() {
    assert_eq!(sanitize("<b>a</b><i>b</i>", s(&["b"]), None, None).unwrap(), "<b>a</b>b");
  }

  #[test]
  fn custom_attributes_and_schemes() {
    let html = r#"<a href="https://x.y" class="c" title="t">l</a><a href="mailto:a@b">m</a>"#;
    let out = sanitize(html, None, s(&["a href", "* class"]), s(&["https"])).unwrap();
    assert!(out.contains(r#"href="https://x.y""#) && out.contains(r#"class="c""#) && !out.contains("title"), "{out}");
    assert!(!out.contains("mailto"), "{out}");
  }

  #[test]
  fn unsafe_options_are_errors_not_panics() {
    assert!(sanitize("x", s(&["script"]), None, None).is_err());
    assert!(sanitize("x", s(&["STYLE"]), None, None).is_err());
    assert!(sanitize("x", None, s(&["a onclick"]), None).is_err());
    assert!(sanitize("x", None, s(&["script src"]), None).is_err());
    assert!(sanitize("x", None, s(&["nospace"]), None).is_err());
    assert!(sanitize("x", None, None, s(&["javascript"])).is_err());
    assert!(sanitize("x", None, s(&["a rel"]), None).is_ok());
  }

  #[test]
  fn link_with_block_content_reads_cleanly() {
    assert_eq!(to_markdown(r#"<a href="/post"><div>Title</div><p>Short description</p></a>"#).unwrap(), "[Title Short description](/post)");
    assert_eq!(to_markdown(r#"<a href="/"><svg><title>logo</title></svg> MDN </a>"#).unwrap(), "[ MDN ](/)");
    assert_eq!(collapse_encoded_newlines("no entities"), "no entities");
  }

  #[test]
  fn strikethrough_gfm() {
    assert_eq!(to_markdown("<p><del>old</del> new <s> x </s>y</p>").unwrap(), "~~old~~ new ~~x~~ y");
  }

  #[test]
  fn markdown() {
    let md = to_markdown("<h1>T</h1><p>a <strong>b</strong> <a href=\"https://x.y\">c</a></p><script>bad()</script><ul><li>one</li></ul>").unwrap();
    assert!(md.contains("# T") && md.contains("**b**") && md.contains("[c](https://x.y)") && md.contains("one"), "{md}");
    assert!(!md.contains("bad()"), "{md}");
  }
}
