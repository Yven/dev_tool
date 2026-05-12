mod commands;
mod hotkey;
mod plugin_loader;
mod window;

use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

#[derive(Clone, serde::Serialize)]
struct Payload {
    args: Vec<String>,
    cwd: String,
}

pub fn run() {
    tauri::Builder::default()
        // 官方插件（global-shortcut 在 setup 中用 Builder+handler 注册）
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            app.emit("single-instance", Payload { args: argv, cwd }).unwrap();
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_positioner::init())
        // 自定义 Commands
        .invoke_handler(tauri::generate_handler![
            commands::timestamp::cmd_timestamp_convert,
            commands::encoding::cmd_encoding_convert,
            commands::base64::cmd_base64_encode,
            commands::base64::cmd_base64_decode,
            commands::url::cmd_url_encode,
            commands::url::cmd_url_decode,
            commands::json_fmt::cmd_json_format,
            commands::config::hide_window,
            commands::config::quit,
            commands::config::plugin_storage_get,
            commands::config::plugin_storage_set,
        ])
        .setup(|app| {
            // 注册全局热键（Ctrl+Alt+D 显示/最小化切换）
            #[cfg(desktop)]
            {
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcuts(["ctrl+alt+d"])?
                        .with_handler(|app, shortcut, event| {
                            if event.state == ShortcutState::Pressed
                                && shortcut.matches(Modifiers::CONTROL | Modifiers::ALT, Code::KeyD)
                            {
                                hotkey::manager::toggle_window(app);
                            }
                        })
                        .build(),
                )?;
            }
            // 启动插件扫描
            plugin_loader::scanner::start_watch(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
