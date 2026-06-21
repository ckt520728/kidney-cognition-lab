const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createSeededRandom,
  createDefaultConfig,
  createSimulation,
  resetSimulation,
  stepSimulation,
  sigmoid,
  jansenRitDerivative,
  rk4Step,
  STRUCTURAL_WEIGHTS,
  PRESETS,
  applyPreset,
  computeSpectrum,
  computeBandPower,
  computeSynchrony,
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

test('sigmoid 在 membrane potential 增加時單調上升', () => {
  assert.ok(sigmoid(-5) < sigmoid(0));
  assert.ok(sigmoid(0) < sigmoid(10));
  assert.ok(sigmoid(10) <= 5);
});

test('Jansen-Rit derivative 回傳六個有限狀態導數', () => {
  const config = createDefaultConfig();
  const derivative = jansenRitDerivative(
    [0, 0, 0, 0, 0, 0],
    { externalInput: config.p, networkInput: 0 },
    config,
  );
  assert.equal(derivative.length, 6);
  assert.ok(derivative.every(Number.isFinite));
});

test('RK4 在 baseline 下維持有限值', () => {
  const config = createDefaultConfig();
  let state = Array(6).fill(0);
  for (let index = 0; index < 4000; index += 1) {
    state = rk4Step(
      state,
      config.dt,
      (candidate) => jansenRitDerivative(
        candidate,
        { externalInput: config.p, networkInput: 0 },
        config,
      ),
    );
  }
  assert.ok(state.every(Number.isFinite));
  assert.ok(Math.max(...state.map(Math.abs)) < 1e5);
});

test('提高 inhibitory gain B 會降低穩態平均 pyramidal output', () => {
  function meanOutput(B) {
    const config = createDefaultConfig({ B, noiseAmplitude: 0 });
    let state = Array(6).fill(0);
    let sum = 0;
    let count = 0;
    for (let index = 0; index < 8000; index += 1) {
      state = rk4Step(
        state,
        config.dt,
        (candidate) => jansenRitDerivative(
          candidate,
          { externalInput: config.p, networkInput: 0 },
          config,
        ),
      );
      if (index >= 4000) {
        sum += state[1] - state[2];
        count += 1;
      }
    }
    return sum / count;
  }
  assert.ok(meanOutput(28) < meanOutput(16));
});

test('結構矩陣為 12×12、對稱且 diagonal 為零', () => {
  assert.equal(STRUCTURAL_WEIGHTS.length, 12);
  for (let row = 0; row < 12; row += 1) {
    assert.equal(STRUCTURAL_WEIGHTS[row].length, 12);
    assert.equal(STRUCTURAL_WEIGHTS[row][row], 0);
    for (let col = 0; col < 12; col += 1) {
      assert.equal(STRUCTURAL_WEIGHTS[row][col], STRUCTURAL_WEIGHTS[col][row]);
    }
  }
});

test('同 seed 與 preset 的 whole-brain output 可重現', () => {
  const first = createSimulation(createDefaultConfig({ seed: 99 }));
  const second = createSimulation(createDefaultConfig({ seed: 99 }));
  applyPreset(first, 'healthy');
  applyPreset(second, 'healthy');
  stepSimulation(first, 600);
  stepSimulation(second, 600);
  assert.deepEqual(first.history.global, second.history.global);
});

test('所有 presets 都有顯示名稱、改變參數與限制說明', () => {
  for (const key of ['healthy', 'tauLong', 'hubHyper', 'widespread']) {
    assert.equal(typeof PRESETS[key].label, 'string');
    assert.equal(typeof PRESETS[key].changes, 'string');
    assert.equal(typeof PRESETS[key].cannotInfer, 'string');
  }
});

test('hub hyperexcitability 提高指定 hubs 的平均活動', () => {
  const healthy = createSimulation(createDefaultConfig({ seed: 44 }));
  const hub = createSimulation(createDefaultConfig({ seed: 44 }));
  applyPreset(healthy, 'healthy');
  applyPreset(hub, 'hubHyper');
  stepSimulation(healthy, 1200);
  stepSimulation(hub, 1200);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const healthyHub = mean(healthy.history.nodeOutputs.slice(-400).map((row) => (row[2] + row[8]) / 2));
  const activeHub = mean(hub.history.nodeOutputs.slice(-400).map((row) => (row[2] + row[8]) / 2));
  assert.ok(activeHub > healthyHub);
});

test('spectrum 可辨識 10 Hz 正弦波', () => {
  const sampleRate = 200;
  const signal = Array.from(
    { length: 400 },
    (_, index) => Math.sin(2 * Math.PI * 10 * index / sampleRate),
  );
  const spectrum = computeSpectrum(signal, sampleRate);
  const peak = spectrum.reduce((best, current) => (
    current.power > best.power ? current : best
  ));
  assert.ok(Math.abs(peak.frequency - 10) <= 0.5);
  assert.ok(computeBandPower(spectrum, 8, 13) > computeBandPower(spectrum, 4, 8));
});

test('完全相同訊號的 synchrony 為 1', () => {
  const signal = [0, 1, 0, -1, 0, 1, 0, -1];
  assert.ok(Math.abs(computeSynchrony([signal, signal, signal]) - 1) < 1e-12);
});
