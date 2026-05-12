use std::collections::HashMap;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PluginMeta {
    pub id: String,
    pub name: String,
    pub version: String,
    pub file_path: String,
}

pub struct PluginRegistry {
    plugins: HashMap<String, PluginMeta>,
}

impl PluginRegistry {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
        }
    }

    pub fn register(&mut self, meta: PluginMeta) {
        self.plugins.insert(meta.id.clone(), meta);
    }

    pub fn unregister(&mut self, id: &str) -> Option<PluginMeta> {
        self.plugins.remove(id)
    }

    pub fn get(&self, id: &str) -> Option<&PluginMeta> {
        self.plugins.get(id)
    }

    pub fn list(&self) -> Vec<&PluginMeta> {
        self.plugins.values().collect()
    }

    pub fn is_loaded(&self, id: &str) -> bool {
        self.plugins.contains_key(id)
    }
}