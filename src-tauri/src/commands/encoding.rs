use regex::Regex;
use serde::Serialize;

#[derive(Serialize)]
pub struct EncodingResult {
    output: String,
    detected_type: String,
}

#[tauri::command]
pub fn cmd_encoding_convert(input: &str, direction: &str) -> Result<EncodingResult, String> {
    let detected = detect_encoding_type(input);

    let output = match direction {
        "decode" => decode_input(input, &detected)?,
        "encode" => encode_input(input)?,
        _ => return Err("direction 必须为 decode 或 encode".into()),
    };

    Ok(EncodingResult {
        output,
        detected_type: detected,
    })
}

fn detect_encoding_type(s: &str) -> String {
    // 检测 Unicode 转义: \uXXXX
    if Regex::new(r"\\u[0-9a-fA-F]{4}").unwrap().is_match(s) {
        return "unicode_escape".into();
    }
    // 检测 HTML 实体: &#x 或 &#X
    if Regex::new(r"&#x[0-9a-fA-F]+;?").unwrap().is_match(s)
        || Regex::new(r"&#X[0-9a-fA-F]+;?").unwrap().is_match(s)
    {
        return "html_entity".into();
    }
    // 检测 URL 编码: %XX
    if Regex::new(r"%[0-9a-fA-F]{2}").unwrap().is_match(s) {
        return "percent".into();
    }
    "plain".into()
}

fn decode_input(input: &str, enc_type: &str) -> Result<String, String> {
    match enc_type {
        "unicode_escape" => decode_unicode_escape(input),
        "html_entity" => decode_html_entity(input),
        "percent" => decode_percent(input),
        _ => Ok(input.into()),
    }
}

fn decode_unicode_escape(s: &str) -> Result<String, String> {
    let re = Regex::new(r"\\u([0-9a-fA-F]{4})").map_err(|e| e.to_string())?;
    let mut result = s.to_string();
    for cap in re.captures_iter(s) {
        let code: u32 = u32::from_str_radix(&cap[1], 16).map_err(|e| e.to_string())?;
        if let Some(ch) = char::from_u32(code) {
            result = result.replace(&cap[0], &ch.to_string());
        }
    }
    Ok(result)
}

fn decode_html_entity(s: &str) -> Result<String, String> {
    let re = Regex::new(r"&#x([0-9a-fA-F]+);?").map_err(|e| e.to_string())?;
    let mut result = s.to_string();
    for cap in re.captures_iter(s) {
        let code: u32 = u32::from_str_radix(&cap[1], 16).map_err(|e| e.to_string())?;
        if let Some(ch) = char::from_u32(code) {
            result = result.replace(&cap[0], &ch.to_string());
        }
    }
    Ok(result)
}

fn decode_percent(s: &str) -> Result<String, String> {
    use percent_encoding::percent_decode_str;
    Ok(percent_decode_str(s).decode_utf8_lossy().to_string())
}

fn encode_input(s: &str) -> Result<String, String> {
    // 默认编码为 Unicode 转义
    let mut result = String::new();
    for ch in s.chars() {
        if ch as u32 > 127 {
            result.push_str(&format!("\\u{:04x}", ch as u32));
        } else {
            result.push(ch);
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_unicode_escape() {
        let r = cmd_encoding_convert("\\u4e2d\\u6587", "decode").unwrap();
        assert_eq!(r.output, "中文");
        assert_eq!(r.detected_type, "unicode_escape");
    }

    #[test]
    fn test_encode_chinese() {
        let r = cmd_encoding_convert("中文", "encode").unwrap();
        assert_eq!(r.output, "\\u4e2d\\u6587");
    }

    #[test]
    fn test_detect_html_entity() {
        let detected = detect_encoding_type("&#x4e2d;&#x6587;");
        assert_eq!(detected, "html_entity");
    }
}
