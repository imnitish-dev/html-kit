#![deny(unsafe_code)] // our code has none; napi macros opt in locally

use std::collections::HashSet;
use std::sync::LazyLock;

/// Remove anything that can run script or break out of the page (XSS-safe by default).
/// `allowed_tags` replaces the default tag allowlist when given.
pub fn sanitize(html: &str, allowed_tags: Option<Vec<String>>) -> String {
  match allowed_tags {
    None => ammonia::clean(html),
    Some(tags) => {
      let tags: HashSet<&str> = tags.iter().map(String::as_str).collect();
      ammonia::Builder::default().tags(tags).clean(html).to_string()
    }
  }
}

/// Convert HTML to Markdown. Scripts, styles and other non-content tags are dropped.
pub fn to_markdown(html: &str) -> Result<String, String> {
  static CONVERTER: LazyLock<htmd::HtmlToMarkdown> = LazyLock::new(|| {
    htmd::HtmlToMarkdown::builder()
      .skip_tags(vec!["script", "style", "noscript", "template", "iframe", "head", "svg"])
      .options(htmd::options::Options {
        bullet_list_marker: htmd::options::BulletListMarker::Dash,
        ul_bullet_spacing: 1,
        ..Default::default()
      })
      .build()
  });
  CONVERTER.convert(html).map(|md| collapse_encoded_newlines(&md)).map_err(|e| e.to_string())
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

#[cfg(feature = "napi")]
mod node {
  use napi_derive::napi;

  #[napi(object)]
  pub struct SanitizeOptions {
    pub allowed_tags: Option<Vec<String>>,
  }

  #[napi]
  pub fn sanitize(html: String, options: Option<SanitizeOptions>) -> String {
    super::sanitize(&html, options.and_then(|o| o.allowed_tags))
  }

  #[napi]
  pub fn to_markdown(html: String) -> napi::Result<String> {
    super::to_markdown(&html).map_err(napi::Error::from_reason)
  }
}

#[cfg(feature = "wasm")]
mod web {
  use wasm_bindgen::prelude::*;

  #[wasm_bindgen]
  pub fn sanitize(html: &str, allowed_tags: Option<Vec<String>>) -> String {
    super::sanitize(html, allowed_tags)
  }

  #[wasm_bindgen(js_name = toMarkdown)]
  pub fn to_markdown(html: &str) -> Result<String, JsError> {
    super::to_markdown(html).map_err(|e| JsError::new(&e))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn strips_xss() {
    let out = sanitize(r#"<p onclick="x()">hi<script>alert(1)</script><a href="javascript:alert(1)">l</a><img src=x onerror=alert(1)></p>"#, None);
    assert!(!out.contains("script") && !out.contains("onclick") && !out.contains("onerror") && !out.contains("javascript:"), "{out}");
    assert!(out.contains("<p>hi"));
  }

  #[test]
  fn custom_tags() {
    assert_eq!(sanitize("<b>a</b><i>b</i>", Some(vec!["b".into()])), "<b>a</b>b");
  }

  #[test]
  fn link_with_block_content_reads_cleanly() {
    assert_eq!(to_markdown(r#"<a href="/post"><div>Title</div><p>Short description</p></a>"#).unwrap(), "[Title Short description](/post)");
    assert_eq!(to_markdown(r#"<a href="/"><svg><title>logo</title></svg> MDN </a>"#).unwrap(), "[ MDN ](/)");
    assert_eq!(collapse_encoded_newlines("no entities"), "no entities");
  }

  #[test]
  fn markdown() {
    let md = to_markdown("<h1>T</h1><p>a <strong>b</strong> <a href=\"https://x.y\">c</a></p><script>bad()</script><ul><li>one</li></ul>").unwrap();
    assert!(md.contains("# T") && md.contains("**b**") && md.contains("[c](https://x.y)") && md.contains("one"), "{md}");
    assert!(!md.contains("bad()"), "{md}");
  }
}
