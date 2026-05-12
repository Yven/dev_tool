use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
pub struct JsonResult {
    output: String,
    error_line: Option<usize>,
    error_msg: Option<String>,
}

#[tauri::command]
pub fn cmd_json_format(
    input: &str,
    indent: u32,
    sort_keys: bool,
    escape_unicode: bool,
    compress: Option<bool>,
) -> Result<JsonResult, String> {
    let mut value: Value = match serde_json::from_str(input) {
        Ok(v) => v,
        Err(e) => {
            return Ok(JsonResult {
                output: String::new(),
                error_line: Some(e.line()),
                error_msg: Some(e.to_string()),
            });
        }
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
    })
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
}
