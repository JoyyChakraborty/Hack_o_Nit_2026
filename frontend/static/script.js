/* ============================================================
   FinSight AI — script.js (FINAL & DE-BUGGED)
   ============================================================ */

'use strict';

const API_BASE = 'http://127.0.0.1:8080';
let donutChartInstance = null;
let gaugeChartInstance = null;

/* ── 1. ANALYSIS LOGIC ─────────────────────────────────────── */

async function analyzeStock() {
    const input = document.getElementById('companyInput');
    if (input && input.value.trim() !== "") {
        window.location.href = `/results?company=${encodeURIComponent(input.value.trim())}`;
    } else {
        alert("Please enter a stock name first!");
    }
}

async function analyzeSingleStock() {
    const input = document.getElementById('companyInput');
    const company = input ? input.value.trim() : '';
    if (!company) { return; }

    showSpinner('Gemini is reading latest news...');
    setButtonLoading('analyzeBtn', true);

    try {
        const response = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company })
        });
        const data = await response.json();
        if (response.ok) { 
            renderSingleStockResults(data, company); 
        } else { 
            showError(data.error || "Analysis failed."); 
        }
    } catch (err) { 
        showError("Connection error. Is app.py running?"); 
    } finally { 
        hideSpinner(); 
        setButtonLoading('analyzeBtn', false); 
    }
}

/* ── 2. RENDERING LOGIC ────────────────────────────────────── */
function renderSingleStockResults(data, companyName) {
    const score = parseInt(data.confidence_score) || 50;
    
    // 🛑 THE FIX: Determine the color strictly based on the text word!
    const textSentiment = (data.overall_sentiment || 'Neutral').toLowerCase();
    let uiColor = '#d4af37'; // Default gold for Neutral
    if (textSentiment === 'positive') uiColor = '#00c853'; // Green
    if (textSentiment === 'negative') uiColor = '#ff5252'; // Red
    
    // Switch UI Views
    document.getElementById('placeholderState').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';

    // 1. Update Header & Summary
    document.getElementById('companyDisplayName').textContent = companyName;
    document.getElementById('sentimentLabel').textContent = data.overall_sentiment || 'Neutral';
    document.getElementById('sentimentLabel').style.color = uiColor; // Uses the fixed color
    document.getElementById('summaryText').textContent = data.reasoning || 'No summary available.';
    
    // 2. Update Metadata (Confidence & Volume)
    const confEl = document.getElementById('metaConfidence');
    const volEl = document.getElementById('metaVolume');
    if (confEl) confEl.textContent = score + "%";
    if (volEl) volEl.textContent = data.volume || "Moderate";

    // 3. Update Legend Numbers
    if (document.getElementById('lgPositive')) document.getElementById('lgPositive').textContent = data.positive_count || 0;
    if (document.getElementById('lgNegative')) document.getElementById('lgNegative').textContent = data.negative_count || 0;
    if (document.getElementById('lgNeutral')) document.getElementById('lgNeutral').textContent = data.neutral_count || 0;

    // 4. Update Sentiment Emoji/Icon
    const emojiEl = document.getElementById('sentimentEmoji');
    if (emojiEl) {
        emojiEl.textContent = textSentiment === 'positive' ? '📈' : textSentiment === 'negative' ? '📉' : '📊';
    }

    // 5. Animate the Ring and Number
    animateCounter(document.getElementById('scoreNumber'), score);
    const ring = document.getElementById('scoreRingFill');
    if (ring) {
        const offset = 314 - (314 * score) / 100;
        ring.style.strokeDashoffset = offset;
        ring.style.stroke = uiColor; // Ring uses the fixed color too
    }

    // 6. Build Chart
    buildDonutChart(
        parseInt(data.positive_count) || 0,
        parseInt(data.negative_count) || 0,
        parseInt(data.neutral_count) || 0
    );

    // 7. Update Key Signals List
    const list = document.getElementById('signalsList');
    if (list && data.key_factors) {
        list.innerHTML = data.key_factors.map(f => `
            <div class="signal-item">
                <span class="signal-label">${f}</span>
                <span class="signal-badge signal-neutral">Key Factor</span>
            </div>
        `).join('');
    }

    // Calculate total to get percentages for the Donut Chart legend
    const total = (parseInt(data.positive_count) || 0) + 
                  (parseInt(data.negative_count) || 0) + 
                  (parseInt(data.neutral_count) || 0) || 1;

    if (document.getElementById('lgPositive')) 
        document.getElementById('lgPositive').textContent = Math.round((data.positive_count / total) * 100) + "%";
    
    if (document.getElementById('lgNegative')) 
        document.getElementById('lgNegative').textContent = Math.round((data.negative_count / total) * 100) + "%";
    
    if (document.getElementById('lgNeutral')) 
        document.getElementById('lgNeutral').textContent = Math.round((data.neutral_count / total) * 100) + "%";
}
/* ── 3. UI UTILITIES ───────────────────────────────────────── */

function classifySentiment(score) {
    if (score >= 65) return { label: 'Positive', color: '#00c853' };
    if (score <= 35) return { label: 'Negative', color: '#ff5252' };
    return { label: 'Neutral', color: '#d4af37' };
}

function animateCounter(el, target) {
    if (!el) return;
    let curr = 0;
    const speed = target > 0 ? Math.max(1, Math.floor(2000 / target)) : 20;
    const interval = setInterval(() => {
        if (curr >= target) { el.textContent = target; clearInterval(interval); }
        else { curr++; el.textContent = curr; }
    }, 15);
}

function buildDonutChart(pos, neg, neu) {
    const canvas = document.getElementById('donutChart');
    if (!canvas) return;
    if (donutChartInstance) donutChartInstance.destroy();

    const total = (pos + neg + neu) || 1;
    
    donutChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Positive', 'Negative', 'Neutral'],
            datasets: [{
                data: [pos, neg, neu],
                backgroundColor: ['#00c853', '#ff5252', '#30363d'],
                borderWidth: 0
            }]
        },
        options: { 
            cutout: '75%', 
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } } 
        }
    });
}

/* ── 4. LOADING & ERRORS ───────────────────────────────────── */

function showSpinner(msg) { 
    const s = document.getElementById('loadingSpinner'); 
    if(s) { 
        const txt = s.querySelector('.spinner-text');
        if(txt) txt.textContent = msg; 
        s.style.display = 'flex'; 
    }
}

function hideSpinner() { 
    const s = document.getElementById('loadingSpinner'); 
    if(s) s.style.display = 'none'; 
}

function showError(m) { alert(m); }

function setButtonLoading(id, loading) { 
    const b = document.getElementById(id); 
    if(b) b.disabled = loading; 
}

/* ── 5. INITIALIZATION ─────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const company = params.get('company');
    if (company && document.getElementById('companyInput')) {
        document.getElementById('companyInput').value = company;
        analyzeSingleStock();
    }
});

/* ── 6. COMPARE LOGIC ─────────────────────────────────────── */
async function runComparison() {
    const c1 = document.getElementById('stock1Input').value.trim();
    const c2 = document.getElementById('stock2Input').value.trim();

    if (!c1 || !c2) { alert("Please enter two stocks to compare!"); return; }

    const spinner = document.getElementById('loadingSpinner');
    const resultsGrid = document.getElementById('compareResults');
    if (spinner) spinner.style.display = 'block';
    if (resultsGrid) resultsGrid.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/compare_api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company1: c1, company2: c2 })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (spinner) spinner.style.display = 'none';
            if (resultsGrid) resultsGrid.style.display = 'grid';
            
            document.getElementById('name1').textContent = data.company1.name;
            document.getElementById('score1').textContent = data.company1.confidence_score + "%";
            document.getElementById('reason1').textContent = data.company1.reasoning;
            
            document.getElementById('name2').textContent = data.company2.name;
            document.getElementById('score2').textContent = data.company2.confidence_score + "%";
            document.getElementById('reason2').textContent = data.company2.reasoning;
            
            const col1 = document.getElementById('col1');
            const col2 = document.getElementById('col2');
            col1.classList.remove('winner-highlight');
            col2.classList.remove('winner-highlight');
            
            if (data.winner === "company1") {
                col1.classList.add('winner-highlight');
            } else {
                col2.classList.add('winner-highlight');
            }
        } else {
            alert(data.error || "Comparison failed.");
            if (spinner) spinner.style.display = 'none';
        }
    } catch (err) {
        alert("Backend connection error. Is app.py running?");
        if (spinner) spinner.style.display = 'none';
    }
}

/* ── 7. PORTFOLIO LOGIC ─────────────────────────────────────── */

function addStockInput(value = "") {
    const list = document.getElementById('stocksInputList');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'stock-input-row';
    div.innerHTML = `
        <input type="text" class="text-input" placeholder="Stock Name (e.g. TCS)" value="${value}">
        <button class="stock-remove-btn" onclick="this.parentElement.remove()">✕</button>
    `;
    list.appendChild(div);
}

function clearAllStocks() {
    const list = document.getElementById('stocksInputList');
    if (list) list.innerHTML = "";
}

function loadPreset(type) {
    clearAllStocks();
    const presets = {
        'it': ['TCS', 'Infosys', 'Wipro', 'HCL Tech'],
        'banking': ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank']
    };
    (presets[type] || []).forEach(s => addStockInput(s));
}

async function analyzePortfolio() {
    const inputs = document.querySelectorAll('#stocksInputList .text-input');
    const stocks = Array.from(inputs).map(i => i.value.trim()).filter(s => s !== "");
    if (stocks.length === 0) { alert("Please add at least one stock!"); return; }

    const spinner = document.getElementById('loadingSpinner');
    const resultsSection = document.getElementById('portfolioResults');
    if (spinner) spinner.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE}/portfolio_api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stocks })
        });
        const data = await response.json();
        
        if (response.ok) {
            renderPortfolioResults(data);
        } else {
            alert(data.error || "Portfolio analysis failed.");
        }
    } catch (err) {
        alert("Connection error. Is app.py running?");
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

function renderPortfolioResults(data) {
    const score = parseInt(data.overall_score) || 50;
    const health = data.portfolio_health || "Moderate";
    
    // We can still use classifySentiment for the OVERALL score, 
    // because you fixed the math in app.py to make 0 = bad and 100 = good!
    const config = classifySentiment(score);

    const resultsSection = document.getElementById('portfolioResults');
    if (resultsSection) resultsSection.style.display = 'block';

    const healthLabel = document.getElementById('riskScoreLabel');
    if (healthLabel) {
        healthLabel.textContent = health;
        healthLabel.style.color = config.color;
    }

    const scoreNum = document.getElementById('riskScoreNumber');
    if (scoreNum) scoreNum.textContent = score;

    buildGaugeChart(score);

    const list = document.getElementById('breakdownList');
    if (list && data.stocks) {
        list.innerHTML = data.stocks.map(s => {
            const sConf = parseInt(s.confidence_score) || 50;
            const textSentiment = (s.overall_sentiment || 'Neutral').toLowerCase();
            
            // 🛑 THE FIX IS HERE: Color maps strictly to the word
            let sColor = '#d4af37'; 
            if (textSentiment === 'positive') sColor = '#00c853'; 
            if (textSentiment === 'negative') sColor = '#ff5252'; 

            return `
            <div class="breakdown-item" style="display:flex; justify-content:space-between; padding: 10px; border-bottom: 1px solid #30363d;">
                <span style="font-weight: 600; text-transform: uppercase;">${s.name || 'Stock'}</span>
                <span style="color:${sColor}; font-weight: bold;">
                    ${s.overall_sentiment || 'Neutral'} (${sConf}%)
                </span>
            </div>
            `;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('stocksInputList')) {
        addStockInput();
    }
});

function buildGaugeChart(val) {
    const canvas = document.getElementById('gaugeChart');
    if (!canvas) return;
    
    if (gaugeChartInstance) gaugeChartInstance.destroy();
    
    const sentColor = val >= 65 ? '#00c853' : val <= 35 ? '#ff5252' : '#d4af37';
    
    gaugeChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [val, 100 - val],
                backgroundColor: [sentColor, '#1c2230'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
}