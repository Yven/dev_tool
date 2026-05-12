use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};
use serde::Serialize;

const RFC3986: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'~');

#[derive(Serialize)]
pub struct UrlResult {
    output: String,
    line_count: usize,
}

#[tauri::command]
pub fn cmd_url_encode(input: &str, _safe_chars: Option<String>) -> Result<UrlResult, String> {
    let lines: Vec<&str> = input.split('\n').collect();
    let encoded: Vec<String> = lines
        .iter()
        .map(|line| utf8_percent_encode(line.trim_end_matches('\r'), RFC3986).to_string())
        .collect();

    Ok(UrlResult {
        output: encoded.join("\n"),
        line_count: lines.len(),
    })
}

#[tauri::command]
pub fn cmd_url_decode(input: &str) -> Result<UrlResult, String> {
    let lines: Vec<&str> = input.split('\n').collect();
    let decoded: Vec<String> = lines
        .iter()
        .map(|line| {
            percent_encoding::percent_decode_str(line.trim_end_matches('\r'))
                .decode_utf8_lossy()
                .to_string()
        })
        .collect();

    Ok(UrlResult {
        output: decoded.join("\n"),
        line_count: lines.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_rfc3986() {
        let r = cmd_url_encode("a b/中文", None).unwrap();
        assert_eq!(r.output, "a%20b%2F%E4%B8%AD%E6%96%87");
        assert_eq!(r.line_count, 1);
    }

    #[test]
    fn decode_multiline() {
        let r = cmd_url_decode("a%20b\n%E4%B8%AD%E6%96%87").unwrap();
        assert_eq!(r.output, "a b\n中文");
        assert_eq!(r.line_count, 2);
    }
}
