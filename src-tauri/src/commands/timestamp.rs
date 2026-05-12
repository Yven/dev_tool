use chrono::{DateTime, Local, LocalResult, NaiveDateTime, TimeZone, Utc};
use serde::Serialize;

#[derive(Serialize)]
pub struct TimestampResult {
    seconds: i64,
    rfc3339: String,
    local: String,
}

#[tauri::command]
pub fn cmd_timestamp_convert(input: &str, unit: &str, timezone: &str) -> Result<TimestampResult, String> {
    let dt_utc = parse_input_to_utc(input.trim(), unit, timezone)?;
    let seconds = dt_utc.timestamp();
    let rfc3339 = dt_utc.to_rfc3339();
    let local = format_in_timezone(&dt_utc, timezone);

    Ok(TimestampResult {
        seconds,
        rfc3339,
        local,
    })
}

fn parse_input_to_utc(input: &str, unit: &str, timezone: &str) -> Result<DateTime<Utc>, String> {
    if let Ok(v) = input.parse::<i64>() {
        return from_timestamp(v, unit);
    }

    if let Ok(dt) = DateTime::parse_from_rfc3339(input) {
        return Ok(dt.with_timezone(&Utc));
    }

    if let Ok(dt) = DateTime::parse_from_str(input, "%Y-%m-%d %H:%M:%S %:z") {
        return Ok(dt.with_timezone(&Utc));
    }

    let naive = NaiveDateTime::parse_from_str(input, "%Y-%m-%d %H:%M:%S")
        .map_err(|_| format!("无法解析输入: {input}"))?;

    if timezone.eq_ignore_ascii_case("local") {
        let local_dt = match Local.from_local_datetime(&naive) {
            LocalResult::Single(v) => v,
            LocalResult::Ambiguous(v, _) => v,
            LocalResult::None => return Err("本地时间无效".to_string()),
        };
        return Ok(local_dt.with_timezone(&Utc));
    }

    let offset = parse_offset(timezone)?;
    let fixed_dt = match offset.from_local_datetime(&naive) {
        LocalResult::Single(v) => v,
        LocalResult::Ambiguous(v, _) => v,
        LocalResult::None => return Err("时区时间无效".to_string()),
    };
    Ok(fixed_dt.with_timezone(&Utc))
}

fn from_timestamp(value: i64, unit: &str) -> Result<DateTime<Utc>, String> {
    let seconds = match unit {
        "s" => value,
        "ms" => value / 1_000,
        "us" => value / 1_000_000,
        _ => return Err(format!("未知单位: {unit}")),
    };
    Utc.timestamp_opt(seconds, 0)
        .single()
        .ok_or_else(|| "时间戳超出范围".to_string())
}

fn parse_offset(input: &str) -> Result<chrono::FixedOffset, String> {
    let raw = input.trim();
    if raw.eq_ignore_ascii_case("UTC") || raw.eq_ignore_ascii_case("Z") {
        return chrono::FixedOffset::east_opt(0).ok_or_else(|| "无效时区".to_string());
    }

    let s = raw.strip_prefix("UTC").unwrap_or(raw);
    if s.len() != 6 {
        return Err(format!("不支持的时区格式: {input}"));
    }
    let sign = &s[0..1];
    let hour: i32 = s[1..3].parse().map_err(|_| format!("不支持的时区格式: {input}"))?;
    let minute: i32 = s[4..6].parse().map_err(|_| format!("不支持的时区格式: {input}"))?;
    let total = hour * 3600 + minute * 60;
    match sign {
        "+" => chrono::FixedOffset::east_opt(total).ok_or_else(|| "时区越界".to_string()),
        "-" => chrono::FixedOffset::west_opt(total).ok_or_else(|| "时区越界".to_string()),
        _ => Err(format!("不支持的时区格式: {input}")),
    }
}

fn format_in_timezone(dt: &DateTime<Utc>, timezone: &str) -> String {
    if timezone.eq_ignore_ascii_case("local") {
        return dt
            .with_timezone(&Local)
            .format("%Y-%m-%d %H:%M:%S %:z")
            .to_string();
    }
    if let Ok(offset) = parse_offset(timezone) {
        return dt
            .with_timezone(&offset)
            .format("%Y-%m-%d %H:%M:%S %:z")
            .to_string();
    }
    dt.with_timezone(&Utc)
        .format("%Y-%m-%d %H:%M:%S %:z")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seconds_input() {
        let r = cmd_timestamp_convert("1609459200", "s", "UTC").unwrap();
        assert_eq!(r.seconds, 1609459200);
    }

    #[test]
    fn test_datetime_string() {
        let r = cmd_timestamp_convert("2026-05-11 19:55:22", "s", "UTC+08:00").unwrap();
        assert!(r.rfc3339.starts_with("2026-05-11T11:55:22"));
    }

    #[test]
    fn test_invalid_input() {
        assert!(cmd_timestamp_convert("abc", "s", "UTC").is_err());
    }
}
