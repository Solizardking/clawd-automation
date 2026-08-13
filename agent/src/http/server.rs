use actix_cors::Cors;
use actix_web::middleware::{Compress, Logger};
use actix_web::{web, App, HttpServer};
use privy::Privy;

use actix_files as fs;
use super::routes::{auth, healthz, stream};
use super::agent_bridge::{agent_act, agent_health};
use super::agents::{get_agent_catalog, get_agent_by_id, mint_agent, create_agent, agents_health};
use super::state::AppState;

pub async fn run_server(privy: Option<Privy>) -> std::io::Result<()> {
    let state = web::Data::new(AppState::new(privy));
    let bind = std::env::var("KIT_BIND").unwrap_or_else(|_| "0.0.0.0:6969".to_string());
    println!("[kit] listening on {bind}");

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Compress::default())
            .wrap(Cors::permissive())
            .app_data(state.clone())
            // API routes
            .service(healthz)
            .service(stream)
            .service(auth)
            // Agent catalog routes
            .service(get_agent_catalog)
            .service(get_agent_by_id)
            .service(mint_agent)
            .service(create_agent)
            .service(agents_health)
            // Server-to-server automation bridge (shared-secret auth, local signer)
            .service(agent_health)
            .service(agent_act)
            // Static frontend (if ./frontend/ exists)
            .service(
                fs::Files::new("/", "./frontend")
                    .index_file("index.html")
                    .show_files_listing()
            )
    })
    .bind(&bind)?
    .run()
    .await
}
