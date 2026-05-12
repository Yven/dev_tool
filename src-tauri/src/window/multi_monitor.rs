use tauri::WebviewWindow;

/// 获取所有可用显示器信息
pub fn get_available_monitors(window: &WebviewWindow) -> Vec<MonitorInfo> {
    window
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|m| MonitorInfo {
            name: m.name().cloned().unwrap_or_default(),
            position: (m.position().x, m.position().y),
            size: (m.size().width, m.size().height),
            scale_factor: m.scale_factor(),
        })
        .collect()
}

#[derive(Debug, Clone)]
pub struct MonitorInfo {
    pub name: String,
    pub position: (i32, i32),
    pub size: (u32, u32),
    pub scale_factor: f64,
}

/// 确保窗口位置在可见显示器范围内
pub fn clamp_to_visible_area(window: &WebviewWindow) {
    if let (Ok(pos), Ok(size), Ok(Some(monitor))) = (
        window.outer_position(),
        window.outer_size(),
        window.current_monitor(),
    ) {
        let mon_pos = monitor.position();
        let mon_size = monitor.size();

        let x = pos.x;
        let y = pos.y;
        let w = size.width as i32;
        let h = size.height as i32;

        // 确保窗口至少有 50px 可见在当前显示器上
        let min_visible = 50;
        let clamped_x = x.clamp(mon_pos.x - w + min_visible, mon_pos.x + mon_size.width as i32 - min_visible);
        let clamped_y = y.clamp(mon_pos.y - h + min_visible, mon_pos.y + mon_size.height as i32 - min_visible);

        if clamped_x != x || clamped_y != y {
            let _ = window.set_position(tauri::PhysicalPosition::new(clamped_x, clamped_y));
        }
    }
}