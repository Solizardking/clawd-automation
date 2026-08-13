#[cfg(feature = "http")]
use {
    openclawd_solana_kit::http::server::run_server,
    privy::{config::PrivyConfig, Privy},
};

#[cfg(feature = "http")]
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Privy is only required for /stream and /auth. The /agent/* automation
    // bridge signs with SOLANA_PRIVATE_KEY, so a missing Privy config must
    // not block a local start.
    let privy_client = match PrivyConfig::from_env() {
        Ok(cfg) => Some(Privy::new(cfg)),
        Err(e) => {
            eprintln!(
                "[kit] Privy not configured ({e}); /stream and /auth disabled; /agent/* available"
            );
            None
        }
    };

    run_server(privy_client).await
}

#[cfg(not(feature = "http"))]
fn main() {
    println!("This binary requires the 'http' feature");
}
