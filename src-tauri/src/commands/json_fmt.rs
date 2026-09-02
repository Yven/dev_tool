use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
pub struct JsonResult {
    output: String,
    error_line: Option<usize>,
    error_msg: Option<String>,
    /// 非 None 表示输入被自动识别为 URL 参数串并已完成转换，值为转换来源标识（如 "query"）
    converted_from: Option<String>,
}

#[tauri::command]
pub fn cmd_json_format(
    input: &str,
    indent: u32,
    sort_keys: bool,
    escape_unicode: bool,
    compress: Option<bool>,
) -> Result<JsonResult, String> {
    // 自动识别：先按 JSON 解析，失败则尝试按 URL 参数串（如 game=lyj&time=...）解析
    let mut converted_from: Option<String> = None;

    let mut value: Value = match serde_json::from_str(input) {
        Ok(v) => v,
        Err(json_err) => match parse_query_string(input) {
            Some(v) => {
                converted_from = Some("query".to_string());
                v
            }
            None => {
                return Ok(JsonResult {
                    output: String::new(),
                    error_line: Some(json_err.line()),
                    error_msg: Some(json_err.to_string()),
                    converted_from: None,
                });
            }
        },
    };

    if sort_keys {
        sort_json_object(&mut value);
    }

    let output = if compress.unwrap_or(false) {
        serde_json::to_string(&value).map_err(|e| e.to_string())?
    } else {
        let spaces = indent.max(1).min(8) as usize;
        let indent_bytes = vec![b' '; spaces];
        let formatter = serde_json::ser::PrettyFormatter::with_indent(&indent_bytes);
        let mut buf = Vec::new();
        let mut serializer = serde_json::Serializer::with_formatter(&mut buf, formatter);
        value
            .serialize(&mut serializer)
            .map_err(|e| e.to_string())?;
        String::from_utf8(buf).map_err(|e| e.to_string())?
    };

    let final_output = if escape_unicode {
        escape_unicode_chars(&output)
    } else {
        output
    };

    Ok(JsonResult {
        output: final_output,
        error_line: None,
        error_msg: None,
        converted_from,
    })
}

/// 将 URL 参数串（可含完整 URL）解析为 JSON 对象，所有值保持为字符串，重复 key 后者覆盖前者。
/// 无法识别为参数串时返回 None。
fn parse_query_string(input: &str) -> Option<Value> {
    // 兼容完整 URL：提取首个 '?' 之后的参数部分
    let query = match input.find('?') {
        Some(pos) => &input[pos + 1..],
        None => input,
    };
    let query = query.trim();
    if query.is_empty() {
        return None;
    }

    let mut map = serde_json::Map::new();
    let mut has_pair = false;

    for pair in query.split('&') {
        if pair.is_empty() {
            continue;
        }
        // 不含 '=' 的片段视为非参数串，放弃转换（回落到 JSON 错误）
        let (k, v) = pair.split_once('=')?;
        has_pair = true;
        let key = percent_encoding::percent_decode_str(k)
            .decode_utf8_lossy()
            .to_string();
        let val = percent_encoding::percent_decode_str(v)
            .decode_utf8_lossy()
            .to_string();
        map.insert(key, Value::String(val));
    }

    if has_pair {
        Some(Value::Object(map))
    } else {
        None
    }
}

fn sort_json_object(v: &mut Value) {
    match v {
        Value::Object(map) => {
            let mut keys: Vec<String> = map.keys().cloned().collect();
            keys.sort();
            let mut sorted = serde_json::Map::new();
            for key in keys {
                if let Some(mut child) = map.remove(&key) {
                    sort_json_object(&mut child);
                    sorted.insert(key, child);
                }
            }
            *map = sorted;
        }
        Value::Array(arr) => {
            for item in arr.iter_mut() {
                sort_json_object(item);
            }
        }
        _ => {}
    }
}

fn escape_unicode_chars(s: &str) -> String {
    s.chars()
        .map(|ch| {
            if ch as u32 > 127 {
                format!("\\u{:04x}", ch as u32)
            } else {
                ch.to_string()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_pretty_json() {
        let r = cmd_json_format(r#"{"b":1,"a":"中"}"#, 2, false, false, Some(false)).unwrap();
        assert!(r.error_msg.is_none());
        assert!(r.output.contains("\n  \"b\": 1"));
    }

    #[test]
    fn sort_and_escape_unicode() {
        let r = cmd_json_format(r#"{"b":1,"a":"中"}"#, 2, true, true, Some(false)).unwrap();
        assert!(r.output.contains("\"a\""));
        assert!(r.output.contains("\\u4e2d"));
        let a_pos = r.output.find("\"a\"").unwrap();
        let b_pos = r.output.find("\"b\"").unwrap();
        assert!(a_pos < b_pos);
    }

    #[test]
    fn report_parse_error_line() {
        let r = cmd_json_format("{\n\"a\":1,\n}", 2, false, false, Some(false)).unwrap();
        assert!(r.error_msg.is_some());
        assert_eq!(r.error_line, Some(3));
    }

    #[test]
    fn query_string_converts_to_json_with_string_values() {
        let r = cmd_json_format(
            "game=lyj&time=1788329624&sSign=11101265&platform=ly_sfzq&sign=939657c0ad4816fa3b0acc3ce016f23f",
            2, false, false, Some(false),
        )
        .unwrap();
        assert_eq!(r.converted_from.as_deref(), Some("query"));
        assert!(r.error_msg.is_none());
        assert!(r.output.contains("\"time\": \"1788329624\""));
        assert!(r.output.contains("\"sign\": \"939657c0ad4816fa3b0acc3ce016f23f\""));
    }

    #[test]
    fn full_url_extracts_query_part() {
        let r = cmd_json_format("https://x.com/p?a=1&b=2", 2, false, false, Some(false)).unwrap();
        assert_eq!(r.converted_from.as_deref(), Some("query"));
        assert!(r.output.contains("\"a\": \"1\""));
        assert!(r.output.contains("\"b\": \"2\""));
        assert!(!r.output.contains("https://x.com"));
    }

    #[test]
    fn query_string_percent_decodes() {
        let r = cmd_json_format("a=%E4%B8%AD%E6%96%87&b=x%2By", 2, false, false, Some(false)).unwrap();
        assert_eq!(r.converted_from.as_deref(), Some("query"));
        assert!(r.output.contains("\"a\": \"中文\""));
        // 仅做百分号解码，不把 '+' 当作空格
        assert!(r.output.contains("\"b\": \"x+y\""));
    }

    #[test]
    fn query_string_duplicate_key_last_wins() {
        let r = cmd_json_format("a=1&a=2", 2, false, false, Some(false)).unwrap();
        assert_eq!(r.converted_from.as_deref(), Some("query"));
        assert!(r.output.contains("\"a\": \"2\""));
        assert!(!r.output.contains("\"a\": \"1\""));
    }

    #[test]
    fn valid_json_is_not_misdetected() {
        let r = cmd_json_format(r#"{"a":1}"#, 2, false, false, Some(false)).unwrap();
        assert_eq!(r.converted_from, None);
        assert!(r.output.contains("\"a\": 1"));
    }

    #[test]
    fn non_json_non_query_reports_error() {
        let r = cmd_json_format("hello world", 2, false, false, Some(false)).unwrap();
        assert_eq!(r.converted_from, None);
        assert!(r.error_msg.is_some());
    }
}
