use serde::Serialize;

#[derive(Serialize)]
pub struct RandomResult {
    output: String,
}

#[tauri::command(rename_all = "snake_case")]
pub fn cmd_random_generate(
    length: usize,
    uppercase: bool,
    lowercase: bool,
    digits: bool,
    symbols: bool,
) -> Result<RandomResult, String> {
    let mut pool: Vec<char> = Vec::new();

    if uppercase {
        pool.extend('A'..='Z');
    }
    if lowercase {
        pool.extend('a'..='z');
    }
    if digits {
        pool.extend('0'..='9');
    }
    if symbols {
        pool.extend("!@#$%^&*()-_=+[]{}|;:,.<>?/~`".chars());
    }

    if pool.is_empty() {
        return Err("至少需要选择一种字符类型".to_string());
    }

    let output = generate_random_string(length, &pool);
    Ok(RandomResult { output })
}

fn generate_random_string(length: usize, pool: &[char]) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    let mut state = seed as u64;
    let mut result = String::with_capacity(length);

    for _ in 0..length {
        state = state ^ (state << 13);
        state = state ^ (state >> 7);
        state = state ^ (state << 17);
        let idx = (state % pool.len() as u64) as usize;
        result.push(pool[idx]);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_generate() {
        let r = cmd_random_generate(16, true, true, true, false).unwrap();
        assert_eq!(r.output.len(), 16);
    }

    #[test]
    fn test_no_charset() {
        assert!(cmd_random_generate(16, false, false, false, false).is_err());
    }

    #[test]
    fn test_only_digits() {
        let r = cmd_random_generate(8, false, false, true, false).unwrap();
        assert!(r.output.chars().all(|c| c.is_ascii_digit()));
    }
}