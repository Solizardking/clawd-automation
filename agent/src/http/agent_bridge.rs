//! Server-to-server trading bridge for automation clients (e.g. the OODA
//! harness at https://clawd-ooda.fly.dev). Unlike `/stream`, this endpoint
//! does not require a Privy user session — it authenticates with a shared
//! secret (`AGENT_BRIDGE_KEY`) and signs with the kit's own local wallet
//! (`SOLANA_PRIVATE_KEY`), so a caller can hand it a natural-language
//! instruction ("buy 0.05 SOL of <mint>") for any SPL token and get back the
//! full tool-call trace. Both env vars must be set or every request is
//! refused — there is no way to reach this route unauthenticated.

use actix_web::{get, post, web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::common::spawn_with_signer;
use crate::reasoning_loop::{LoopResponse, ReasoningLoop};
use crate::signer::TransactionSigner;
use rig::completion::Message;
use rig::message::UserContent;
use rig::OneOrMany;

#[cfg(feature = "solana")]
use crate::signer::solana::LocalSolanaSigner;
#[cfg(feature = "solana")]
use crate::solana::agent::create_solana_agent;

#[derive(Deserialize)]
pub struct AgentActRequest {
    pub instruction: String,
    #[serde(default)]
    pub preamble: Option<String>,
}

#[derive(Serialize)]
#[serde(tag = "type", content = "content")]
pub enum AgentActEvent {
    Message(String),
    ToolCall { name: String, result: String },
}

#[derive(Serialize)]
pub struct AgentActResponse {
    pub events: Vec<AgentActEvent>,
}

fn configured_key() -> Option<String> {
    std::env::var("AGENT_BRIDGE_KEY")
        .ok()
        .filter(|s| !s.is_empty())
}

/// Rejects the request unless `X-Agent-Key` matches `AGENT_BRIDGE_KEY` exactly.
/// Fails closed: an unset `AGENT_BRIDGE_KEY` refuses every request rather than
/// falling back to "open".
fn authorize(req: &HttpRequest) -> Result<(), HttpResponse> {
    let Some(expected) = configured_key() else {
        return Err(HttpResponse::ServiceUnavailable().json(json!({
            "error": "agent bridge is not configured (AGENT_BRIDGE_KEY unset on this server)"
        })));
    };
    let provided = req
        .headers()
        .get("x-agent-key")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    if provided.is_empty() || provided != expected {
        return Err(
            HttpResponse::Unauthorized().json(json!({ "error": "missing or invalid X-Agent-Key" }))
        );
    }
    Ok(())
}

fn rpc_source() -> &'static str {
    match std::env::var("SOLANA_RPC_URL") {
        Ok(v) if !v.trim().is_empty() => "SOLANA_RPC_URL",
        _ => "default",
    }
}

#[get("/agent/health")]
pub async fn agent_health() -> HttpResponse {
    let solana_rpc_url = std::env::var("SOLANA_RPC_URL")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "bridge_configured": configured_key().is_some(),
        "signer_configured": std::env::var("SOLANA_PRIVATE_KEY")
            .map(|v| !v.is_empty())
            .unwrap_or(false),
        "rpc_source": rpc_source(),
        "solana_rpc_url": solana_rpc_url,
    }))
}

#[post("/agent/act")]
#[cfg(feature = "solana")]
pub async fn agent_act(req: HttpRequest, body: web::Json<AgentActRequest>) -> HttpResponse {
    if let Err(resp) = authorize(&req) {
        return resp;
    }

    let private_key = match std::env::var("SOLANA_PRIVATE_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => {
            return HttpResponse::ServiceUnavailable().json(json!({
                "error": "SOLANA_PRIVATE_KEY is not configured on this server"
            }))
        }
    };

    let agent = match create_solana_agent(body.preamble.clone()).await {
        Ok(agent) => Arc::new(agent),
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(json!({ "error": format!("failed to build agent: {e}") }))
        }
    };

    let signer: Arc<dyn TransactionSigner> = Arc::new(LocalSolanaSigner::new(private_key));
    let instruction = body.instruction.clone();

    let handle = spawn_with_signer(signer, move || async move {
        let reasoning_loop = ReasoningLoop::new(agent).with_stdout(false);
        let (tx, mut rx) = tokio::sync::mpsc::channel::<LoopResponse>(32);
        let messages = vec![Message::User {
            content: OneOrMany::one(UserContent::text(instruction)),
        }];

        let collector = tokio::spawn(async move {
            let mut events = Vec::new();
            while let Some(resp) = rx.recv().await {
                events.push(match resp {
                    LoopResponse::Message(text) => AgentActEvent::Message(text),
                    LoopResponse::ToolCall { name, result } => {
                        AgentActEvent::ToolCall { name, result }
                    }
                });
            }
            events
        });

        reasoning_loop.stream(messages, Some(tx)).await?;
        Ok(collector.await.unwrap_or_default())
    })
    .await // resolves the `spawn_with_signer` future itself, yielding the JoinHandle
    .await; // resolves the JoinHandle into Result<Result<Vec<AgentActEvent>>>

    match handle {
        Ok(Ok(events)) => HttpResponse::Ok().json(AgentActResponse { events }),
        Ok(Err(e)) => HttpResponse::InternalServerError().json(json!({ "error": e.to_string() })),
        Err(e) => HttpResponse::InternalServerError().json(json!({ "error": e.to_string() })),
    }
}

#[post("/agent/act")]
#[cfg(not(feature = "solana"))]
pub async fn agent_act(req: HttpRequest, _body: web::Json<AgentActRequest>) -> HttpResponse {
    if let Err(resp) = authorize(&req) {
        return resp;
    }
    HttpResponse::ServiceUnavailable().json(json!({
        "error": "this build was compiled without the 'solana' feature"
    }))
}
