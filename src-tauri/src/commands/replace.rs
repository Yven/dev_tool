use serde::Serialize;

#[derive(Serialize)]
pub struct ReplaceResult {
    output: String,
    count: usize,
}

#[tauri::command(rename_all = "snake_case")]
pub fn cmd_text_replace(
    input: String,
    search: String,
    replacement: String,
    replace_all: bool,
) -> Result<ReplaceResult, String> {
    if search.is_empty() {
        return Err("搜索文本不能为空".to_string());
    }

    if replace_all {
        let count = input.matches(&search as &str).count();
        let output = input.replace(&search as &str, &replacement as &str);
        Ok(ReplaceResult { output, count })
    } else {
        if let Some(pos) = input.find(&search) {
            let mut output = String::with_capacity(input.len() - search.len() + replacement.len());
            output.push_str(&input[..pos]);
            output.push_str(&replacement);
            output.push_str(&input[pos + search.len()..]);
            Ok(ReplaceResult { output, count: 1 })
        } else {
            Ok(ReplaceResult {
                output: input,
                count: 0,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replace_all() {
        let r = cmd_text_replace("hello world hello".into(), "hello".into(), "hi".into(), true).unwrap();
        assert_eq!(r.output, "hi world hi");
        assert_eq!(r.count, 2);
    }

    #[test]
    fn test_replace_first() {
        let r = cmd_text_replace("hello world hello".into(), "hello".into(), "hi".into(), false).unwrap();
        assert_eq!(r.output, "hi world hello");
        assert_eq!(r.count, 1);
    }

    #[test]
    fn test_replace_no_match() {
        let r = cmd_text_replace("hello world".into(), "xyz".into(), "hi".into(), false).unwrap();
        assert_eq!(r.output, "hello world");
        assert_eq!(r.count, 0);
    }

    #[test]
    fn test_replace_empty_search() {
        assert!(cmd_text_replace("hello".into(), "".into(), "hi".into(), true).is_err());
    }
}
