//! openclawd-solana-kit — Solana/EVM agent kit with optional HTTP service.
//!
//! Feature flags:
//! - `solana` (default): Solana tools, local signer, blockhash cache
//! - `evm`: EVM tools and local signer
//! - `http`: Actix HTTP service + Privy signer (`kit` binary)
//! - `cross-chain`: LiFi/multichain tools (implies `solana` + `evm`)
//! - `full`: all of the above

#[cfg(feature = "http")]
pub mod http;

#[cfg(feature = "solana")]
pub mod solana;

#[cfg(feature = "evm")]
pub mod evm;

#[cfg(feature = "cross-chain")]
pub mod cross_chain;

pub mod common;
pub mod constitution;
pub mod data;
pub mod dexscreener;
pub mod reasoning_loop;
pub mod signer;
pub mod story;

#[cfg(feature = "http")]
pub mod wallet_manager;

#[cfg(test)]
mod module_graph_tests {
    /// Structural check: core modules are always reachable from the crate root.
    #[test]
    fn core_modules_are_linked() {
        let _ = std::any::type_name::<crate::reasoning_loop::ReasoningLoop>();
        let _ = std::any::type_name::<crate::signer::SignerContext>();
        let preamble = crate::common::preamble_common();
        assert!(
            preamble.contains("CONSTITUTION") || preamble.to_lowercase().contains("never harm"),
            "preamble must embed Clawd constitution"
        );
        let _ = crate::constitution::load_constitution();
        // story is always in the graph (criterion: orphan modules wired)
        let _ = std::any::type_name::<crate::story::license::GetLicenseTokenResponse>();
        // data + dexscreener are always compiled
        let _ = std::any::type_name::<crate::data::TopToken>();
        let _ = std::any::type_name::<crate::dexscreener::DexScreenerResponse>();
    }

    #[cfg(feature = "solana")]
    #[test]
    fn solana_graph_includes_blockhash_and_tools() {
        let _ = std::any::type_name::<crate::solana::blockhash::BlockhashCache>();
        let _ = std::any::type_name::<crate::signer::solana::LocalSolanaSigner>();
    }

    #[cfg(feature = "cross-chain")]
    #[test]
    fn cross_chain_resolves_lifi_and_approvals() {
        let lifi = crate::cross_chain::lifi::LiFi::new(None);
        let _ = std::any::type_name_of_val(&lifi);
        // Drive the shipped in-tree approvals helper (no network).
        let tx = crate::cross_chain::approvals::create_approval_transaction(
            "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
            "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
            1_000_000,
            "0xCCC48877a33a2C14e40c82da843Cf4c607ABF770",
        )
        .expect("approval tx builds");
        assert_eq!(
            tx["to"],
            "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
        );
        assert!(tx["data"].as_str().unwrap().starts_with("0x095ea7b3"));
    }

    #[cfg(feature = "http")]
    #[test]
    fn http_and_wallet_manager_linked() {
        let _ = std::any::type_name::<crate::wallet_manager::WalletManager>();
        let _ = std::any::type_name::<crate::http::state::AppState>();
    }
}

#[ctor::ctor]
fn init() {
    dotenv::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                tracing_subscriber::EnvFilter::new("info")
                    .add_directive("openclawd_solana_kit=info".parse().unwrap())
            }),
        )
        .with_test_writer()
        .try_init()
        .ok();
}
