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

  function buildStructuralWeights() {
    const matrix = Array.from({ length: 12 }, () => Array(12).fill(0));
    const edges = [
      [0, 1, 0.55], [0, 2, 0.35], [1, 2, 0.65], [1, 3, 0.30],
      [2, 3, 0.75], [2, 4, 0.45], [2, 8, 0.70], [3, 4, 0.50],
      [4, 5, 0.60], [4, 8, 0.45], [5, 6, 0.55], [5, 9, 0.35],
      [6, 7, 0.60], [7, 8, 0.40], [8, 9, 0.75], [8, 10, 0.55],
      [9, 10, 0.50], [10, 11, 0.60], [2, 11, 0.30], [0, 11, 0.45],
    ];
    for (const [left, right, weight] of edges) {
      matrix[left][right] = weight;
      matrix[right][left] = weight;
    }
    return Object.freeze(matrix.map((row) => Object.freeze(row)));
  }

  const STRUCTURAL_WEIGHTS = buildStructuralWeights();

  const PRESETS = Object.freeze({
    healthy: {
      label: '健康平衡',
      changes: '使用 baseline Jansen–Rit 與全域耦合參數。',
      cannotInfer: '不能代表任何特定健康受試者。',
      global: {},
      nodeOverrides: {},
    },
    tauLong: {
      label: '抑制時間常數延長',
      changes: '將 tau_i 從 14 ms 延長至 35 ms；亦即降低 b。',
      cannotInfer: 'tau_i 延長不等同抑制總量減少。',
      global: { b: 1 / 0.035 },
      nodeOverrides: {},
    },
    hubHyper: {
      label: 'Hub hyperexcitability',
      changes: '提高 nodes 2、8 的外部 drive，並局部降低 B。',
      cannotInfer: '不能從此推論 amyloid 的真實區域負荷。',
      global: {},
      nodeOverrides: {
        2: { pOffset: 35, BScale: 0.82 },
        8: { pOffset: 35, BScale: 0.82 },
      },
    },
    widespread: {
      label: '廣泛網路失衡',
      changes: '提高 G、noise，並在多個 nodes 增加 drive。',
      cannotInfer: '不是 AD stage 或疾病嚴重度量表。',
      global: { globalCoupling: 0.16, noiseAmplitude: 3.2 },
      nodeOverrides: Object.fromEntries(
        [1, 2, 4, 6, 8, 10].map((node) => [node, { pOffset: 22, BScale: 0.9 }]),
      ),
    },
  });

  function normalNoise(random) {
    const u = Math.max(random(), 1e-12);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function resetDynamicState(simulation) {
    simulation.random = createSeededRandom(simulation.seed);
    simulation.time = 0;
    simulation.nodes = Array.from({ length: simulation.config.nodeCount }, createNode);
    simulation.history = createEmptyHistory();
    simulation.delayBuffer = [];
    simulation.unstable = false;
    return simulation;
  }

  function applyPreset(simulation, presetName) {
    const preset = PRESETS[presetName];
    if (!preset) throw new Error(`Unknown preset: ${presetName}`);
    simulation.config = { ...simulation.baselineConfig, ...preset.global };
    simulation.preset = presetName;
    simulation.nodeOverrides = preset.nodeOverrides;
    return resetDynamicState(simulation);
  }

  function resetSimulation(simulation) {
    simulation.config = { ...simulation.baselineConfig };
    simulation.preset = 'healthy';
    simulation.nodeOverrides = PRESETS.healthy.nodeOverrides;
    return resetDynamicState(simulation);
  }

  function getDelayedRates(simulation) {
    if (simulation.delayBuffer.length <= simulation.config.delaySteps) {
      return Array(simulation.config.nodeCount).fill(0);
    }
    return simulation.delayBuffer[
      simulation.delayBuffer.length - 1 - simulation.config.delaySteps
    ];
  }

  function trimHistory(simulation) {
    const maxSamples = Math.round(
      simulation.config.historySeconds / simulation.config.dt,
    );
    for (const key of ['global', 'selected', 'nodeOutputs']) {
      if (simulation.history[key].length > maxSamples) {
        simulation.history[key].splice(
          0,
          simulation.history[key].length - maxSamples,
        );
      }
    }
    if (simulation.delayBuffer.length > simulation.config.delaySteps + 2) {
      simulation.delayBuffer.splice(
        0,
        simulation.delayBuffer.length - simulation.config.delaySteps - 2,
      );
    }
  }

  function stepSimulation(simulation, steps = 1) {
    for (let step = 0; step < steps; step += 1) {
      const delayedRates = getDelayedRates(simulation);
      const nextStates = simulation.nodes.map((node, nodeIndex) => {
        const override = (simulation.nodeOverrides && simulation.nodeOverrides[nodeIndex]) || {};
        const localConfig = {
          ...simulation.config,
          B: simulation.config.B * (override.BScale || 1),
        };
        const networkInput = simulation.config.globalCoupling
          * STRUCTURAL_WEIGHTS[nodeIndex].reduce(
            (sum, weight, sourceIndex) => sum + weight * delayedRates[sourceIndex],
            0,
          );
        const externalInput = localConfig.p
          + (override.pOffset || 0)
          + localConfig.noiseAmplitude * normalNoise(simulation.random);
        return rk4Step(
          node.state,
          localConfig.dt,
          (candidate) => jansenRitDerivative(
            candidate,
            { externalInput, networkInput },
            localConfig,
          ),
        );
      });
      const outputs = nextStates.map((state) => state[1] - state[2]);
      const rates = outputs.map((output) => sigmoid(output));
      simulation.nodes.forEach((node, index) => {
        node.state = nextStates[index];
        node.output = outputs[index];
        node.firingRate = rates[index];
      });
      simulation.delayBuffer.push(rates);
      simulation.history.nodeOutputs.push(outputs);
      simulation.history.global.push(
        outputs.reduce((sum, value) => sum + value, 0) / outputs.length,
      );
      simulation.history.selected.push(outputs[simulation.selectedNode]);
      simulation.time += simulation.config.dt;
      simulation.unstable = nextStates.some(
        (state) => state.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e6),
      );
      trimHistory(simulation);
      if (simulation.unstable) break;
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

  function hannWindow(index, length) {
    return 0.5 * (1 - Math.cos((2 * Math.PI * index) / (length - 1)));
  }

  function computeSpectrum(signal, sampleRate, maxFrequency = 45) {
    if (signal.length < 8) return [];
    const mean = signal.reduce((sum, value) => sum + value, 0) / signal.length;
    const windowed = signal.map(
      (value, index) => (value - mean) * hannWindow(index, signal.length),
    );
    const maxBin = Math.min(
      Math.floor(maxFrequency * signal.length / sampleRate),
      Math.floor(signal.length / 2),
    );
    const spectrum = [];
    for (let bin = 1; bin <= maxBin; bin += 1) {
      let real = 0;
      let imaginary = 0;
      for (let index = 0; index < windowed.length; index += 1) {
        const angle = 2 * Math.PI * bin * index / windowed.length;
        real += windowed[index] * Math.cos(angle);
        imaginary -= windowed[index] * Math.sin(angle);
      }
      spectrum.push({
        frequency: bin * sampleRate / windowed.length,
        power: (real * real + imaginary * imaginary) / windowed.length ** 2,
      });
    }
    return spectrum;
  }

  function computeBandPower(spectrum, low, high) {
    return spectrum
      .filter((point) => point.frequency >= low && point.frequency < high)
      .reduce((sum, point) => sum + point.power, 0);
  }

  function pearson(left, right) {
    const length = Math.min(left.length, right.length);
    if (length < 3) return 0;
    const a = left.slice(-length);
    const b = right.slice(-length);
    const meanA = a.reduce((sum, value) => sum + value, 0) / length;
    const meanB = b.reduce((sum, value) => sum + value, 0) / length;
    let numerator = 0;
    let varianceA = 0;
    let varianceB = 0;
    for (let index = 0; index < length; index += 1) {
      const deltaA = a[index] - meanA;
      const deltaB = b[index] - meanB;
      numerator += deltaA * deltaB;
      varianceA += deltaA ** 2;
      varianceB += deltaB ** 2;
    }
    const denominator = Math.sqrt(varianceA * varianceB);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  function computeSynchrony(signals) {
    if (signals.length < 2) return 0;
    let sum = 0;
    let pairs = 0;
    for (let left = 0; left < signals.length; left += 1) {
      for (let right = left + 1; right < signals.length; right += 1) {
        sum += pearson(signals[left], signals[right]);
        pairs += 1;
      }
    }
    return pairs === 0 ? 0 : sum / pairs;
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
    STRUCTURAL_WEIGHTS,
    PRESETS,
    applyPreset,
    computeSpectrum,
    computeBandPower,
    computeSynchrony,
  };
}));
