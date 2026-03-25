/* ============================================================
   FinSight AI — script.js
   All API calls, Chart.js charts, DOM logic, navigation
   ============================================================ */

'use strict';

/* ── API Base URL ─────────────────────────────────────────── */
const API_BASE = 'http://127.0.0.1:5000';

/* ── Chart instances (stored for destroy/rebuild) ─────────── */
let donutChartInstance  = null;
let gaugeChartInstance  = null;
let barChartInstance    = null;

/* ============================================================
   SHARED UTILITIES
============================================================ */

/**
 * Show the loading spinner overlay
 * @param {string} message - optional custom message
 */
function showSpinner(message) {
  const spinner = document.getElementById('loadingSpinner');
  if (!spinner) return;
  const text = spinner.querySelector('.spinner-text');
  if (text && message) text.textContent = message;
  spinner.style.display = 'flex';
}

/** Hide the loading spinner */
function hideSpinner() {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = 'none';
}

/**
 * Show an error banner
 * @param {string} message
 */
function showError(message) {
  const banner   = document.getElementById('errorBanner');
  const errorTxt = document.getElementById('errorText');
  if (!banner) return;
  if (errorTxt) errorTxt.textContent = message;
  banner.style.display = 'flex';
}

/** Dismiss error banner (called by the ✕ button) */
function dismissError() {
  const banner = document.getElementById('errorBanner');
  if (banner) banner.style.display = 'none';
}

/**
 * Toggle button loading state
 * @param {string} btnId     - button element id
 * @param {string} textId    - span id that holds button text
 * @param {boolean} loading  - true = show loading state
 * @param {string} loadingText
 * @param {string} defaultText
 */
function setButtonLoading(btnId, textId, loading, loadingText = 'Analyzing…', defaultText = 'Analyze') {
  const btn  = document.getElementById(btnId);
  const text = document.getElementById(textId);
  if (!btn) return;
  if (loading) {
    btn.disabled    = true;
    btn.style.opacity = '0.7';
    if (text) text.textContent = loadingText;
  } else {
    btn.disabled    = false;
    btn.style.opacity = '1';
    if (text) text.textContent = defaultText;
  }
}

/**
 * Animate a number counter
 * @param {HTMLElement} el
 * @param {number} target
 * @param {number} duration  ms
 */
function animateCounter(el, target, duration = 1200) {
  if (!el) return;
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) {
      start = target;
      clearInterval(timer);
    }
    el.textContent = Math.round(start);
  }, 16);
}

/** Timestamp string for results */
function nowString() {
  return new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/** Map sentiment score → label + color + emoji */
function classifySentiment(score) {
  if (score >= 65) return { label: 'Positive', color: '#00c853', glow: '#00c85355', emoji: '📈' };
  if (score <= 35) return { label: 'Negative', color: '#ff5252', glow: '#ff525255', emoji: '📉' };
  return            { label: 'Neutral',  color: '#d4af37', glow: '#d4af3755', emoji: '➡️' };
}

/** Map risk score → level config */
function classifyRisk(score) {
  if (score <= 30) return { label: 'LOW RISK',    color: '#00c853', desc: 'Your portfolio shows strong positive market sentiment. Holdings appear stable with low downside risk based on current news.' };
  if (score <= 70) return { label: 'MEDIUM RISK', color: '#d4af37', desc: 'Your portfolio has mixed sentiment signals. Some holdings show positive trends while others face headwinds. Monitor closely.' };
  return                 { label: 'HIGH RISK',   color: '#ff5252', desc: 'Your portfolio faces significant negative sentiment pressure. Consider reviewing or hedging high-risk positions.' };
}

/* ============================================================
   MOCK FALLBACK DATA
   Used when the backend is unavailable (demo / hackathon mode)
============================================================ */

/**
 * Generate plausible mock data for a single stock analysis
 * @param {string} company
 */
function mockAnalyze(company) {
  const seed  = company.length * 7 + company.charCodeAt(0);
  const score = 30 + (seed % 55); // 30–84 range for demo variety
  const sent  = classifySentiment(score);
  const summaries = {
    Positive: `Recent news coverage for ${company} has been overwhelmingly favorable. Analysts highlight strong quarterly earnings, robust revenue growth, and strategic expansion plans. Institutional investors are showing increased confidence, while the management has provided upbeat forward guidance.`,
    Negative: `Recent coverage of ${company} reflects significant bearish headwinds. Reports cite concerns around margin compression, regulatory scrutiny, and weaker-than-expected guidance. Several brokerages have revised their target prices downward amid persistent macro uncertainty.`,
    Neutral:  `News sentiment for ${company} remains balanced. While the company maintains stable fundamentals, market participants are awaiting clarity on upcoming quarterly results and sector-wide policy changes before taking decisive positions.`
  };
  return {
    company,
    score,
    sentiment: sent.label,
    summary:   summaries[sent.label],
    positive:  sent.label === 'Positive' ? score : Math.max(10, score - 30),
    negative:  sent.label === 'Negative' ? 100 - score : Math.max(5, 40 - score),
    neutral:   100 - score,
    confidence: `${72 + (seed % 20)}%`,
    news_volume: `${120 + seed * 3} articles`
  };
}

/**
 * Generate mock portfolio data
 */
function mockPortfolio(stocks) {
  const results = stocks.map(s => {
    const seed  = s.length * 7 + s.charCodeAt(0);
    const score = 25 + (seed % 60);
    return { stock: s, score, sentiment: classifySentiment(score).label };
  });
  const avg = Math.round(results.reduce((a, b) => a + b.score, 0) / results.length);
  return {
    stocks: results,
    risk_score: avg,
    recommendation: avg <= 30
      ? `Your portfolio is in excellent health from a sentiment standpoint. All major holdings are surrounded by positive news flow. Consider maintaining current allocations while monitoring for any macro shifts.`
      : avg <= 70
      ? `Your portfolio carries moderate sentiment risk. A few holdings face headwinds from negative news cycles. Consider rebalancing by trimming overexposed positions or adding defensive counters.`
      : `Your portfolio is under significant sentiment pressure. Multiple holdings are experiencing negative news clusters. A defensive review is strongly advised — consider reducing exposure to the highest-risk names.`
  };
}

/**
 * Generate mock comparison data
 */
function mockCompare(company1, company2) {
  const mock1 = mockAnalyze(company1);
  const mock2 = mockAnalyze(company2);
  return {
    company1: mock1,
    company2: mock2,
    winner:   mock1.score >= mock2.score ? company1 : company2,
    margin:   Math.abs(mock1.score - mock2.score)
  };
}

/* ============================================================
   RESULTS PAGE — Single Stock Analysis
============================================================ */

/** Quick pick chip sets the input value */
function quickPick(name) {
  const input = document.getElementById('companyInput');
  if (input) {
    input.value = name;
    input.focus();
  }
}

/**
 * Main function: Analyze single stock
 * Triggered by the Analyze button on results.html
 */
async function analyzeSingleStock() {
  const input   = document.getElementById('companyInput');
  const company = input ? input.value.trim() : '';

  if (!company) {
    showError('Please enter a company name or ticker symbol.');
    return;
  }

  // Hide previous results
  const resultsSection   = document.getElementById('resultsSection');
  const placeholderState = document.getElementById('placeholderState');
  if (resultsSection)   resultsSection.style.display   = 'none';
  if (placeholderState) placeholderState.style.display = 'none';
  dismissError();

  showSpinner('Scanning market news…');
  setButtonLoading('analyzeBtn', 'analyzeBtnText', true, 'Analyzing…', 'Analyze');

  let data;

  try {
    /* ── Real API call ─────────────────────────────────────── */
    const response = await fetch(`${API_BASE}/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ company }),
      signal:  AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    data = await response.json();

  } catch (err) {
    /* ── Fallback to mock data ─────────────────────────────── */
    console.warn('API unavailable, using mock data:', err.message);
    data = mockAnalyze(company);
  } finally {
    hideSpinner();
    setButtonLoading('analyzeBtn', 'analyzeBtnText', false, 'Analyzing…', 'Analyze');
  }

  /* ── Render results ────────────────────────────────────── */
  renderSingleStockResults(data, company);
}

/**
 * Populate the results section with API/mock data
 */
function renderSingleStockResults(data, companyName) {
  const score   = data.score || 50;
  const sent    = classifySentiment(score);
  const label   = data.sentiment || sent.label;
  const summary = data.summary   || 'No summary available.';

  /* Company name header */
  const displayEl = document.getElementById('companyDisplayName');
  if (displayEl) displayEl.textContent = companyName;

  /* Timestamp */
  const ts = document.getElementById('resultsTimestamp');
  if (ts) ts.textContent = nowString();

  /* Top bar color */
  const bar = document.getElementById('sentimentBar');
  if (bar) bar.style.background = `linear-gradient(90deg, ${sent.color}, transparent)`;

  /* Emoji + label */
  const emojiEl = document.getElementById('sentimentEmoji');
  const labelEl = document.getElementById('sentimentLabel');
  if (emojiEl) emojiEl.textContent = sent.emoji;
  if (labelEl) {
    labelEl.textContent = label;
    labelEl.style.color = sent.color;
  }

  /* Score ring animation */
  const ringFill = document.getElementById('scoreRingFill');
  if (ringFill) {
    const circumference = 314;
    const offset = circumference - (score / 100) * circumference;
    ringFill.style.stroke = sent.color;
    setTimeout(() => { ringFill.style.strokeDashoffset = offset; }, 100);
  }

  /* Score number counter */
  const scoreEl = document.getElementById('scoreNumber');
  if (scoreEl) animateCounter(scoreEl, score);

  /* Meta rows */
  const metaSent = document.getElementById('metaSentiment');
  const metaConf = document.getElementById('metaConfidence');
  const metaVol  = document.getElementById('metaVolume');
  if (metaSent) { metaSent.textContent = label; metaSent.style.color = sent.color; }
  if (metaConf) metaConf.textContent = data.confidence   || `${75 + Math.floor(score / 10)}%`;
  if (metaVol)  metaVol.textContent  = data.news_volume  || `${80 + score * 2} articles`;

  /* Summary text */
  const summaryEl = document.getElementById('summaryText');
  if (summaryEl) summaryEl.textContent = summary;

  /* Donut center */
  const centerVal = document.getElementById('donutCenterVal');
  if (centerVal) centerVal.textContent = score;

  /* Legend values */
  const pos = data.positive ?? score;
  const neg = data.negative ?? Math.max(5, 100 - score - 20);
  const neu = data.neutral  ?? Math.max(5, 100 - pos - neg);
  const lgPos = document.getElementById('lgPositive');
  const lgNeg = document.getElementById('lgNegative');
  const lgNeu = document.getElementById('lgNeutral');
  if (lgPos) lgPos.textContent = `${Math.round(pos)}%`;
  if (lgNeg) lgNeg.textContent = `${Math.round(neg)}%`;
  if (lgNeu) lgNeu.textContent = `${Math.round(neu)}%`;

  /* Build donut chart */
  buildDonutChart(pos, neg, neu);

  /* Signals list */
  buildSignalsList(data, score, companyName);

  /* Show results section */
  const resultsSection = document.getElementById('resultsSection');
  if (resultsSection) resultsSection.style.display = 'block';
}

/**
 * Build / rebuild the Chart.js donut chart
 */
function buildDonutChart(pos, neg, neu) {
  const canvas = document.getElementById('donutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (donutChartInstance) {
    donutChartInstance.destroy();
    donutChartInstance = null;
  }

  donutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Negative', 'Neutral'],
      datasets: [{
        data: [
          Math.max(0, Math.round(pos)),
          Math.max(0, Math.round(neg)),
          Math.max(0, Math.round(neu))
        ],
        backgroundColor: ['#00c853', '#ff5252', '#30363d'],
        borderColor:     ['#00c85388', '#ff525288', '#30363d88'],
        borderWidth:     2,
        hoverOffset:     8
      }]
    },
    options: {
      responsive:          false,
      cutout:              '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#161b22',
          borderColor:     '#30363d',
          borderWidth:     1,
          titleColor:      '#e6edf3',
          bodyColor:       '#8b949e',
          padding:         12,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw}%`
          }
        }
      },
      animation: {
        animateRotate: true,
        duration:      1200,
        easing:        'easeInOutQuart'
      }
    }
  });
}

/**
 * Build key signals list from response data
 */
function buildSignalsList(data, score, companyName) {
  const list = document.getElementById('signalsList');
  if (!list) return;

  const signals = data.signals || generateDefaultSignals(score, companyName);
  list.innerHTML = '';

  signals.forEach(signal => {
    const item = document.createElement('div');
    item.className = 'signal-item';
    item.innerHTML = `
      <span class="signal-label">${signal.label}</span>
      <span class="signal-badge signal-${signal.type.toLowerCase()}">${signal.type}</span>
    `;
    list.appendChild(item);
  });
}

/** Auto-generate signals if not provided by API */
function generateDefaultSignals(score, company) {
  const isPositive = score >= 65;
  const isNegative = score <= 35;
  return [
    { label: `${company} quarterly earnings outlook`,  type: isPositive ? 'Positive' : isNegative ? 'Negative' : 'Neutral' },
    { label: 'Analyst price target revisions',         type: isPositive ? 'Positive' : 'Neutral' },
    { label: 'Institutional holding changes',          type: score > 50 ? 'Positive' : 'Negative' },
    { label: 'Sector peer comparison sentiment',       type: isNegative ? 'Negative' : 'Neutral' },
    { label: 'Management guidance tone analysis',      type: isPositive ? 'Positive' : isNegative ? 'Negative' : 'Neutral' }
  ];
}

/* ============================================================
   PORTFOLIO PAGE — Risk Analyzer
============================================================ */

let stockInputCount = 0;

/**
 * Add a new stock input row
 */
function addStockInput(defaultValue = '') {
  const list = document.getElementById('stocksInputList');
  if (!list) return;

  stockInputCount++;
  const id  = `stockInput_${stockInputCount}`;
  const row = document.createElement('div');
  row.className  = 'stock-input-row';
  row.id         = `stockRow_${stockInputCount}`;
  row.innerHTML  = `
    <div class="input-wrapper">
      <span class="input-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </span>
      <input
        type="text"
        id="${id}"
        class="text-input"
        placeholder="Stock ${stockInputCount} (e.g. Reliance)"
        value="${defaultValue}"
        autocomplete="off"
      />
    </div>
    <button class="stock-remove-btn" onclick="removeStockInput('stockRow_${stockInputCount}')" title="Remove">✕</button>
  `;
  list.appendChild(row);
}

/** Remove a stock row */
function removeStockInput(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.style.opacity   = '0';
    row.style.transform = 'translateX(-20px)';
    row.style.transition = 'opacity 0.2s, transform 0.2s';
    setTimeout(() => row.remove(), 220);
  }
}

/** Clear all stock inputs */
function clearAllStocks() {
  const list = document.getElementById('stocksInputList');
  if (list) list.innerHTML = '';
  stockInputCount = 0;
  // Reset results
  const results = document.getElementById('portfolioResults');
  const placeholder = document.getElementById('placeholderState');
  if (results)     results.style.display     = 'none';
  if (placeholder) placeholder.style.display = 'flex';
  // Re-add 3 blank inputs
  addStockInput();
  addStockInput();
  addStockInput();
}

/** Load a preset portfolio */
function loadPreset(preset) {
  const presets = {
    nifty50:  ['Reliance', 'TCS', 'HDFC Bank', 'Infosys', 'ICICI Bank'],
    it:       ['TCS', 'Infosys', 'Wipro', 'HCL Tech', 'Tech Mahindra'],
    banking:  ['HDFC Bank', 'ICICI Bank', 'SBI', 'Kotak Bank', 'Axis Bank'],
    fmcg:     ['HUL', 'ITC', 'Nestle India', 'Britannia', 'Dabur']
  };

  const stocks = presets[preset];
  if (!stocks) return;

  const list = document.getElementById('stocksInputList');
  if (list) list.innerHTML = '';
  stockInputCount = 0;
  stocks.forEach(s => addStockInput(s));
}

/**
 * Main function: Analyze portfolio risk
 */
async function analyzePortfolio() {
  // Collect stock names
  const rows   = document.querySelectorAll('.stock-input-row input.text-input');
  const stocks = Array.from(rows)
    .map(i => i.value.trim())
    .filter(s => s.length > 0);

  if (stocks.length === 0) {
    showError('Please add at least one stock to your portfolio.');
    return;
  }

  const results     = document.getElementById('portfolioResults');
  const placeholder = document.getElementById('placeholderState');
  if (results)     results.style.display     = 'none';
  if (placeholder) placeholder.style.display = 'none';
  dismissError();

  showSpinner('Analyzing portfolio risk…');
  setButtonLoading('calculateBtn', 'calcBtnText', true, 'Calculating…', 'Calculate Risk');

  let data;

  try {
    const response = await fetch(`${API_BASE}/portfolio`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ stocks }),
      signal:  AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    data = await response.json();

  } catch (err) {
    console.warn('API unavailable, using mock data:', err.message);
    data = mockPortfolio(stocks);
  } finally {
    hideSpinner();
    setButtonLoading('calculateBtn', 'calcBtnText', false, 'Calculating…', 'Calculate Risk');
  }

  renderPortfolioResults(data, stocks);
}

/**
 * Render portfolio risk results
 */
function renderPortfolioResults(data, stocks) {
  const riskScore    = data.risk_score ?? 50;
  const riskConfig   = classifyRisk(riskScore);
  const stockResults = data.stocks || stocks.map(s => {
    const d = mockAnalyze(s);
    return { stock: s, score: d.score, sentiment: d.sentiment };
  });

  /* Risk badge */
  const badge = document.getElementById('riskBadge');
  if (badge) {
    badge.textContent           = riskConfig.label;
    badge.style.background      = `${riskConfig.color}22`;
    badge.style.color           = riskConfig.color;
    badge.style.border          = `1px solid ${riskConfig.color}`;
    badge.style.borderRadius    = '12px';
    badge.style.padding         = '3px 12px';
    badge.style.fontSize        = '0.72rem';
  }

  /* Timestamp */
  const ts = document.getElementById('portfolioTimestamp');
  if (ts) ts.textContent = nowString();

  /* Risk score number */
  const rsnEl = document.getElementById('riskScoreNumber');
  if (rsnEl) {
    rsnEl.style.color = riskConfig.color;
    animateCounter(rsnEl, riskScore);
  }

  const rslEl = document.getElementById('riskScoreLabel');
  if (rslEl) {
    rslEl.textContent = riskConfig.label;
    rslEl.style.color = riskConfig.color;
  }

  const rsdEl = document.getElementById('riskScoreDesc');
  if (rsdEl) rsdEl.textContent = riskConfig.desc;

  /* Build gauge chart */
  buildGaugeChart(riskScore);

  /* Breakdown list */
  buildBreakdownList(stockResults);

  /* Summary stats */
  const scores     = stockResults.map(s => s.score);
  const avg        = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const minScore   = Math.min(...scores);
  const maxScore   = Math.max(...scores);
  const riskiest   = stockResults.find(s => s.score === minScore);
  const safest     = stockResults.find(s => s.score === maxScore);

  const avgEl       = document.getElementById('avgScore');
  const riskiestEl  = document.getElementById('riskiestStock');
  const safestEl    = document.getElementById('safestStock');

  if (avgEl)      avgEl.textContent     = avg;
  if (riskiestEl) riskiestEl.textContent = riskiest ? riskiest.stock : '—';
  if (safestEl)   safestEl.textContent   = safest   ? safest.stock   : '—';

  /* AI Recommendation */
  const recEl = document.getElementById('recommendationText');
  if (recEl) recEl.textContent = data.recommendation || riskConfig.desc;

  /* Show results */
  const resultsEl = document.getElementById('portfolioResults');
  if (resultsEl) resultsEl.style.display = 'block';
}

/**
 * Build the breakdown list of stocks with scores
 */
function buildBreakdownList(stockResults) {
  const listEl = document.getElementById('breakdownList');
  if (!listEl) return;
  listEl.innerHTML = '';

  stockResults.forEach(item => {
    const score  = item.score || 50;
    const config = classifySentiment(score);

    const div = document.createElement('div');
    div.className = 'breakdown-item';
    div.innerHTML = `
      <span class="breakdown-item-name">${item.stock}</span>
      <div class="breakdown-bar-track">
        <div class="breakdown-bar-fill"
          style="width:0%; background:${config.color}; box-shadow: 0 0 6px ${config.glow}">
        </div>
      </div>
      <span class="breakdown-item-score" style="color:${config.color}">${score}</span>
    `;
    listEl.appendChild(div);

    // Animate bar after DOM insert
    requestAnimationFrame(() => {
      setTimeout(() => {
        const bar = div.querySelector('.breakdown-bar-fill');
        if (bar) bar.style.width = `${score}%`;
      }, 100);
    });
  });
}

/**
 * Build the speedometer / gauge chart using Chart.js
 * Implemented as a half-doughnut with a needle overlay
 */
function buildGaugeChart(riskScore) {
  const canvas = document.getElementById('gaugeChart');
  if (!canvas) return;

  if (gaugeChartInstance) {
    gaugeChartInstance.destroy();
    gaugeChartInstance = null;
  }

  const ctx = canvas.getContext('2d');

  // Score 0–100 maps to the half-doughnut (180°)
  const normalised = Math.min(100, Math.max(0, riskScore));

  // Gauge segments: Low (0–30), Medium (31–70), High (71–100)
  const lowPct  = 30;
  const midPct  = 40;
  const highPct = 30;

  // Needle plugin
  const needlePlugin = {
    id: 'needlePlugin',
    afterDatasetDraw(chart) {
      const { ctx, chartArea: { width, height, top } } = chart;
      const cx   = width  / 2;
      const cy   = top + height; // bottom of the semicircle
      const r    = (Math.min(width, height * 2) / 2) * 0.85;

      // Needle angle: -180° (left/0) to 0° (right/100)
      const angle = Math.PI * (normalised / 100) - Math.PI;

      ctx.save();
      ctx.translate(cx, cy);

      // Needle line
      const needleLen = r * 0.78;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(
        needleLen * Math.cos(angle),
        needleLen * Math.sin(angle)
      );
      ctx.strokeStyle = '#e6edf3';
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.shadowColor = '#e6edf3';
      ctx.shadowBlur  = 8;
      ctx.stroke();

      // Center circle
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle   = '#30363d';
      ctx.shadowBlur  = 0;
      ctx.fill();
      ctx.strokeStyle = '#8b949e';
      ctx.lineWidth   = 2;
      ctx.stroke();

      ctx.restore();
    }
  };

  gaugeChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [lowPct, midPct, highPct, 100], // last 100 = hidden bottom half
        backgroundColor: ['#00c853', '#d4af37', '#ff5252', 'transparent'],
        borderColor:     ['#00c85355', '#d4af3755', '#ff525255', 'transparent'],
        borderWidth:     [2, 2, 2, 0],
        circumference:   180,
        rotation:        270,
        hoverOffset:     0,
        hoverBackgroundColor: ['#00c853', '#d4af37', '#ff5252', 'transparent']
      }]
    },
    options: {
      responsive:  true,
      cutout:      '65%',
      plugins: {
        legend:  { display: false },
        tooltip: { enabled: false }
      },
      animation: {
        animateRotate: true,
        duration:      1000,
        easing:        'easeInOutCubic'
      }
    },
    plugins: [needlePlugin]
  });
}

/* ============================================================
   COMPARE PAGE — Company Comparison
============================================================ */

/** Quick compare presets */
function quickCompare(c1, c2) {
  const i1 = document.getElementById('company1Input');
  const i2 = document.getElementById('company2Input');
  if (i1) i1.value = c1;
  if (i2) i2.value = c2;
}

/**
 * Main function: Compare two companies
 */
async function compareCompanies() {
  const c1 = document.getElementById('company1Input')?.value.trim();
  const c2 = document.getElementById('company2Input')?.value.trim();

  if (!c1 || !c2) {
    showError('Please enter names for both companies.');
    return;
  }

  if (c1.toLowerCase() === c2.toLowerCase()) {
    showError('Please enter two different companies to compare.');
    return;
  }

  const resultsEl   = document.getElementById('compareResults');
  const placeholder = document.getElementById('placeholderState');
  if (resultsEl)   resultsEl.style.display   = 'none';
  if (placeholder) placeholder.style.display = 'none';
  dismissError();

  showSpinner('Running comparison analysis…');
  setButtonLoading('compareBtn', 'compareBtnText', true, 'Comparing…', 'Compare Now');

  let data;

  try {
    const response = await fetch(`${API_BASE}/compare`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ company1: c1, company2: c2 }),
      signal:  AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    data = await response.json();

  } catch (err) {
    console.warn('API unavailable, using mock data:', err.message);
    data = mockCompare(c1, c2);
  } finally {
    hideSpinner();
    setButtonLoading('compareBtn', 'compareBtnText', false, 'Comparing…', 'Compare Now');
  }

  renderCompareResults(data, c1, c2);
}

/**
 * Render comparison results
 */
function renderCompareResults(data, c1, c2) {
  const d1 = data.company1 || mockAnalyze(c1);
  const d2 = data.company2 || mockAnalyze(c2);

  const score1 = d1.score ?? 50;
  const score2 = d2.score ?? 50;

  const sent1 = classifySentiment(score1);
  const sent2 = classifySentiment(score2);

  // Winner
  const winner       = data.winner || (score1 >= score2 ? c1 : c2);
  const margin       = data.margin ?? Math.abs(score1 - score2);
  const winnerConfig = score1 >= score2 ? sent1 : sent2;

  const winnerNameEl   = document.getElementById('winnerName');
  const winnerMarginEl = document.getElementById('winnerMargin');
  if (winnerNameEl)   winnerNameEl.textContent = winner;
  if (winnerMarginEl) winnerMarginEl.textContent = `+${Math.round(margin)} pts advantage`;

  // Score card 1
  const cscName1 = document.getElementById('cscName1');
  const cscScore1 = document.getElementById('cscScore1');
  const cscSentiment1 = document.getElementById('cscSentiment1');
  const cscBar1 = document.getElementById('cscBar1');
  const cscSummary1 = document.getElementById('cscSummary1');

  if (cscName1)      cscName1.textContent = c1;
  if (cscScore1) {
    cscScore1.style.color = sent1.color;
    animateCounter(cscScore1, score1);
  }
  if (cscSentiment1) {
    cscSentiment1.textContent = sent1.label;
    cscSentiment1.style.color = sent1.color;
  }
  if (cscSummary1) cscSummary1.textContent = d1.summary?.substring(0, 120) + '…' || '—';

  // Score card 2
  const cscName2 = document.getElementById('cscName2');
  const cscScore2 = document.getElementById('cscScore2');
  const cscSentiment2 = document.getElementById('cscSentiment2');
  const cscBar2 = document.getElementById('cscBar2');
  const cscSummary2 = document.getElementById('cscSummary2');

  if (cscName2)      cscName2.textContent = c2;
  if (cscScore2) {
    cscScore2.style.color = sent2.color;
    animateCounter(cscScore2, score2);
  }
  if (cscSentiment2) {
    cscSentiment2.textContent = sent2.label;
    cscSentiment2.style.color = sent2.color;
  }
  if (cscSummary2) cscSummary2.textContent = d2.summary?.substring(0, 120) + '…' || '—';

  // Animate score bars
  setTimeout(() => {
    if (cscBar1) cscBar1.style.width = `${score1}%`;
    if (cscBar2) cscBar2.style.width = `${score2}%`;
  }, 200);

  // Metrics table
  document.getElementById('metricsHeader1').textContent  = c1;
  document.getElementById('metricsHeader2').textContent  = c2;
  document.getElementById('metricScore1').textContent    = score1;
  document.getElementById('metricScore2').textContent    = score2;
  document.getElementById('metricSentiment1').textContent = sent1.label;
  document.getElementById('metricSentiment2').textContent = sent2.label;
  document.getElementById('metricConf1').textContent     = d1.confidence || `${72 + score1 % 20}%`;
  document.getElementById('metricConf2').textContent     = d2.confidence || `${72 + score2 % 20}%`;

  // Color metric scores
  const ms1 = document.getElementById('metricScore1');
  const ms2 = document.getElementById('metricScore2');
  if (ms1) ms1.style.color = sent1.color;
  if (ms2) ms2.style.color = sent2.color;

  const mst1 = document.getElementById('metricSentiment1');
  const mst2 = document.getElementById('metricSentiment2');
  if (mst1) mst1.style.color = sent1.color;
  if (mst2) mst2.style.color = sent2.color;

  // Build bar chart
  buildBarChart(c1, c2, score1, score2, sent1.color, sent2.color);

  // Show results
  const resultsEl = document.getElementById('compareResults');
  if (resultsEl) resultsEl.style.display = 'block';
}

/**
 * Build the comparison bar chart
 */
function buildBarChart(label1, label2, score1, score2, color1, color2) {
  const canvas = document.getElementById('barChart');
  if (!canvas) return;

  if (barChartInstance) {
    barChartInstance.destroy();
    barChartInstance = null;
  }

  const ctx = canvas.getContext('2d');

  barChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Sentiment Score', 'Positivity Index', 'Confidence'],
      datasets: [
        {
          label: label1,
          data: [
            score1,
            Math.min(100, score1 + Math.floor(Math.random() * 8) - 4),
            70 + Math.floor(score1 % 20)
          ],
          backgroundColor: `${color1}44`,
          borderColor:     color1,
          borderWidth:     2,
          borderRadius:    6,
          hoverBackgroundColor: `${color1}88`
        },
        {
          label: label2,
          data: [
            score2,
            Math.min(100, score2 + Math.floor(Math.random() * 8) - 4),
            70 + Math.floor(score2 % 20)
          ],
          backgroundColor: `${color2}44`,
          borderColor:     color2,
          borderWidth:     2,
          borderRadius:    6,
          hoverBackgroundColor: `${color2}88`
        }
      ]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display:  true,
          position: 'top',
          labels: {
            color:    '#8b949e',
            font:     { family: 'Poppins', size: 12 },
            usePointStyle: true,
            pointStyleWidth: 10
          }
        },
        tooltip: {
          backgroundColor: '#161b22',
          borderColor:     '#30363d',
          borderWidth:     1,
          titleColor:      '#e6edf3',
          bodyColor:       '#8b949e',
          padding:         14,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}`
          }
        }
      },
      scales: {
        x: {
          grid:   { color: '#21262d' },
          ticks:  { color: '#8b949e', font: { family: 'Poppins', size: 11 } }
        },
        y: {
          beginAtZero: true,
          max:         100,
          grid:        { color: '#21262d' },
          ticks: {
            color:  '#8b949e',
            font:   { family: 'Poppins', size: 11 },
            stepSize: 20
          }
        }
      },
      animation: {
        duration: 1200,
        easing:   'easeInOutQuart'
      }
    }
  });
}

/* ============================================================
   NAVBAR — Mobile hamburger toggle
============================================================ */

function initNavbar() {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close mobile menu on link click
  mobileMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
    });
  });
}

/* ============================================================
   SCROLL REVEAL
============================================================ */

function initScrollReveal() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.feature-card, .step-item, .result-card').forEach(el => {
    el.classList.add('reveal');
    observer.observe(el);
  });
}

/* ============================================================
   PORTFOLIO PAGE INIT — ensure 3 stock inputs on load
============================================================ */

function initPortfolioPage() {
  const list = document.getElementById('stocksInputList');
  if (!list) return; // Not on portfolio page

  // Start with 3 inputs
  if (list.children.length === 0) {
    addStockInput('TCS');
    addStockInput('Infosys');
    addStockInput('HDFC Bank');
  }

  // Allow Enter key to submit
  list.addEventListener('keydown', e => {
    if (e.key === 'Enter') analyzePortfolio();
  });
}

/* ============================================================
   RESULTS PAGE INIT
============================================================ */

function initResultsPage() {
  const input = document.getElementById('companyInput');
  if (!input) return;

  // Enter key triggers analysis
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') analyzeSingleStock();
  });

  // Check for URL param ?company=...
  const params  = new URLSearchParams(window.location.search);
  const company = params.get('company');
  if (company) {
    input.value = company;
    analyzeSingleStock();
  }
}

/* ============================================================
   COMPARE PAGE INIT
============================================================ */

function initComparePage() {
  const i1 = document.getElementById('company1Input');
  const i2 = document.getElementById('company2Input');
  if (!i1 || !i2) return;

  [i1, i2].forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') compareCompanies();
    });
  });
}

/* ============================================================
   HOME PAGE — Animate hero stats on load
============================================================ */

function initHomePage() {
  const statNums = document.querySelectorAll('.stat-num');
  if (!statNums.length) return;

  // Already text, just add a shimmer class after a delay
  setTimeout(() => {
    statNums.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      setTimeout(() => {
        el.style.opacity   = '1';
        el.style.transform = 'translateY(0)';
      }, 100);
    });
  }, 300);
}

/* ============================================================
   GLOBAL INIT
============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Always run
  initNavbar();
  initScrollReveal();

  // Page-specific
  initHomePage();
  initResultsPage();
  initPortfolioPage();
  initComparePage();

  // Add a subtle cursor-following glow on cards (desktop only)
  if (window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.feature-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x    = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
        const y    = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
        card.style.background = `
          radial-gradient(circle at ${x}% ${y}%,
            rgba(255,255,255,0.04) 0%,
            transparent 60%),
          var(--card)
        `;
      });
      card.addEventListener('mouseleave', () => {
        card.style.background = '';
      });
    });
  }
});