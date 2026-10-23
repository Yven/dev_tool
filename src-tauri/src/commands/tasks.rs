use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

fn tasks_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data.join("tasks");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn tasks_read(app: AppHandle) -> Result<Option<String>, String> {
    let path = tasks_dir(&app)?.join("tasks.json");
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tasks_write(app: AppHandle, json: String) -> Result<(), String> {
    let path = tasks_dir(&app)?.join("tasks.json");
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tasks_confirm(app: AppHandle, message: String) -> Result<bool, String> {
    let ok = app
        .dialog()
        .message(message)
        .title("DevTool")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show();
    Ok(ok)
}
