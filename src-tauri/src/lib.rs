mod commands;
mod hotkey;
mod plugin_loader;
mod window;

use tauri::Emitter;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
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

            // 系统托盘图标
            let about_i = MenuItem::with_id(app, "about", "关于", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&about_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("DevTool")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "about" => { let _ = app.emit("show-about", ()); }
                    "quit" => { app.exit(0); }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 开机自启插件
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_autostart::init(
                    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                    Some(vec!["--auto-start"]),
                ))?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
