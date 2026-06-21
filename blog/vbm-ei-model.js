(function attachVBMEIModel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VBMEIModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function buildVBMEIModel() {
  'use strict';

  const BASELINE = Object.freeze({
    nodeCount: 12,
    seed: 20260622,
    dt: 0.0005,
    sampleRate: 2000,
    A: 3.25,
    B: 22.0,
    a: 100.0,
    b: 71.4285714286,
    C: 135.0,
    p: 120.0,
    noiseAmplitude: 2.0,
    globalCoupling: 0.08,
    delaySteps: 20,
    historySeconds: 2.0,
  });

  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return function random() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createDefaultConfig(overrides = {}) {
    return { ...BASELINE, ...overrides };
  }

  function createNode() {
    return { state: Array(6).fill(0), output: 0, firingRate: 0 };
  }

  function createEmptyHistory() {
    return { global: [], selected: [], nodeOutputs: [] };
  }

  function createSimulation(config = createDefaultConfig()) {
    return {
      config: { ...config },
      baselineConfig: { ...config },
      seed: config.seed,
      random: createSeededRandom(config.seed),
      time: 0,
      preset: 'healthy',
      nodes: Array.from({ length: config.nodeCount }, createNode),
      history: createEmptyHistory(),
      delayBuffer: [],
      selectedNode: 0,
      unstable: false,
    };
  }

  function resetSimulation(simulation) {
    const clean = createSimulation(simulation.baselineConfig);
    Object.keys(simulation).forEach((key) => delete simulation[key]);
    Object.assign(simulation, clean);
    return simulation;
  }

  function stepSimulation(simulation, steps = 1) {
    for (let index = 0; index < steps; index += 1) {
      simulation.time += simulation.config.dt;
    }
    return simulation;
  }

  function sigmoid(v, e0 = 2.5, v0 = 6.0, r = 0.56) {
    const exponent = Math.max(-60, Math.min(60, r * (v0 - v)));
    return (2 * e0) / (1 + Math.exp(exponent));
  }

  function jansenRitDerivative(state, input, config) {
    const [y0, y1, y2, z0, z1, z2] = state;
    const C1 = config.C;
    const C2 = 0.8 * config.C;
    const C3 = 0.25 * config.C;
    const C4 = 0.25 * config.C;
    const pyramidalPotential = y1 - y2;
    const pyramidalRate = sigmoid(pyramidalPotential);
    const excitatoryRate = sigmoid(C1 * y0);
    const inhibitoryRate = sigmoid(C3 * y0);
    const drive = input.externalInput + input.networkInput;
    return [
      z0,
      z1,
      z2,
      config.A * config.a * pyramidalRate - 2 * config.a * z0 - config.a ** 2 * y0,
      config.A * config.a * (drive + C2 * excitatoryRate)
        - 2 * config.a * z1 - config.a ** 2 * y1,
      config.B * config.b * C4 * inhibitoryRate
        - 2 * config.b * z2 - config.b ** 2 * y2,
    ];
  }

  function addScaled(base, delta, scale) {
    return base.map((value, index) => value + delta[index] * scale);
  }

  function rk4Step(state, dt, derivative) {
    const k1 = derivative(state);
    const k2 = derivative(addScaled(state, k1, dt / 2));
    const k3 = derivative(addScaled(state, k2, dt / 2));
    const k4 = derivative(addScaled(state, k3, dt));
    return state.map(
      (value, index) => value
        + (dt / 6) * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]),
    );
  }

  return {
    BASELINE,
    createSeededRandom,
    createDefaultConfig,
    createSimulation,
    resetSimulation,
    stepSimulation,
    sigmoid,
    jansenRitDerivative,
    rk4Step,
  };
}));
