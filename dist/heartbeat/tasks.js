/**
 * Built-in Heartbeat Tasks
 *
 * These tasks run on the heartbeat schedule even while the agent sleeps.
 * They can trigger the agent to wake up if needed.
 */
import { getSurvivalTier } from "../conway/credits.js";
import { getUsdcBalance } from "../conway/x402.js";
import { checkResources, formatResourceReport } from "../survival/monitor.js";
import { recordTransition } from "../survival/low-compute.js";
import { executeFundingStrategies } from "../survival/funding.js";
/**
 * Registry of built-in heartbeat tasks.
 */
export const BUILTIN_TASKS = {
    heartbeat_ping: async (ctx) => {
        const credits = await ctx.conway.getCreditsBalance();
        const state = ctx.db.getAgentState();
        const startTime = ctx.db.getKV("start_time") || new Date().toISOString();
        const uptimeMs = Date.now() - new Date(startTime).getTime();
        const tier = getSurvivalTier(credits);
        const payload = {
            name: ctx.config.name,
            address: ctx.identity.address,
            state,
            creditsCents: credits,
            uptimeSeconds: Math.floor(uptimeMs / 1000),
            version: ctx.config.version,
            sandboxId: ctx.identity.sandboxId,
            timestamp: new Date().toISOString(),
            tier,
        };
        ctx.db.setKV("last_heartbeat_ping", JSON.stringify(payload));
        // If critical or dead, record a distress signal
        if (tier === "critical" || tier === "dead") {
            const distressPayload = {
                level: tier,
                name: ctx.config.name,
                address: ctx.identity.address,
                creditsCents: credits,
                fundingHint: "Use credit transfer API from a creator runtime to top this wallet up.",
                timestamp: new Date().toISOString(),
            };
            ctx.db.setKV("last_distress", JSON.stringify(distressPayload));
            return {
                shouldWake: true,
                message: `Distress: ${tier}. Credits: $${(credits / 100).toFixed(2)}. Need funding.`,
            };
        }
        return { shouldWake: false };
    },
    check_credits: async (ctx) => {
        // Full survival monitor path (credits + USDC + sandbox + tier KV)
        const status = await checkResources(ctx.identity, ctx.conway, ctx.db);
        const { tier, financial, tierChanged, previousTier } = status;
        ctx.db.setKV("last_credit_check", JSON.stringify({
            credits: financial.creditsCents,
            tier,
            usdc: financial.usdcBalance,
            sandboxHealthy: status.sandboxHealthy,
            report: formatResourceReport(status),
            timestamp: financial.lastChecked,
        }));
        // Apply tier restrictions when we can (inference optional on heartbeat)
        // Record transitions and escalate funding via survival package
        const prevTier = ctx.db.getKV("prev_credit_tier") ||
            previousTier;
        ctx.db.setKV("prev_credit_tier", tier);
        if (prevTier && prevTier !== tier) {
            recordTransition(ctx.db, prevTier, tier, financial.creditsCents);
            try {
                await executeFundingStrategies(tier, ctx.identity, ctx.config, ctx.db, ctx.conway);
            }
            catch {
                /* funding is best-effort on heartbeat */
            }
        }
        else if (tierChanged && previousTier) {
            recordTransition(ctx.db, previousTier, tier, financial.creditsCents);
        }
        if ((prevTier && prevTier !== tier && (tier === "critical" || tier === "dead")) ||
            (tierChanged && (tier === "critical" || tier === "dead"))) {
            return {
                shouldWake: true,
                message: `Credits dropped to ${tier} tier: $${(financial.creditsCents / 100).toFixed(2)}`,
            };
        }
        return { shouldWake: false };
    },
    check_usdc_balance: async (ctx) => {
        const balance = await getUsdcBalance(ctx.identity.address);
        ctx.db.setKV("last_usdc_check", JSON.stringify({
            balance,
            timestamp: new Date().toISOString(),
        }));
        // If we have USDC but low credits, wake up to potentially convert
        const credits = await ctx.conway.getCreditsBalance();
        if (balance > 0.5 && credits < 500) {
            return {
                shouldWake: true,
                message: `Have ${balance.toFixed(4)} USDC but only $${(credits / 100).toFixed(2)} credits. Consider buying credits.`,
            };
        }
        return { shouldWake: false };
    },
    check_social_inbox: async (ctx) => {
        if (!ctx.social)
            return { shouldWake: false };
        const cursor = ctx.db.getKV("social_inbox_cursor") || undefined;
        const { messages, nextCursor } = await ctx.social.poll(cursor);
        if (messages.length === 0)
            return { shouldWake: false };
        // Persist to inbox_messages table for deduplication
        let newCount = 0;
        for (const msg of messages) {
            const existing = ctx.db.getKV(`inbox_seen_${msg.id}`);
            if (!existing) {
                ctx.db.insertInboxMessage(msg);
                ctx.db.setKV(`inbox_seen_${msg.id}`, "1");
                newCount++;
            }
        }
        if (nextCursor)
            ctx.db.setKV("social_inbox_cursor", nextCursor);
        if (newCount === 0)
            return { shouldWake: false };
        return {
            shouldWake: true,
            message: `${newCount} new message(s) from: ${messages.map((m) => m.from.slice(0, 10)).join(", ")}`,
        };
    },
    check_for_updates: async (ctx) => {
        try {
            const { checkUpstream, getRepoInfo } = await import("../self-mod/upstream.js");
            const repo = getRepoInfo();
            const upstream = checkUpstream();
            ctx.db.setKV("upstream_status", JSON.stringify({
                ...upstream,
                ...repo,
                checkedAt: new Date().toISOString(),
            }));
            if (upstream.behind > 0) {
                return {
                    shouldWake: true,
                    message: `${upstream.behind} new commit(s) on origin/main. Review with review_upstream_changes, then cherry-pick what you want with pull_upstream.`,
                };
            }
            return { shouldWake: false };
        }
        catch (err) {
            // Not a git repo or no remote — silently skip
            ctx.db.setKV("upstream_status", JSON.stringify({
                error: err.message,
                checkedAt: new Date().toISOString(),
            }));
            return { shouldWake: false };
        }
    },
    health_check: async (ctx) => {
        // Check that the sandbox is healthy
        try {
            const result = await ctx.conway.exec("echo alive", 5000);
            if (result.exitCode !== 0) {
                return {
                    shouldWake: true,
                    message: "Health check failed: sandbox exec returned non-zero",
                };
            }
        }
        catch (err) {
            return {
                shouldWake: true,
                message: `Health check failed: ${err.message}`,
            };
        }
        ctx.db.setKV("last_health_check", new Date().toISOString());
        return { shouldWake: false };
    },
};
//# sourceMappingURL=tasks.js.map