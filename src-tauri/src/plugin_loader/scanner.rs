use std::fs;
use std::path::PathBuf;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};

use super::registry::PluginMeta;
use super::sandbox::MAX_PLUGIN_SIZE;
use super::sandbox::PLUGIN_EXPORT_MARKER;

pub fn scan_plugins_dir(app: &tauri::App) -> Result<Vec<PluginMeta>, String> {
    let plugins_dir = get_plugins_dir(app)?;

    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir).map_err(|e| format!("创建插件目录失败: {}", e))?;
        return Ok(vec![]);
    }

    let mut plugins = Vec::new();
    for entry in fs::read_dir(&plugins_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if !path.extension().map(|e| e == "js").unwrap_or(false) {
            continue;
        }

        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
        if metadata.len() > MAX_PLUGIN_SIZE {
            continue;
        }

        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if !content.contains(PLUGIN_EXPORT_MARKER) {
            continue;
        }

        // 从 JS 内容中提取 name 和 version（如果存在）
        let (name, version) = extract_meta_from_content(&content, &path);

        plugins.push(PluginMeta {
            id: path.file_stem().unwrap().to_string_lossy().to_string(),
            name,
            version,
            file_path: path.to_string_lossy().to_string(),
        });
    }
    Ok(plugins)
}

pub fn start_watch(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // 启动时扫描一次
    let plugins = scan_plugins_dir(app)?;
    let app_handle = app.handle().clone();
    let mut known_ids: std::collections::HashSet<String> = plugins.iter().map(|p| p.id.clone()).collect();

    for plugin in plugins {
        app_handle.emit("plugin-loaded", &plugin)?;
    }

    // v0.1: 轮询方式监听目录变化，后续可替换为 fs watcher
    let watcher_app = app.handle().clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(2));
        let current = scan_plugins_dir_by_handle(&watcher_app).unwrap_or_default();
        let current_ids: std::collections::HashSet<String> = current.iter().map(|p| p.id.clone()).collect();

        for plugin in &current {
            if !known_ids.contains(&plugin.id) {
                let _ = watcher_app.emit("plugin-loaded", plugin);
            }
        }

        for id in known_ids.difference(&current_ids) {
            let payload = serde_json::json!({ "id": id });
            let _ = watcher_app.emit("plugin-unloaded", payload);
        }

        known_ids = current_ids;
    });

    Ok(())
}

fn get_plugins_dir(app: &tauri::App) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data.join("plugins"))
}

fn get_plugins_dir_by_handle(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data.join("plugins"))
}

fn scan_plugins_dir_by_handle(app: &tauri::AppHandle) -> Result<Vec<PluginMeta>, String> {
    let plugins_dir = get_plugins_dir_by_handle(app)?;

    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir).map_err(|e| format!("创建插件目录失败: {}", e))?;
        return Ok(vec![]);
    }

    let mut plugins = Vec::new();
    for entry in fs::read_dir(&plugins_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if !path.extension().map(|e| e == "js").unwrap_or(false) {
            continue;
        }

        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
        if metadata.len() > MAX_PLUGIN_SIZE {
            continue;
        }

        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if !content.contains(PLUGIN_EXPORT_MARKER) {
            continue;
        }

        let (name, version) = extract_meta_from_content(&content, &path);
        plugins.push(PluginMeta {
            id: path.file_stem().unwrap().to_string_lossy().to_string(),
            name,
            version,
            file_path: path.to_string_lossy().to_string(),
        });
    }

    Ok(plugins)
}

/// 尝试从 JS 内容提取 name/version，失败则用文件名兜底
fn extract_meta_from_content(content: &str, path: &PathBuf) -> (String, String) {
    let default_name = path.file_stem().unwrap().to_string_lossy().to_string();
    let default_version = "0.0.0";

    // 粗略匹配 name: "xxx" / version: "xxx"
    let name = extract_string_field(content, "name").unwrap_or(default_name);
    let version = extract_string_field(content, "version").unwrap_or(default_version.to_string());

    (name, version)
}

fn extract_string_field(content: &str, field: &str) -> Option<String> {
    let pattern = format!("{}:", field);
    let start = content.find(&pattern)?;
    let rest = &content[start + pattern.len()..];
    let trimmed = rest.trim_start();

    if !trimmed.starts_with('"') && !trimmed.starts_with("'") {
        return None;
    }
    let quote = trimmed.chars().next()?;
    let end = trimmed[1..].find(quote)? + 1;
    Some(trimmed[1..end].to_string())
}
