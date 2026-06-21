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

  return {
    BASELINE,
    createSeededRandom,
    createDefaultConfig,
    createSimulation,
    resetSimulation,
    stepSimulation,
  };
}));
