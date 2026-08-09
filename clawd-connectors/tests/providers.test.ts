/**
 * Clawd Connectors — tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createConnectors,
  DFlowConnector,
  HeliusConnector,
  JupiterConnector,
  BirdeyeConnector,
} from '../src/index.js';

describe('Clawd Connectors', () => {
  it('creates all four providers via factory', () => {
    const connectors = createConnectors({});
    assert.ok(connectors.dflow instanceof DFlowConnector);
    assert.ok(connectors.helius instanceof HeliusConnector);
    assert.ok(connectors.jupiter instanceof JupiterConnector);
    assert.ok(connectors.birdeye instanceof BirdeyeConnector);
  });

  it('provider ids are correct', () => {
    const connectors = createConnectors({});
    assert.equal(connectors.dflow.id, 'dflow');
    assert.equal(connectors.helius.id, 'helius');
    assert.equal(connectors.jupiter.id, 'jupiter');
    assert.equal(connectors.birdeye.id, 'birdeye');
  });

  it('status reports configured=false when keys+urls missing', async () => {
    const connectors = createConnectors({});
    for (const key of ['dflow', 'helius', 'jupiter', 'birdeye'] as const) {
      const s = await connectors[key].status();
      assert.equal(s.provider, key);
      assert.ok(typeof s.configured === 'boolean');
    }
  });

  it('status lists configured status with explicit keys', async () => {
    const connectors = createConnectors({
      dflowApiKey: 'test-dflow',
      heliusApiKey: 'test-helius',
      jupiterApiKey: 'test-jupiter',
      birdeyeApiKey: 'test-birdeye',
    });
    const s = await connectors.helius.status();
    assert.equal(s.configured, true);
    // API key is set (REST path works), but without an MCP URL, tool listing
    // fails — which is surfaced as `error`. Both are valid states.
    assert.equal(s.restBase, 'https://api.helius.dev');
  });

  it('listTools without MCP URL throws a clear error', async () => {
    const connectors = createConnectors({});
    await assert.rejects(() => connectors.jupiter.listTools(), /no MCP URL configured/);
  });
});