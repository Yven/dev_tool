use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;

#[derive(Serialize)]
pub struct Base64Result {
    output: String,
}

#[tauri::command]
pub fn cmd_base64_encode(input: &str, mode: Option<String>) -> Result<Base64Result, String> {
    let is_url_safe = mode
        .as_deref()
        .map(|m| m.eq_ignore_ascii_case("urlsafe"))
        .unwrap_or(false);
    let engine = if is_url_safe {
        &general_purpose::URL_SAFE
    } else {
        &general_purpose::STANDARD
    };
    Ok(Base64Result {
        output: engine.encode(input.as_bytes()),
    })
}

#[tauri::command]
pub fn cmd_base64_decode(input: &str, mode: Option<String>) -> Result<Base64Result, String> {
    let is_url_safe = mode
        .as_deref()
        .map(|m| m.eq_ignore_ascii_case("urlsafe"))
        .unwrap_or(false);
    let source = input.trim();

    let bytes = if is_url_safe {
        decode_with_engine(source, &general_purpose::URL_SAFE)
            .or_else(|_| decode_with_engine(source, &general_purpose::URL_SAFE_NO_PAD))
            .map_err(|e| format!("Base64 URL-safe 解码失败: {e}"))?
    } else {
        decode_with_engine(source, &general_purpose::STANDARD)
            .or_else(|_| decode_with_engine(source, &general_purpose::STANDARD_NO_PAD))
            .map_err(|e| format!("Base64 解码失败: {e}"))?
    };

    let text = String::from_utf8(bytes).map_err(|e| format!("解码结果不是有效 UTF-8: {e}"))?;
    Ok(Base64Result { output: text })
}

fn decode_with_engine(input: &str, engine: &impl base64::Engine) -> Result<Vec<u8>, base64::DecodeError> {
    match engine.decode(input) {
        Ok(v) => Ok(v),
        Err(_) => {
            let rem = input.len() % 4;
            if rem == 0 {
                engine.decode(input)
            } else {
                let mut padded = input.to_string();
                for _ in 0..(4 - rem) {
                    padded.push('=');
                }
                engine.decode(padded)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_encode() {
        let r = cmd_base64_encode("hello", None).unwrap();
        assert_eq!(r.output, "aGVsbG8=");
    }

    #[test]
    fn test_base64_decode() {
        let r = cmd_base64_decode("5Lit5paH", None).unwrap();
        assert_eq!(r.output, "中文");
    }

    #[test]
    fn test_base64_urlsafe_roundtrip() {
        let encoded = cmd_base64_encode("hello+/", Some("urlsafe".to_string())).unwrap();
        assert!(encoded.output.contains('-') || encoded.output.contains('_') || encoded.output.contains('='));
        let decoded = cmd_base64_decode(&encoded.output, Some("urlsafe".to_string())).unwrap();
        assert_eq!(decoded.output, "hello+/");
    }
}
