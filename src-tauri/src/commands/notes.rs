use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

fn notes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data.join("notes");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn validate_note_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err("invalid note path".to_string());
    }
    Ok(())
}

fn resolve_note_path(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);
    if p.components().count() != 1 {
        return Err("invalid note path".to_string());
    }
    let name = p
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "invalid note path".to_string())?;
    validate_note_name(name)?;
    Ok(notes_dir(app)?.join(name))
}

#[tauri::command]
pub fn notes_read_index(app: AppHandle) -> Result<Option<String>, String> {
    let path = notes_dir(&app)?.join("index.json");
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notes_write_index(app: AppHandle, json: String) -> Result<(), String> {
    let path = notes_dir(&app)?.join("index.json");
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notes_read(app: AppHandle, path: String) -> Result<String, String> {
    let p = resolve_note_path(&app, &path)?;
    if !p.exists() {
        return Err(format!("note not found: {}", path));
    }
    fs::read_to_string(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notes_write(app: AppHandle, path: String, content: String) -> Result<(), String> {
    let p = resolve_note_path(&app, &path)?;
    fs::write(&p, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notes_delete(app: AppHandle, path: String) -> Result<(), String> {
    let p = resolve_note_path(&app, &path)?;
    if p.exists() {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn notes_confirm(app: AppHandle, message: String) -> Result<bool, String> {
    let ok = app
        .dialog()
        .message(message)
        .title("DevTool")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show();
    Ok(ok)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_path_traversal() {
        assert!(validate_note_name("../x.txt").is_err());
        assert!(validate_note_name("a/b.txt").is_err());
        assert!(validate_note_name("..\\x.txt").is_err());
        assert!(validate_note_name("ok.txt").is_ok());
        assert!(validate_note_name("").is_err());
    }
}
