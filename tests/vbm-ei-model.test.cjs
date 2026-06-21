const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createSeededRandom,
  createDefaultConfig,
  createSimulation,
  resetSimulation,
  stepSimulation,
} = require('../blog/vbm-ei-model.js');

test('相同 seed 產生相同亂數序列', () => {
  const a = createSeededRandom(20260622);
  const b = createSeededRandom(20260622);
  const seqA = Array.from({ length: 8 }, () => a());
  const seqB = Array.from({ length: 8 }, () => b());
  assert.deepEqual(seqA, seqB);
  assert.ok(seqA.every((value) => value >= 0 && value < 1));
});

test('建立模擬時使用固定 12 個 nodes 與明確 baseline', () => {
  const config = createDefaultConfig();
  const simulation = createSimulation(config);
  assert.equal(config.nodeCount, 12);
  assert.equal(simulation.nodes.length, 12);
  assert.equal(simulation.time, 0);
  assert.equal(simulation.seed, config.seed);
  assert.equal(simulation.preset, 'healthy');
});

test('reset 完整恢復 baseline state', () => {
  const simulation = createSimulation(createDefaultConfig({ seed: 17 }));
  stepSimulation(simulation, 20);
  const reset = resetSimulation(simulation);
  assert.equal(reset.time, 0);
  assert.equal(reset.seed, 17);
  assert.equal(reset.preset, 'healthy');
  assert.ok(reset.nodes.every((node) => node.state.every((value) => value === 0)));
  assert.equal(reset.history.global.length, 0);
});
