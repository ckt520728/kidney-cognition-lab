(function startDashboard() {
  'use strict';
  const model = window.VBMEIModel;
  const dashboard = document.getElementById('vbm-dashboard');
  if (!model || !dashboard) return;

  const simulation = model.createSimulation(model.createDefaultConfig());
  model.applyPreset(simulation, 'healthy');
  let running = true;
  let lastFrame = 0;

  const controls = [
    { key: 'p', label: '外部輸入 p', min: 70, max: 180, step: 1, format: (v) => `${v.toFixed(0)} s⁻¹` },
    { key: 'A', label: '興奮增益 A', min: 2.0, max: 5.0, step: 0.05, format: (v) => v.toFixed(2) },
    { key: 'B', label: '抑制增益 B', min: 12, max: 35, step: 0.5, format: (v) => v.toFixed(1) },
    {
      key: 'tau_i',
      label: '抑制時間常數 tau_i',
      min: 10,
      max: 50,
      step: 1,
      format: (v) => `${v.toFixed(0)} ms`,
      read: () => 1000 / simulation.config.b,
      write: (v) => { simulation.config.b = 1000 / v; },
    },
    { key: 'globalCoupling', label: '全域耦合 G', min: 0, max: 0.25, step: 0.01, format: (v) => v.toFixed(2) },
    { key: 'noiseAmplitude', label: 'Noise', min: 0, max: 6, step: 0.1, format: (v) => v.toFixed(1) },
  ];

  function renderControls() {
    const root = document.getElementById('controls');
    root.replaceChildren();
    controls.forEach((control) => {
      const value = control.read ? control.read() : simulation.config[control.key];
      const row = document.createElement('div');
      row.className = 'control-row';
      row.innerHTML = `
        <label for="control-${control.key}">
          <span>${control.label}</span>
          <output id="output-${control.key}">${control.format(value)}</output>
        </label>
        <input id="control-${control.key}" type="range"
          min="${control.min}" max="${control.max}" step="${control.step}" value="${value}">`;
      const input = row.querySelector('input');
      input.addEventListener('input', () => {
        const next = Number(input.value);
        if (control.write) control.write(next);
        else simulation.config[control.key] = next;
        row.querySelector('output').textContent = control.format(next);
      });
      root.append(row);
    });
  }

  function selectPreset(name) {
    model.applyPreset(simulation, name);
    document.querySelectorAll('.preset-button').forEach((button) => {
      button.classList.toggle('active', button.dataset.preset === name);
    });
    const preset = model.PRESETS[name];
    document.getElementById('preset-explanation').textContent = preset.changes;
    document.getElementById('preset-limit').textContent = `不能推論：${preset.cannotInfer}`;
    renderControls();
  }

  document.getElementById('preset-grid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-preset]');
    if (button) selectPreset(button.dataset.preset);
  });
  document.getElementById('pause-button').addEventListener('click', (event) => {
    running = !running;
    event.currentTarget.textContent = running ? '暫停' : '繼續';
  });
  document.getElementById('reset-button').addEventListener('click', () => {
    model.resetSimulation(simulation);
    document.getElementById('pause-button').textContent = '暫停';
    running = true;
    selectPreset('healthy');
  });

  function setupCanvas(id) {
    const canvas = document.getElementById(id);
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || canvas.width;
    const cssHeight = canvas.clientHeight || canvas.height;
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { canvas, context, width: cssWidth, height: cssHeight };
  }

  function clearPlot(plot) {
    plot.context.clearRect(0, 0, plot.width, plot.height);
    plot.context.fillStyle = '#08101f';
    plot.context.fillRect(0, 0, plot.width, plot.height);
  }

  function normalize(value, min, max) {
    return max === min ? 0.5 : (value - min) / (max - min);
  }

  function colorForActivity(value, min, max) {
    const unit = Math.max(0, Math.min(1, normalize(value, min, max)));
    const red = Math.round(77 + 167 * unit);
    const green = Math.round(217 - 55 * unit);
    const blue = Math.round(207 - 110 * unit);
    return `rgb(${red}, ${green}, ${blue})`;
  }

  const nodePositions = Array.from({ length: 12 }, (_, index) => {
    const angle = -Math.PI / 2 + 2 * Math.PI * index / 12;
    return { x: 0.5 + 0.40 * Math.cos(angle), y: 0.5 + 0.38 * Math.sin(angle) };
  });

  function drawNetwork() {
    const plot = setupCanvas('network-canvas');
    clearPlot(plot);
    const outputs = simulation.nodes.map((node) => node.output);
    const min = Math.min(...outputs, -1);
    const max = Math.max(...outputs, 1);
    for (let left = 0; left < 12; left += 1) {
      for (let right = left + 1; right < 12; right += 1) {
        const weight = model.STRUCTURAL_WEIGHTS[left][right];
        if (!weight) continue;
        plot.context.strokeStyle = `rgba(139,92,246,${0.12 + 0.45 * weight})`;
        plot.context.lineWidth = 1 + 2 * weight;
        plot.context.beginPath();
        plot.context.moveTo(nodePositions[left].x * plot.width, nodePositions[left].y * plot.height);
        plot.context.lineTo(nodePositions[right].x * plot.width, nodePositions[right].y * plot.height);
        plot.context.stroke();
      }
    }
    nodePositions.forEach((position, index) => {
      const radius = index === 2 || index === 8 ? 17 : 13;
      plot.context.fillStyle = colorForActivity(outputs[index], min, max);
      plot.context.beginPath();
      plot.context.arc(position.x * plot.width, position.y * plot.height, radius, 0, 2 * Math.PI);
      plot.context.fill();
      plot.context.fillStyle = '#e8f4f8';
      plot.context.font = '12px JetBrains Mono';
      plot.context.textAlign = 'center';
      plot.context.fillText(String(index + 1), position.x * plot.width, position.y * plot.height + 4);
    });
  }

  function drawLinePlot(canvasId, series, color) {
    const plot = setupCanvas(canvasId);
    clearPlot(plot);
    if (series.length < 2) return;
    const min = Math.min(...series);
    const max = Math.max(...series);
    plot.context.strokeStyle = color;
    plot.context.lineWidth = 1.5;
    plot.context.beginPath();
    series.forEach((value, index) => {
      const x = index * plot.width / (series.length - 1);
      const y = plot.height - normalize(value, min, max) * plot.height;
      if (index === 0) plot.context.moveTo(x, y);
      else plot.context.lineTo(x, y);
    });
    plot.context.stroke();
  }

  function drawSpectrum(spectrum) {
    const plot = setupCanvas('spectrum-canvas');
    clearPlot(plot);
    if (spectrum.length < 2) return;
    const maxPower = Math.max(...spectrum.map((point) => point.power), 1e-12);
    plot.context.strokeStyle = '#f4a261';
    plot.context.lineWidth = 2;
    plot.context.beginPath();
    spectrum.forEach((point, index) => {
      const x = point.frequency / 45 * plot.width;
      const y = plot.height - point.power / maxPower * plot.height;
      if (index === 0) plot.context.moveTo(x, y);
      else plot.context.lineTo(x, y);
    });
    plot.context.stroke();
  }

  function updateMetrics() {
    const decimation = Math.max(1, Math.round(1 / (simulation.config.dt * 200)));
    const globalSignal = simulation.history.global.filter((_, index) => index % decimation === 0);
    const sampleRate = 1 / simulation.config.dt / decimation;
    const spectrum = model.computeSpectrum(globalSignal.slice(-400), sampleRate);
    const theta = model.computeBandPower(spectrum, 4, 8);
    const alpha = model.computeBandPower(spectrum, 8, 13);
    const nodeSignals = Array.from({ length: 12 }, (_, nodeIndex) => (
      simulation.history.nodeOutputs
        .filter((_, index) => index % decimation === 0)
        .slice(-200)
        .map((row) => row[nodeIndex])
    ));
    const synchrony = model.computeSynchrony(nodeSignals);
    document.getElementById('theta-value').textContent = theta.toExponential(2);
    document.getElementById('alpha-value').textContent = alpha.toExponential(2);
    document.getElementById('ratio-value').textContent = alpha > 0 ? (theta / alpha).toFixed(2) : '—';
    document.getElementById('sync-value').textContent = synchrony.toFixed(2);
    document.getElementById('model-status').textContent =
      `${model.PRESETS[simulation.preset].label} · seed ${simulation.seed} · dt ${(simulation.config.dt * 1000).toFixed(1)} ms`;
    drawNetwork();
    drawLinePlot('trace-canvas', globalSignal, '#4dd9cf');
    drawSpectrum(spectrum);
  }

  function frame(timestamp) {
    if (running && !simulation.unstable) {
      const elapsed = Math.min(50, timestamp - lastFrame);
      const steps = Math.max(1, Math.round(elapsed / 1000 / simulation.config.dt));
      model.stepSimulation(simulation, Math.min(steps, 100));
    }
    if (simulation.unstable) {
      running = false;
      document.getElementById('model-status').textContent =
        '參數超出穩定展示區，請按「重設」。';
    }
    updateMetrics();
    lastFrame = timestamp;
    window.requestAnimationFrame(frame);
  }

  renderControls();
  selectPreset('healthy');
  window.requestAnimationFrame(frame);
}());
