//! Token-2022 / SPL Token extension safety checks.
//!
//! Token-2022 mints can carry extensions that materially change transfer
//! semantics and can enable rug/exit vectors the legacy SPL-Token program
//! cannot express:
//!
//! - `PermanentDelegate` — a delegate that can transfer/burn **every**
//!   holder's tokens forever, including after the current owner sells.
//! - `TransferFeeConfig` — a per-transfer fee (a "tax token") whose
//!   withdraw authority can drain the accumulated withheld fees.
//! - `TransferHook` — a CPI into an arbitrary program on every transfer,
//!   commonly used by post-migration Pump.fun tokens to gate sells.
//! - `Freeze` (base field + `DefaultAccountState`) — an authority (or a
//!   frozen-by-default policy) that can lock holders out of their tokens.
//! - `MintCloseAuthority` / `InterestBearingConfig` — mint closure and
//!   re-basable interest that also change trust assumptions.
//!
//! The check reads the mint account once, unpacks the TLV extension data with
//! `spl-token-2022`'s zero-copy `PodStateWithExtensions`, and reports every
//! risky extension with its key details. It is read-only — no RPC writes.

use anyhow::{anyhow, Result};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

use crate::solana::constants::{TOKEN_2022_PROGRAM, TOKEN_PROGRAM};

/// The SPL-Token program id (legacy — no extensions).
const SPL_TOKEN_PROGRAM: &str = TOKEN_PROGRAM;

/// `AccountState::Frozen` in the Token-2022 `DefaultAccountState` extension.
const ACCOUNT_STATE_FROZEN: u8 = 2;

/// Outcome of a Token-2022 / SPL token safety inspection.
#[derive(Debug, serde::Serialize)]
pub struct TokenSafetyReport {
    pub mint: String,
    pub program: String,
    pub is_token_2022: bool,
    pub freeze_authority: Option<String>,
    pub mint_authority: Option<String>,
    pub risky_extensions: Vec<RiskyExtension>,
    pub safe: bool,
}

#[derive(Debug, serde::Serialize)]
pub struct RiskyExtension {
    pub name: &'static str,
    pub detail: String,
}

/// Fetches the mint account and returns a structured safety report.
///
/// - Legacy SPL Token mints have no extensions: only a `freeze_authority`
///   (and a non-null `mint_authority`) are reported.
/// - Token-2022 mints are unpacked and every extension type is enumerated.
pub async fn check_token_safety(rpc: &RpcClient, mint_str: &str) -> Result<TokenSafetyReport> {
    let mint = Pubkey::from_str(mint_str)
        .map_err(|e| anyhow!("invalid mint address {}: {e}", mint_str))?;
    let account = rpc
        .get_account(&mint)
        .await
        .map_err(|e| anyhow!("failed to fetch mint account {}: {e}", mint_str))?;

    let token_2022 = Pubkey::from_str(TOKEN_2022_PROGRAM)?;
    let legacy_token = Pubkey::from_str(SPL_TOKEN_PROGRAM)?;

    if account.owner != token_2022 && account.owner != legacy_token {
        return Err(anyhow!(
            "{} is not a token mint (owner {} is neither SPL Token nor Token-2022)",
            mint_str,
            account.owner
        ));
    }

    let is_token_2022 = account.owner == token_2022;

    if !is_token_2022 {
        // Legacy SPL Token — no TLV extensions. Only check authorities.
        let mut freeze_authority: Option<String> = None;
        let mut mint_authority: Option<String> = None;
        if account.data.len() >= 82 {
            // Mint layout: mint_authority (COption<Pubkey>) @ 0, freeze_authority @ 45
            mint_authority = read_coption_pubkey(&account.data, 0).map(|p| p.to_string());
            freeze_authority = read_coption_pubkey(&account.data, 45).map(|p| p.to_string());
        }

        let mut risky_extensions = Vec::new();
        if freeze_authority.is_some() {
            risky_extensions.push(RiskyExtension {
                name: "FreezeAuthority",
                detail: format!(
                    "mint has a freeze authority ({}) that can freeze holder accounts",
                    freeze_authority.clone().unwrap_or_default()
                ),
            });
        }
        let safe = risky_extensions.is_empty();

        return Ok(TokenSafetyReport {
            mint: mint_str.to_string(),
            program: TOKEN_PROGRAM.to_string(),
            is_token_2022,
            freeze_authority,
            mint_authority,
            risky_extensions,
            safe,
        });
    }

    // Token-2022: unpack zero-copy and enumerate the TLV extension data.
    use spl_token_2022::extension::{
        default_account_state::DefaultAccountState, interest_bearing_mint::InterestBearingConfig,
        permanent_delegate::PermanentDelegate, transfer_fee::TransferFeeConfig,
        transfer_hook::TransferHook, BaseStateWithExtensions, ExtensionType,
        PodStateWithExtensions,
    };
    use spl_token_2022::pod::PodMint;

    let state = PodStateWithExtensions::<PodMint>::unpack(&account.data)
        .map_err(|e| anyhow!("failed to unpack Token-2022 mint {}: {e}", mint_str))?;
    let extension_types = state
        .get_extension_types()
        .map_err(|e| anyhow!("failed to read Token-2022 extensions for {}: {e}", mint_str))?;

    let mint_authority = state
        .base
        .mint_authority
        .unwrap_or(Pubkey::default())
        .to_string();
    let mint_authority = (state.base.mint_authority.is_some()).then_some(mint_authority);
    let freeze_authority = state
        .base
        .freeze_authority
        .unwrap_or(Pubkey::default())
        .to_string();
    let freeze_authority = state.base.freeze_authority.is_some().then_some(freeze_authority);

    let mut risky_extensions: Vec<RiskyExtension> = Vec::new();

    if extension_types.contains(&ExtensionType::PermanentDelegate) {
        if let Ok(ext) = state.get_extension::<PermanentDelegate>() {
            let delegate = Option::<Pubkey>::from(ext.delegate)
                .map(|p| p.to_string())
                .unwrap_or_default();
            risky_extensions.push(RiskyExtension {
                name: "PermanentDelegate",
                detail: format!(
                    "permanent delegate ({}) can transfer or burn every holder's tokens forever",
                    delegate
                ),
            });
        } else {
            risky_extensions.push(RiskyExtension {
                name: "PermanentDelegate",
                detail: "permanent delegate extension present but could not be unpacked".into(),
            });
        }
    }

    if extension_types.contains(&ExtensionType::TransferFeeConfig) {
        if let Ok(ext) = state.get_extension::<TransferFeeConfig>() {
            let bps = u16::from(ext.newer_transfer_fee.transfer_fee_basis_points);
            let max_fee = u64::from(ext.newer_transfer_fee.maximum_fee);
            let withdraw = Option::<Pubkey>::from(ext.withdraw_withheld_authority)
                .map(|p| p.to_string())
                .unwrap_or_default();
            risky_extensions.push(RiskyExtension {
                name: "TransferFee",
                detail: format!(
                    "transfer fee {} bps (max {}) with withdraw authority {} — every swap is taxed",
                    bps, max_fee, withdraw
                ),
            });
        } else {
            risky_extensions.push(RiskyExtension {
                name: "TransferFee",
                detail: "transfer fee config present but could not be unpacked".into(),
            });
        }
    }

    if extension_types.contains(&ExtensionType::TransferHook) {
        if let Ok(ext) = state.get_extension::<TransferHook>() {
            let program = Option::<Pubkey>::from(ext.program_id)
                .map(|p| p.to_string())
                .unwrap_or_default();
            let authority = Option::<Pubkey>::from(ext.authority)
                .map(|p| p.to_string())
                .unwrap_or_default();
            risky_extensions.push(RiskyExtension {
                name: "TransferHook",
                detail: format!(
                    "every transfer CPIs program {} (authority {}) — can gate/block sells",
                    program, authority
                ),
            });
        } else {
            risky_extensions.push(RiskyExtension {
                name: "TransferHook",
                detail: "transfer hook present but could not be unpacked".into(),
            });
        }
    }

    if extension_types.contains(&ExtensionType::MintCloseAuthority) {
        risky_extensions.push(RiskyExtension {
            name: "MintCloseAuthority",
            detail: "mint can be closed by an authority, destroying remaining supply".into(),
        });
    }

    if extension_types.contains(&ExtensionType::InterestBearingConfig) {
        if let Ok(ext) = state.get_extension::<InterestBearingConfig>() {
            let rate = i16::from(ext.current_rate);
            risky_extensions.push(RiskyExtension {
                name: "InterestBearing",
                detail: format!(
                    "interest-bearing mint with current rate {} bps/yr — balances re-base over time",
                    rate
                ),
            });
        } else {
            risky_extensions.push(RiskyExtension {
                name: "InterestBearing",
                detail: "interest-bearing config present but could not be unpacked".into(),
            });
        }
    }

    if extension_types.contains(&ExtensionType::DefaultAccountState) {
        if let Ok(ext) = state.get_extension::<DefaultAccountState>() {
            if ext.state == ACCOUNT_STATE_FROZEN {
                risky_extensions.push(RiskyExtension {
                    name: "FrozenByDefault",
                    detail: "new token accounts default to FROZEN — holders can be locked out".into(),
                });
            }
        }
    }

    if freeze_authority.is_some() {
        risky_extensions.push(RiskyExtension {
            name: "FreezeAuthority",
            detail: format!(
                "freeze authority ({}) can freeze any holder account",
                freeze_authority.clone().unwrap_or_default()
            ),
        });
    }

    let safe = risky_extensions.is_empty();

    Ok(TokenSafetyReport {
        mint: mint_str.to_string(),
        program: TOKEN_2022_PROGRAM.to_string(),
        is_token_2022,
        freeze_authority,
        mint_authority,
        risky_extensions,
        safe,
    })
}

/// Reads a `COption<Pubkey>` (4-byte tag + 32-byte pubkey) at `offset`.
fn read_coption_pubkey(data: &[u8], offset: usize) -> Option<Pubkey> {
    if data.len() < offset + 36 {
        return None;
    }
    let tag = u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]);
    if tag == 1 {
        Pubkey::try_from(&data[offset + 4..offset + 36]).ok()
    } else {
        None
    }
}
