use std::process::exit;
use log::info;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, RunEvent, Runtime, State};
use crate::manager::PluginManager;

pub mod error;
pub mod events;
pub mod manager;
mod nodejs;
mod server;
pub mod plugin_handle;
mod util;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("yaak_plugin_runtime")
        .setup(|app_handle, _| {
            let manager = PluginManager::new(app_handle.clone());
            app_handle.manage(manager.clone());

            Ok(())
        })
        .on_event(|app, e| match e {
            // TODO: Also exit when app is force-quit (eg. cmd+r in IntelliJ runner)
            RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
                tauri::async_runtime::block_on(async move {
                    info!("Exiting plugin runtime due to app exit");
                    let manager: State<PluginManager> = app.state();
                    manager.terminate().await;
                    exit(0);
                });
            }
            _ => {}
        })
        .build()
}
