/// iframe sandbox 属性常量 — 插件隔离策略
///
/// 插件在 iframe 中运行，以下属性限制其权限：
/// - scripts: 允许执行脚本（插件需要 JS 运行）
/// - same-origin: 禁止同源访问（隔离主应用 DOM/Storage）
/// - allow-same-origin: 不设置，阻止跨域访问主应用资源
/// - allow-forms: 不设置，阻止表单提交跳转
/// - allow-popups: 不设置，阻止弹出窗口

/// iframe sandbox 属性值列表
/// 注意：不包含 allow-same-origin，这是隔离的关键
pub const SANDBOX_ATTRIBUTES: &str = "allow-scripts";

/// 插件 iframe 的 CSP 策略
/// 仅允许脚本执行，禁止外部资源加载
pub const PLUGIN_CSP: &str =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'";

/// 插件 JS 文件最大大小限制 (200KB)
pub const MAX_PLUGIN_SIZE: u64 = 200 * 1024;

/// 插件必须包含的导出标识
pub const PLUGIN_EXPORT_MARKER: &str = "export default";