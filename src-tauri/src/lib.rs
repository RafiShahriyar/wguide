use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// The spawned Go backend process, killed when the app exits.
struct BackendProcess(Mutex<Option<CommandChild>>);

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let (mut rx, child) = app
                .shell()
                .sidecar("guideforge-backend")
                .expect("failed to resolve the guideforge-backend sidecar")
                .spawn()
                .expect("failed to spawn the guideforge-backend sidecar");

            app.manage(BackendProcess(Mutex::new(Some(child))));

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[backend] {}", String::from_utf8_lossy(&line))
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[backend] {}", String::from_utf8_lossy(&line))
                        }
                        CommandEvent::Error(err) => eprintln!("[backend] {err}"),
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building GuideForge")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(backend) = app_handle.try_state::<BackendProcess>() {
                    if let Some(child) = backend.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
