use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    win.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn quit(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn plugin_storage_get(app: AppHandle, plugin_id: String, key: String) -> Result<Option<String>, String> {
    let path = plugin_storage_file(&app, &plugin_id)?;
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let map = value
        .as_object()
        .ok_or_else(|| "invalid plugin storage format".to_string())?;

    Ok(map.get(&key).and_then(|v| v.as_str().map(ToOwned::to_owned)))
}

#[tauri::command]
pub fn plugin_storage_set(
    app: AppHandle,
    plugin_id: String,
    key: String,
    value: String,
) -> Result<(), String> {
    let path = plugin_storage_file(&app, &plugin_id)?;

    let mut data = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content)
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    data.insert(key, serde_json::Value::String(value));

    let serialized = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, serialized).map_err(|e| e.to_string())
}

fn plugin_storage_file(app: &AppHandle, plugin_id: &str) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data.join("plugin_storage");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{}.json", sanitize_id(plugin_id))))
}

fn sanitize_id(input: &str) -> String {
    input
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}
