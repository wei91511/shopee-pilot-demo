// 運營工具箱 Demo v3.3 — 聚焦引導 + 節奏放慢 + 預算重置演示

// ========================
//  資料
// ========================
const AD_DATA = [
  { id: 'A', name: '藍芽耳機旗艦款', budget: 170, spend: 162, roas: 6.2, ctr: 4.1 },
  { id: 'B', name: '手機殼多色款',   budget: 85,  spend: 80,  roas: 4.8, ctr: 3.5 },
  { id: 'C', name: '快充線三件組',   budget: 85,  spend: 77,  roas: 5.1, ctr: 1.8 },
  { id: 'D', name: '螢幕保護貼',     budget: 90,  spend: 88,  roas: 5.5, ctr: 3.2 },
];

// 重置預算目標值：最佳廣告 170，其餘 85
const RESET_BUDGETS = { A: 170, B: 85, C: 85, D: 85 };

const FLASH_ITEMS = [
  { idx: 1, name: '藍芽耳機/黑色', orig: 14 },
  { idx: 2, name: '藍芽耳機/白色', orig: 20 },
  { idx: 3, name: '手機殼/iPhone', orig: 8  },
];

const VOUCHER_DEMO = { name: '滿399折25', discount: 25, min: 399, tplIdx: 1 };

// ========================
//  計算廣告調整
// ========================
function calcAdjustments() {
  return AD_DATA.map(ad => {
    if (ad.roas >= 10) return null;
    let reason, inc;
    if (ad.roas >= 5)       { reason = 'ROAS達標';   inc = 15; }
    else if (ad.ctr >= 3.0) { reason = '點擊率達標'; inc = 5;  }
    else                    { reason = '保底';        inc = 4;  }
    return { ...ad, newBudget: ad.budget + inc, reason, inc };
  }).filter(Boolean);
}

// ========================
//  停止機制
// ========================
let stopRequested = false;

const delay = ms => new Promise(r => setTimeout(r, ms));

async function safeDelay(ms) {
  if (stopRequested) throw new Error('STOP');
  await delay(ms);
  if (stopRequested) throw new Error('STOP');
}

// ========================
//  字幕系統（影片字幕風格）
// ========================
let _stepTimer = null;

function setStep(text) {
  const bar = document.getElementById('stepBar');
  const el = document.getElementById('stepText');
  if (!bar || !el) return;
  clearTimeout(_stepTimer);

  if (!text) {
    bar.classList.remove('step-visible');
    return;
  }

  if (bar.classList.contains('step-visible')) {
    bar.classList.remove('step-visible');
    _stepTimer = setTimeout(() => {
      el.textContent = text;
      bar.classList.add('step-visible');
    }, 320);
  } else {
    el.textContent = text;
    bar.classList.add('step-visible');
  }
}

// 連續字幕展示（預設停留 4500ms，讀完再切）
async function showSubtitles(texts, duration = 4500) {
  for (const text of texts) {
    setStep(text);
    await safeDelay(duration);
  }
  setStep('');
  await safeDelay(400);
}

// ========================
//  工具
// ========================
function highlight(el) {
  if (!el) return;
  el.classList.remove('highlight-pulse');
  void el.offsetWidth;
  el.classList.add('highlight-pulse');
  setTimeout(() => el.classList.remove('highlight-pulse'), 2500);
}

function addLog(action, detail) {
  const log = document.getElementById('spLog');
  if (!log) return;
  const empty = log.querySelector('.sp-log-empty');
  if (empty) empty.remove();
  const now = new Date();
  const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const item = document.createElement('div');
  item.className = 'sp-log-item';
  item.innerHTML = `<span class="sp-log-time">${t}</span><span class="sp-log-action">${action}</span><span class="sp-log-detail">${detail}</span>`;
  log.insertBefore(item, log.firstChild);
}

async function typeInto(el, text, msPerChar = 50) {
  if (!el) return;
  el.textContent = '';
  el.classList.add('filling');
  for (const ch of text) {
    el.textContent += ch;
    await delay(msPerChar);
  }
  el.classList.remove('filling');
  el.classList.add('filled');
  setTimeout(() => el.classList.remove('filled'), 800);
}

async function genCodeAnimation(el) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rndChar = () => chars[Math.floor(Math.random() * chars.length)];
  el.classList.add('generating');
  for (let i = 0; i < 12; i++) {
    el.textContent = Array.from({length: 5}, rndChar).join('');
    await delay(65);
  }
  const code = Array.from({length: 5}, rndChar).join('');
  el.textContent = code;
  el.classList.remove('generating');
  return code;
}

// ========================
//  Spotlight 聚焦引導
// ========================
function _getFrames() {
  const active = document.querySelector('.ftab-content.active');
  if (!active) return { sp: null, shopee: null };
  return {
    sp: active.querySelector('.sp-frame'),
    shopee: active.querySelector('.shopee-frame'),
  };
}

// 聚焦單一面板（另一側變暗）
function spotlight(el) {
  document.body.classList.add('spotlight-active');
  document.querySelectorAll('.spotlight-target').forEach(e => e.classList.remove('spotlight-target'));
  if (el) el.classList.add('spotlight-target');
}

// 兩側同時亮起（執行時）
function spotlightBoth() {
  document.body.classList.add('spotlight-active');
  document.querySelectorAll('.spotlight-target').forEach(e => e.classList.remove('spotlight-target'));
  const { sp, shopee } = _getFrames();
  if (sp) sp.classList.add('spotlight-target');
  if (shopee) shopee.classList.add('spotlight-target');
}

// 關閉 spotlight（恢復正常）
function spotlightOff() {
  document.body.classList.remove('spotlight-active');
  document.querySelectorAll('.spotlight-target').forEach(e => e.classList.remove('spotlight-target'));
}

// ========================
//  狀態
// ========================
let isPlaying = false;
let scanDone = false;
let flashPlaying = false;
let voucherPlaying = false;

// ========================
//  廣告 — 掃描
// ========================
async function runScan() {
  const scanBtn = document.getElementById('scanBtn');
  const executeBtn = document.getElementById('executeBtn');
  const progress = document.getElementById('spProgress');
  const fill = document.getElementById('spProgressFill');
  const label = document.getElementById('spProgressLabel');
  const pct = document.getElementById('spProgressPct');
  const resultPanel = document.getElementById('scanResultPanel');

  if (scanBtn) scanBtn.disabled = true;
  if (executeBtn) executeBtn.disabled = true;
  if (progress) progress.classList.remove('hidden');
  if (resultPanel) { resultPanel.classList.add('hidden'); resultPanel.innerHTML = ''; }

  const steps = [
    [20,  '讀取廣告列表...'],
    [55,  '分析 ROAS / 點擊率數據...'],
    [85,  '計算調整方案...'],
    [100, '掃描完成 ✓'],
  ];

  let p = 0;
  for (const [target, msg] of steps) {
    if (label) label.textContent = msg;
    while (p < target) {
      p = Math.min(p + 3, target);
      if (fill) fill.style.width = p + '%';
      if (pct) pct.textContent = p + '%';
      await delay(40);   // 25 → 40
    }
    if (p < 100) await delay(500);  // 280 → 500
  }

  await delay(500);  // 300 → 500
  if (progress) progress.classList.add('hidden');
  if (fill) fill.style.width = '0%';
  if (pct) pct.textContent = '';

  const adjs = calcAdjustments();
  if (resultPanel) {
    resultPanel.className = 'sp-result-panel info';
    resultPanel.innerHTML = adjs.map(a => `
      <div class="sp-result-item">
        <span>📋</span>
        <span class="sp-r-name">${a.name}</span>
        <span class="sp-r-rule">${a.reason} +$${a.inc}</span>
        <span class="sp-r-budget">
          <span class="sp-r-old">$${a.budget}</span>
          <span class="sp-r-arrow">→</span>
          <span class="sp-r-new">$${a.newBudget}</span>
        </span>
      </div>
    `).join('');
    resultPanel.classList.remove('hidden');
  }

  addLog('掃描', `找到 ${adjs.length} 個可調整廣告`);
  if (scanBtn) scanBtn.disabled = false;
  if (executeBtn) executeBtn.disabled = false;
  scanDone = true;
}

// ========================
//  廣告 — 執行調整
// ========================
async function runExecute() {
  const scanBtn = document.getElementById('scanBtn');
  const executeBtn = document.getElementById('executeBtn');
  const progress = document.getElementById('spProgress');
  const fill = document.getElementById('spProgressFill');
  const label = document.getElementById('spProgressLabel');
  const resultPanel = document.getElementById('executeResultPanel');

  if (scanBtn) scanBtn.disabled = true;
  if (executeBtn) executeBtn.disabled = true;
  if (progress) progress.classList.remove('hidden');
  if (label) label.textContent = '執行調整中...';
  if (resultPanel) { resultPanel.classList.add('hidden'); resultPanel.innerHTML = ''; }

  const adjs = calcAdjustments();

  for (let i = 0; i < adjs.length; i++) {
    const ad = adjs[i];
    const p = Math.round(((i + 1) / adjs.length) * 100);
    if (label) label.textContent = `調整 ${ad.name}...`;
    if (fill) fill.style.width = p + '%';

    const row = document.querySelector(`tr[data-id="${ad.id}"]`);
    if (row) {
      row.classList.add('s-adjusting');
      await delay(800);   // 380 → 800
      const cell = row.querySelector('.s-budget');
      if (cell) {
        cell.textContent = `$${ad.newBudget}`;
        cell.classList.add('updated');
        setTimeout(() => cell.classList.remove('updated'), 700);
      }
      row.classList.remove('s-adjusting');
      row.classList.add('s-done');
    }
    await delay(500);   // 280 → 500
  }

  await delay(500);  // 300 → 500
  if (progress) progress.classList.add('hidden');
  if (fill) fill.style.width = '0%';

  if (resultPanel) {
    resultPanel.className = 'sp-result-panel success';
    resultPanel.innerHTML = adjs.map(a => `
      <div class="sp-result-item">
        <span>✅</span>
        <span class="sp-r-name">${a.name}</span>
        <span class="sp-r-budget">
          <span class="sp-r-old">$${a.budget}</span>
          <span class="sp-r-arrow">→</span>
          <span class="sp-r-new">$${a.newBudget}</span>
        </span>
      </div>
    `).join('') + `<div class="sp-result-summary">✅ 成功調整 ${adjs.length} 個廣告，推播中...</div>`;
    resultPanel.classList.remove('hidden');
  }

  addLog('執行', `成功調整 ${adjs.length} 個廣告`);

  const now = new Date();
  const lastRun = document.getElementById('spLastRun');
  if (lastRun) {
    const h = now.getHours();
    lastRun.textContent = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${h >= 12 ? '下午' : '上午'}${h > 12 ? h-12 : h}:${String(now.getMinutes()).padStart(2,'0')}`;
  }

  await delay(800);   // 500 → 800
  showTelegramNotification(adjs);

  if (scanBtn) scanBtn.disabled = false;
  if (executeBtn) executeBtn.disabled = true;
  scanDone = false;
}

// ========================
//  廣告 — 預算重置
// ========================
async function runResetBudget() {
  const progress = document.getElementById('spProgress');
  const fill = document.getElementById('spProgressFill');
  const label = document.getElementById('spProgressLabel');
  const resultPanel = document.getElementById('executeResultPanel');

  if (progress) progress.classList.remove('hidden');
  if (resultPanel) { resultPanel.classList.add('hidden'); resultPanel.innerHTML = ''; }

  const entries = Object.entries(RESET_BUDGETS);
  for (let i = 0; i < entries.length; i++) {
    const [id, budget] = entries[i];
    const pct = Math.round(((i + 1) / entries.length) * 100);
    const adName = AD_DATA.find(a => a.id === id)?.name || id;
    if (label) label.textContent = `重置 ${adName}...`;
    if (fill) fill.style.width = pct + '%';

    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
      row.classList.remove('s-done');
      row.classList.add('s-adjusting');
      await safeDelay(600);
      const cell = row.querySelector('.s-budget');
      if (cell) {
        cell.textContent = `$${budget}`;
        cell.classList.add('updated');
        setTimeout(() => cell.classList.remove('updated'), 800);
      }
      row.classList.remove('s-adjusting');
    }
    await safeDelay(400);
  }

  await delay(400);
  if (progress) progress.classList.add('hidden');
  if (fill) fill.style.width = '0%';

  if (resultPanel) {
    resultPanel.className = 'sp-result-panel info';
    resultPanel.innerHTML = `
      <div class="sp-result-item">
        <span>✅</span>
        <span class="sp-r-name">最佳廣告：藍芽耳機旗艦款</span>
        <span class="sp-r-rule">維持 $170</span>
      </div>
      <div class="sp-result-item">
        <span>🔄</span>
        <span class="sp-r-name">其他 3 個廣告</span>
        <span class="sp-r-rule">重置為 $85</span>
      </div>
      <div class="sp-result-summary">✅ 已重置 ${entries.length} 個廣告預算</div>
    `;
    resultPanel.classList.remove('hidden');
  }

  addLog('重置', `${entries.length} 個廣告預算歸零`);
}

// ========================
//  TG 通知
// ========================
function showTelegramNotification(adjs) {
  const chat = document.getElementById('tgChat');
  if (!chat) return;
  const now = new Date();
  const ts = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const lines = adjs.map(a => `✅ ${a.name} $${a.budget}→$${a.newBudget}`).join('\n');
  chat.innerHTML = `
    <div class="tg-message">
      <div class="tg-bot-name">🤖 運營工具箱</div>
      <div class="tg-content">📊 <strong>排程調整報告</strong>
🏪 賣場：商店名稱
🕐 時間：${ts}
─────────────────
${lines}
─────────────────
📈 成功調整：${adjs.length} 個
❌ 失敗：0 個</div>
    </div>
  `;
  addLog('TG', `排程報告已發送 (${adjs.length}筆)`);
}

// ========================
//  廣告 Tab — 核心動畫
// ========================
async function _runAdDemoAnimation() {
  const { sp: spFrame, shopee: shopeeFrame } = _getFrames();

  spotlightOff();
  switchFtab('ad');
  switchSpTab('ad');
  await safeDelay(800);

  // === 功能簡介字幕（全畫面正常顯示）===
  await showSubtitles([
    '排程自動調整 — 最具殺傷力的便利功能',
    '完全解放電腦座位前的經營者',
    '定時拿手機檢視報告，即可輕鬆控制預算',
  ], 4500);

  // === 調整規則 ===
  setStep('⚙️ 確認調整規則與觸發條件...');
  spotlight(spFrame);
  const rulesCard = document.getElementById('spRulesCard');
  if (rulesCard) {
    rulesCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await safeDelay(600);
    highlight(rulesCard);
  }
  await safeDelay(3500);

  // === 排程設定 ===
  setStep('⏰ 排程時間到，系統自動開始執行！');
  const schedCard = document.getElementById('spScheduleCard');
  if (schedCard) {
    schedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await safeDelay(600);
    highlight(schedCard);
  }

  const countdown = document.getElementById('spCountdown');
  const timeEl = document.getElementById('spCountdownTime');
  if (countdown) countdown.classList.remove('hidden');
  for (let s = 3; s >= 0; s--) {
    if (timeEl) timeEl.textContent = `00:0${s}`;
    await safeDelay(s === 3 ? 1000 : 900);
  }
  if (countdown) countdown.classList.add('hidden');
  await safeDelay(600);

  // === 掃描 ===
  setStep('🔍 自動掃描廣告數據，計算調整方案...');
  spotlight(spFrame);
  const scanBtnEl = document.getElementById('scanBtn');
  if (scanBtnEl) scanBtnEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await safeDelay(800);

  await runScan();
  await safeDelay(1500);

  // === 執行調整 ===
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) stopBtn.classList.remove('hidden');
  spotlightBoth();
  setStep('⚡ 執行調整中 — 執行時可隨時按「緊急停止」中斷操作');
  highlight(document.getElementById('executeBtn'));
  await safeDelay(2500);

  await runExecute();
  if (stopBtn) stopBtn.classList.add('hidden');
  await safeDelay(1500);

  // === TG 推播 ===
  spotlightOff();
  setStep('📱 Telegram 推播報告已發送！');
  const tgWrap = document.getElementById('tgWrap');
  if (tgWrap) tgWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await safeDelay(4500);

  // === 預算重置演示 ===
  setStep('🔄 預算重置 — 一鍵將廣告預算歸零，隔天重新開始');
  spotlight(spFrame);
  const adResetBtn = document.getElementById('adResetBtn');
  if (adResetBtn) {
    adResetBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await safeDelay(600);
    highlight(adResetBtn);
  }
  await safeDelay(2500);

  setStep('⚙️ 系統自動選出最佳廣告，其餘重置為基準預算...');
  spotlightBoth();
  await runResetBudget();
  await safeDelay(1500);

  spotlightOff();
  setStep('📅 適合每日固定預算的賣家 — 隔天排程自動重新調整');
  await safeDelay(4500);
}

// ========================
//  限時特賣 Tab — 核心動畫
// ========================
async function _runFlashDemoAnimation() {
  const { sp: spFrame, shopee: shopeeFrame } = _getFrames();

  // === 功能簡介字幕 ===
  await showSubtitles([
    '快速設定活動庫存 — 多檔次輪流的利器',
    '讓賣家快速完成銷售計畫布局',
  ], 4500);

  // === 選擇模式 ===
  setStep('🏷️ 選擇庫存設定方式 — 活動庫存 = 現有庫存 ÷ 2');
  spotlight(spFrame);
  highlight(document.getElementById('flashModeCard'));
  await safeDelay(3000);

  // === 預覽 ===
  setStep('👆 點擊「預覽變更」查看修改前後對比');
  const previewBtn = document.getElementById('flashPreviewBtn');
  spotlight(spFrame);
  highlight(previewBtn);
  await safeDelay(2000);

  setStep('📋 預覽結果 — 原庫存 ÷ 2，確認無誤後執行');
  const resultPanel = document.getElementById('flashResultPanel');
  if (resultPanel) {
    resultPanel.className = 'sp-result-panel info';
    resultPanel.innerHTML = FLASH_ITEMS.map(item => `
      <div class="sp-result-item">
        <span>📋</span>
        <span class="sp-r-name">${item.name}</span>
        <span class="sp-r-budget">
          <span class="sp-r-old">${item.orig}</span>
          <span class="sp-r-arrow">→</span>
          <span class="sp-r-new">${Math.ceil(item.orig / 2)}</span>
        </span>
      </div>
    `).join('');
    resultPanel.classList.remove('hidden');
  }
  const execBtn = document.getElementById('flashExecuteBtn');
  if (execBtn) execBtn.disabled = false;
  await safeDelay(3000);

  // === 執行 ===
  setStep('🚀 確認後點擊「執行修改」，蝦皮後台庫存即時更新');
  spotlight(spFrame);
  highlight(execBtn);
  await safeDelay(1800);

  setStep('⚙️ 逐一更新活動庫存...');
  const progress = document.getElementById('flashProgress');
  const fill = document.getElementById('flashProgressFill');
  const label = document.getElementById('flashProgressLabel');
  if (progress) progress.classList.remove('hidden');

  spotlightBoth();

  for (let i = 0; i < FLASH_ITEMS.length; i++) {
    const item = FLASH_ITEMS[i];
    const pct = Math.round(((i + 1) / FLASH_ITEMS.length) * 100);
    if (label) label.textContent = `修改 ${item.name}...`;
    if (fill) fill.style.width = pct + '%';

    const row = document.getElementById(`f2-row-${item.idx}`);
    const stockCell = document.getElementById(`f2-stock-${item.idx}`);
    if (row) row.classList.add('s-adjusting');
    await safeDelay(1000);   // 600 → 1000
    if (stockCell) {
      stockCell.textContent = Math.ceil(item.orig / 2);
      stockCell.classList.add('updated');
      setTimeout(() => stockCell.classList.remove('updated'), 800);
    }
    if (row) { row.classList.remove('s-adjusting'); row.classList.add('s-done'); }
    await safeDelay(600);   // 350 → 600
  }

  if (progress) progress.classList.add('hidden');
  if (fill) fill.style.width = '0%';

  setStep(`✅ 限時特賣庫存設定完成 — 已修改 ${FLASH_ITEMS.length} 個商品`);
  if (resultPanel) {
    resultPanel.className = 'sp-result-panel success';
    resultPanel.innerHTML = FLASH_ITEMS.map(item => `
      <div class="sp-result-item">
        <span>✅</span>
        <span class="sp-r-name">${item.name}</span>
        <span class="sp-r-budget">
          <span class="sp-r-old">${item.orig}</span>
          <span class="sp-r-arrow">→</span>
          <span class="sp-r-new">${Math.ceil(item.orig / 2)}</span>
        </span>
      </div>
    `).join('') + `<div class="sp-result-summary">✅ 成功修改 ${FLASH_ITEMS.length} 個商品庫存</div>`;
  }
  spotlightOff();
  await safeDelay(5000);   // 2500 → 5000
}

// ========================
//  優惠券 Tab — 核心動畫
// ========================
async function _runVoucherDemoAnimation() {
  const { sp: spFrame, shopee: shopeeFrame } = _getFrames();

  // === 功能簡介字幕 ===
  await showSubtitles([
    '快速建立優惠券 — 大幅縮短操作時間',
    '縮短優惠券效期，促使買家快速決定下單',
  ], 4500);

  // === 選擇範本 ===
  setStep('🎫 選擇優惠券範本 — 一鍵套用折扣設定');
  spotlight(spFrame);
  const tplItems = document.querySelectorAll('#vTplList .sp-template-item');
  const tplItem = tplItems[VOUCHER_DEMO.tplIdx];
  if (tplItem) {
    tplItem.classList.add('v-tpl-active');
    tplItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  await safeDelay(2800);   // 1800 → 2800

  // === 套用 ===
  setStep('✅ 套用範本「' + VOUCHER_DEMO.name + '」— 點擊 ✓ 確認');
  if (tplItem) {
    const applyBtn = tplItem.querySelector('.sp-t-apply');
    if (applyBtn) highlight(applyBtn);
  }
  await safeDelay(2000);   // 1000 → 2000

  // === 填入日期 ===
  setStep('📅 自動填入優惠券使用時間');
  spotlight(spFrame);
  const vStart = document.getElementById('vStartDate');
  const vEnd = document.getElementById('vEndDate');
  if (vStart) {
    vStart.value = '';
    vStart.classList.add('input-flash');
    await safeDelay(300);
    vStart.value = '202604010000';
    setTimeout(() => vStart.classList.remove('input-flash'), 700);
  }
  await safeDelay(800);
  if (vEnd) {
    vEnd.value = '';
    vEnd.classList.add('input-flash');
    await safeDelay(300);
    vEnd.value = '202604300000';
    setTimeout(() => vEnd.classList.remove('input-flash'), 700);
  }
  await safeDelay(1800);   // 1200 → 1800

  // === 生成代碼 ===
  setStep('🎲 自動生成隨機優惠代碼（5碼英數字）');
  spotlight(spFrame);
  const codeDisplay = document.getElementById('vCodeDisplay');
  let generatedCode = 'M3X9K';
  if (codeDisplay) generatedCode = await genCodeAnimation(codeDisplay);
  await safeDelay(2000);   // 1000 → 2000

  // === 快速填入 ===
  setStep('🚀 點擊「快速填入」— 自動填入蝦皮後台所有欄位');
  spotlight(spFrame);
  const fillBtn = document.getElementById('vFillBtn');
  if (fillBtn) highlight(fillBtn);
  await safeDelay(1800);   // 900 → 1800

  // === 蝦皮後台逐欄填入 ===
  setStep('✍️ 蝦皮後台表單逐欄自動填入...');
  spotlightBoth();
  await typeInto(document.getElementById('v2-name'), VOUCHER_DEMO.name, 60);
  await delay(600);   // 250 → 600
  await typeInto(document.getElementById('v2-code'), generatedCode, 90);
  await delay(600);
  await typeInto(document.getElementById('v2-period'), '2026/04/01 00:00 至 2026/04/30 00:00', 28);
  await delay(600);
  await typeInto(document.getElementById('v2-discount'), `NT$${VOUCHER_DEMO.discount}`, 70);
  await delay(600);
  await typeInto(document.getElementById('v2-minimum'), `NT$${VOUCHER_DEMO.min}`, 70);
  await safeDelay(3000);   // 1500 → 3000

  // === 完成 ===
  spotlightOff();
  setStep('✅ 優惠券資料已填入完畢 — 確認後點擊送出即可');
  await safeDelay(5000);   // 2500 → 5000
}

// ========================
//  廣告 Tab — 重置
// ========================
function resetAdDemo() {
  scanDone = false;
  spotlightOff();

  const scanBtn = document.getElementById('scanBtn');
  const executeBtn = document.getElementById('executeBtn');
  const stopBtn = document.getElementById('stopBtn');
  if (scanBtn) scanBtn.disabled = false;
  if (executeBtn) executeBtn.disabled = true;
  if (stopBtn) stopBtn.classList.add('hidden');

  ['scanResultPanel', 'executeResultPanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
  });

  const progress = document.getElementById('spProgress');
  const fill = document.getElementById('spProgressFill');
  if (progress) progress.classList.add('hidden');
  if (fill) fill.style.width = '0%';

  const countdown = document.getElementById('spCountdown');
  if (countdown) countdown.classList.add('hidden');

  AD_DATA.forEach(ad => {
    const row = document.querySelector(`tr[data-id="${ad.id}"]`);
    if (!row) return;
    row.classList.remove('s-adjusting', 's-done');
    const cell = row.querySelector('.s-budget');
    if (cell) { cell.textContent = `$${ad.budget}`; cell.classList.remove('updated'); }
  });

  const log = document.getElementById('spLog');
  if (log) log.innerHTML = '<div class="sp-log-empty">尚無操作記錄</div>';

  const chat = document.getElementById('tgChat');
  if (chat) chat.innerHTML = '<div class="tg-empty">排程自動執行後，通知將顯示於此 📬</div>';

  const lastRun = document.getElementById('spLastRun');
  if (lastRun) lastRun.textContent = '2026/3/23 下午5:35';
}

// ========================
//  全域重置
// ========================
function resetDemo() {
  isPlaying = false;
  stopRequested = false;
  clearTimeout(_stepTimer);
  spotlightOff();

  const btn = document.getElementById('autoPlayBtn');
  if (btn) {
    btn.classList.remove('playing');
    document.getElementById('autoPlayIcon').textContent = '▶';
    document.getElementById('autoPlayLabel').textContent = '三Tab連播';
  }

  setStep('');
  resetAdDemo();
  resetFlashSaleDemo();
  resetVoucherDemo();
  switchFtab('ad');
}

// ========================
//  三Tab 自動播放
// ========================
async function autoPlay() {
  if (isPlaying) return;
  isPlaying = true;
  stopRequested = false;

  const btn = document.getElementById('autoPlayBtn');
  btn.classList.add('playing');
  document.getElementById('autoPlayIcon').textContent = '⏹';
  document.getElementById('autoPlayLabel').textContent = '停止';

  ['playFlashSaleBtn', 'playVoucherBtn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = true;
  });

  try {
    // ==== Tab 1: 廣告管理 ====
    resetAdDemo();
    await _runAdDemoAnimation();
    await safeDelay(1500);   // 800 → 1500

    // ==== Tab 2: 限時特賣 ====
    resetFlashSaleDemo();
    switchFtab('flash');
    await safeDelay(1000);   // 600 → 1000
    await _runFlashDemoAnimation();
    await safeDelay(1500);

    // ==== Tab 3: 優惠券 ====
    resetVoucherDemo();
    switchFtab('voucher');
    await safeDelay(1000);
    await _runVoucherDemoAnimation();
    await safeDelay(1500);

    // ==== 結尾字幕 ====
    await showSubtitles([
      '半自動 / 全自動，減輕繁瑣操作的負擔',
      '還給經營者生活品質 ✨',
    ], 4500);

  } catch(e) {
    if (e.message !== 'STOP') throw e;
    setStep('');
    spotlightOff();
    resetAdDemo();
    resetFlashSaleDemo();
    resetVoucherDemo();
  } finally {
    isPlaying = false;
    stopRequested = false;
    spotlightOff();
    btn.classList.remove('playing');
    document.getElementById('autoPlayIcon').textContent = '▶';
    document.getElementById('autoPlayLabel').textContent = '再播一次';

    ['playFlashSaleBtn', 'playVoucherBtn'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.disabled = false;
    });
  }
}

function stopDemo() {
  if (!isPlaying) return;
  stopRequested = true;
}

// ========================
//  限時特賣 — 獨立播放
// ========================
async function playFlashSaleDemo() {
  if (flashPlaying || isPlaying) return;
  flashPlaying = true;
  stopRequested = false;

  const playBtn = document.getElementById('playFlashSaleBtn');
  if (playBtn) { playBtn.disabled = true; playBtn.textContent = '⏸ 播放中...'; }

  try {
    await _runFlashDemoAnimation();
  } catch(e) {
    if (e.message !== 'STOP') throw e;
    resetFlashSaleDemo();
    setStep('');
    return;
  } finally {
    flashPlaying = false;
    stopRequested = false;
    spotlightOff();
    if (playBtn) { playBtn.disabled = false; playBtn.textContent = '▶ 再播一次'; }
  }
}

// ========================
//  限時特賣 — 重置
// ========================
function resetFlashSaleDemo() {
  flashPlaying = false;
  spotlightOff();

  const playBtn = document.getElementById('playFlashSaleBtn');
  if (playBtn && !isPlaying) { playBtn.disabled = false; playBtn.textContent = '▶ 播放演示'; }

  const previewBtn = document.getElementById('flashPreviewBtn');
  const execBtn = document.getElementById('flashExecuteBtn');
  if (previewBtn) previewBtn.disabled = false;
  if (execBtn) execBtn.disabled = true;

  const progress = document.getElementById('flashProgress');
  const fill = document.getElementById('flashProgressFill');
  if (progress) progress.classList.add('hidden');
  if (fill) fill.style.width = '0%';

  const resultPanel = document.getElementById('flashResultPanel');
  if (resultPanel) { resultPanel.classList.add('hidden'); resultPanel.innerHTML = ''; }

  FLASH_ITEMS.forEach(item => {
    const row = document.getElementById(`f2-row-${item.idx}`);
    const stockCell = document.getElementById(`f2-stock-${item.idx}`);
    if (row) row.classList.remove('s-adjusting', 's-done');
    if (stockCell) { stockCell.textContent = item.orig; stockCell.classList.remove('updated'); }
  });
}

// ========================
//  優惠券 — 獨立播放
// ========================
async function playVoucherDemo() {
  if (voucherPlaying || isPlaying) return;
  voucherPlaying = true;
  stopRequested = false;

  const playBtn = document.getElementById('playVoucherBtn');
  if (playBtn) { playBtn.disabled = true; playBtn.textContent = '⏸ 播放中...'; }

  try {
    await _runVoucherDemoAnimation();
  } catch(e) {
    if (e.message !== 'STOP') throw e;
    resetVoucherDemo();
    setStep('');
    return;
  } finally {
    voucherPlaying = false;
    stopRequested = false;
    spotlightOff();
    if (playBtn) { playBtn.disabled = false; playBtn.textContent = '▶ 再播一次'; }
  }
}

// ========================
//  優惠券 — 重置
// ========================
function resetVoucherDemo() {
  voucherPlaying = false;
  spotlightOff();

  const playBtn = document.getElementById('playVoucherBtn');
  if (playBtn && !isPlaying) { playBtn.disabled = false; playBtn.textContent = '▶ 播放演示'; }

  document.querySelectorAll('#vTplList .sp-template-item').forEach(el => el.classList.remove('v-tpl-active'));

  const vStart = document.getElementById('vStartDate');
  const vEnd = document.getElementById('vEndDate');
  if (vStart) { vStart.value = '202604010000'; vStart.classList.remove('input-flash'); }
  if (vEnd) { vEnd.value = '202604300000'; vEnd.classList.remove('input-flash'); }

  const codeDisplay = document.getElementById('vCodeDisplay');
  if (codeDisplay) { codeDisplay.textContent = '--'; codeDisplay.classList.remove('generating'); }

  ['v2-name', 'v2-code', 'v2-period', 'v2-discount', 'v2-minimum'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = '—'; el.classList.remove('filling', 'filled'); }
  });
}

// ========================
//  Feature / SP Tab 切換
// ========================
function switchFtab(id) {
  document.querySelectorAll('.ftab').forEach(b => b.classList.toggle('active', b.dataset.ftab === id));
  document.querySelectorAll('.ftab-content').forEach(c => c.classList.toggle('active', c.id === `ftab-${id}`));
  const pageMap = { ad: 'spage-ad', flash: 'spage-flash', voucher: 'spage-coupon' };
  document.querySelectorAll('.s-page').forEach(p => p.classList.remove('active'));
  const spage = document.getElementById(pageMap[id] || 'spage-ad');
  if (spage) spage.classList.add('active');
}

function switchSpTab(id) {
  document.querySelectorAll('#spBody .sp-tab').forEach(b => b.classList.toggle('active', b.dataset.sptab === id));
  document.querySelectorAll('#spBody .sp-tab-content').forEach(c => c.classList.toggle('active', c.id === `sptab-${id}`));
}

// ========================
//  初始化
// ========================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('spage-ad').classList.add('active');
  document.getElementById('autoPlayLabel').textContent = '三Tab連播';

  // ── 開場高亮（引導用戶點播放）──
  const autoPlayBtn = document.getElementById('autoPlayBtn');
  autoPlayBtn.classList.add('ctrl-btn-attention');

  // ── 頂部按鈕（播放 / 停止）──
  autoPlayBtn.addEventListener('click', () => {
    autoPlayBtn.classList.remove('ctrl-btn-attention');
    if (isPlaying) {
      stopDemo();
    } else {
      resetDemo();
      setTimeout(autoPlay, 200);
    }
  });

  document.getElementById('resetBtn').addEventListener('click', resetDemo);

  // ── 廣告管理手動按鈕 ──
  const scanBtn = document.getElementById('scanBtn');
  if (scanBtn) {
    scanBtn.addEventListener('click', async () => {
      if (scanDone || isPlaying) return;
      setStep('掃描廣告數據中...');
      await runScan();
      setStep('掃描完成！點擊「執行調整」更新預算');
    });
  }

  const executeBtn = document.getElementById('executeBtn');
  if (executeBtn) {
    executeBtn.addEventListener('click', async () => {
      if (isPlaying) return;
      const stopBtn = document.getElementById('stopBtn');
      if (stopBtn) stopBtn.classList.remove('hidden');
      setStep('執行廣告預算調整中...');
      await runExecute();
      if (stopBtn) stopBtn.classList.add('hidden');
      setStep('✅ 執行完成！Telegram 報告已發送');
    });
  }

  // ── 緊急停止（Demo 展示用，點擊後隱藏） ──
  const stopBtnEl = document.getElementById('stopBtn');
  if (stopBtnEl) {
    stopBtnEl.addEventListener('click', () => {
      setStep('🛑 緊急停止已觸發！操作中止');
      setTimeout(() => stopBtnEl.classList.add('hidden'), 1400);
    });
  }

  // ── 限時特賣 ──
  document.getElementById('playFlashSaleBtn')?.addEventListener('click', () => {
    if (!flashPlaying && !isPlaying) { resetFlashSaleDemo(); setTimeout(playFlashSaleDemo, 200); }
  });
  document.getElementById('resetFlashSaleBtn')?.addEventListener('click', () => {
    resetFlashSaleDemo(); setStep('');
  });

  // ── 優惠券 ──
  document.getElementById('playVoucherBtn')?.addEventListener('click', () => {
    if (!voucherPlaying && !isPlaying) { resetVoucherDemo(); setTimeout(playVoucherDemo, 200); }
  });
  document.getElementById('resetVoucherBtn')?.addEventListener('click', () => {
    resetVoucherDemo(); setStep('');
  });

  // ── Feature Tab 切換 ──
  document.querySelectorAll('.ftab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchFtab(btn.dataset.ftab);
      if (!isPlaying) { setStep(''); spotlightOff(); }
    });
  });

  // ── SP Tab（廣告管理頁） ──
  document.querySelectorAll('#spBody .sp-tab').forEach(btn => {
    btn.addEventListener('click', () => switchSpTab(btn.dataset.sptab));
  });

  // ── 排程 Toggle ──
  const schedTog = document.getElementById('scheduleToggle');
  if (schedTog) {
    schedTog.addEventListener('change', () => {
      const isOn = schedTog.checked;
      document.querySelectorAll('.sp-mchip input, #spStartHour, #spEndHour, #spScheduleSave').forEach(el => {
        el.disabled = isOn;
      });
      document.querySelector('#spBody .sp-settings-row .sp-toggle input').disabled = isOn;
      addLog('排程', isOn ? '排程已啟用' : '排程已停用');
    });
  }
});

// ===== 橫向提示 =====
(function () {
  const SESSION_KEY = 'orientDismissed';

  function isPortraitMobile() {
    return window.innerWidth < 768 && window.innerHeight > window.innerWidth;
  }

  function init() {
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const overlay = document.getElementById('orientOverlay');
    const btn = document.getElementById('orientDismiss');
    if (!overlay || !btn) return;

    if (isPortraitMobile()) overlay.classList.add('show');

    function onResize() {
      if (!isPortraitMobile()) overlay.classList.remove('show');
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    btn.addEventListener('click', function () {
      sessionStorage.setItem(SESSION_KEY, '1');
      overlay.classList.remove('show');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
