use tauri::Manager;

/// Ctrl+Shift+Space 唤出/隐藏窗口
pub fn toggle_window(app: &tauri::AppHandle) {
    #[cfg(desktop)]
    {
        if let Some(win) = app.get_webview_window("main") {
            let focused = win.is_focused().unwrap_or(false);
            let minimized = win.is_minimized().unwrap_or(false);
            if !focused || minimized {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            } else {
                let _ = win.hide();
            }
        }
    }
}
