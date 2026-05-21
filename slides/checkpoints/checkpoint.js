const checkpointData = {
  "1": {
    mode: "quiz",
    answer: "D",
    resultTitle: "答案: D",
    explanation: "BPTT 在混沌系統中梯度兩種病態都可能發生,加上反饋路徑被自然動力學持續放大,訓練極度不穩定。早期 ESN 用 clamping 反饋來避開,但生物上不自然。FORCE 的突破是允許反饋完整保留,改用 RLS 在每一步即時控制誤差。"
  },
  "2": {
    mode: "quiz",
    answer: "C",
    resultTitle: "答案: C",
    explanation: "鞍點是分水嶺。輸入脈衝把軌跡推過鞍點後,沿異宿軌完成「狀態 A 到狀態 B」的邏輯跳轉。"
  },
  "3": {
    mode: "quiz",
    answer: "C",
    resultTitle: "答案: C",
    explanation: "heading direction 是連續角度變量 0 到 360 度,需要一個閉合的一維流形才能穩定表示。"
  },
  "4": {
    mode: "poll",
    resultTitle: "投票已送出",
    explanation: "沒有標準答案。這題可以用來開啟下一輪討論:不同案例其實對應了不同層次的神經運算想像。"
  },
  "5": {
    mode: "poll",
    resultTitle: "立場已記錄",
    explanation: "真實答案可能在 C: motif 提供歸納偏置,attention 提供可擴展性。動力幾何與大規模預訓練不必互斥,它們回答的是不同層次的問題。"
  }
};

const root = document.querySelector("[data-checkpoint]");
const id = root?.dataset.checkpoint;
const data = checkpointData[id];
const options = Array.from(document.querySelectorAll(".option"));
const submitButton = document.querySelector("[data-submit]");
const resetButton = document.querySelector("[data-reset]");
const feedback = document.querySelector("[data-feedback]");
const feedbackTitle = document.querySelector("[data-feedback-title]");
const feedbackBody = document.querySelector("[data-feedback-body]");
const pollBars = document.querySelector("[data-poll-bars]");
let selected = null;
let submitted = false;

function voteKey() {
  return `sussillo-checkpoint-${id}-votes`;
}

function getCounts() {
  const empty = { A: 0, B: 0, C: 0, D: 0 };
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(voteKey()) || "{}") };
  } catch {
    return empty;
  }
}

function saveCounts(counts) {
  localStorage.setItem(voteKey(), JSON.stringify(counts));
}

function setSelected(letter) {
  if (submitted && data.mode === "quiz") return;
  selected = letter;
  submitButton.disabled = false;
  options.forEach((button) => {
    button.classList.toggle("selected", button.dataset.option === selected);
  });
}

function showFeedback(kind = "success") {
  feedbackTitle.textContent = data.resultTitle;
  feedbackBody.textContent = data.explanation;
  feedback.classList.add("show");
  feedback.classList.toggle("warn", kind === "warn");
}

function renderPollBars() {
  if (!pollBars) return;
  const counts = getCounts();
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  pollBars.innerHTML = "";
  options.forEach((button) => {
    const letter = button.dataset.option;
    const percent = total ? Math.round((counts[letter] / total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "poll-row";
    row.innerHTML = `
      <strong>${letter}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
      <span>${percent}%</span>
    `;
    pollBars.appendChild(row);
  });
}

function submit() {
  if (!selected) return;
  submitted = true;
  if (data.mode === "quiz") {
    options.forEach((button) => {
      const letter = button.dataset.option;
      button.classList.toggle("correct", letter === data.answer);
      button.classList.toggle("incorrect", letter === selected && selected !== data.answer);
    });
    const correct = selected === data.answer;
    showFeedback(correct ? "success" : "warn");
    feedbackTitle.textContent = correct ? data.resultTitle : `再看一次:正確答案是 ${data.answer}`;
    submitButton.disabled = true;
    return;
  }

  const counts = getCounts();
  counts[selected] += 1;
  saveCounts(counts);
  options.forEach((button) => {
    button.disabled = true;
  });
  renderPollBars();
  showFeedback("success");
  submitButton.disabled = true;
}

function reset() {
  selected = null;
  submitted = false;
  submitButton.disabled = true;
  feedback.classList.remove("show", "warn");
  options.forEach((button) => {
    button.disabled = false;
    button.classList.remove("selected", "correct", "incorrect");
  });
}

options.forEach((button) => {
  button.addEventListener("click", () => setSelected(button.dataset.option));
});

submitButton?.addEventListener("click", submit);
resetButton?.addEventListener("click", reset);
renderPollBars();
