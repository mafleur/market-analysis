(async function () {
  const app = document.getElementById("app");
  document.getElementById("nav").innerHTML = API.nav("stocks");

  let idx;
  try { idx = await API.index(); } catch (e) {
    app.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다.</div>`; return;
  }
  const stocks = idx.stocks || {};
  let tickers = Object.keys(stocks);
  if (tickers.length === 0) {
    app.innerHTML = `<div class="empty">아직 종목 분석이 없습니다. <code>/종목분석 TICKER</code>를 실행하세요.</div>`;
    return;
  }
  // 보유 우선 → 최신순
  tickers.sort((a, b) => (!!stocks[b].held - !!stocks[a].held) ||
    (stocks[b].latest || "").localeCompare(stocks[a].latest || ""));

  const params = new URLSearchParams(location.search);
  let curTicker = params.get("ticker");
  if (!stocks[curTicker]) curTicker = tickers[0];
  let heldOnly = false;

  app.innerHTML = `
    <div class="page-head"><h1>종목 분석</h1><p>손익비 · 주도주 · 파동 · 수급 기반 포지션 전략. 차트와 보고서 본문을 함께 봅니다.</p></div>
    <div class="detail">
      <div class="sidebar">
        <div class="toggle" id="toggle">
          <button data-v="all" class="active">전체</button>
          <button data-v="held">보유만</button>
        </div>
        <div class="picker" id="picker"></div>
        <div class="section-title" style="margin-top:22px"><h2>분석 이력</h2></div>
        <div class="history-list" id="hist"></div>
      </div>
      <div id="body"></div>
    </div>`;

  document.querySelectorAll("#toggle button").forEach(b =>
    b.addEventListener("click", () => {
      heldOnly = b.dataset.v === "held";
      document.querySelectorAll("#toggle button").forEach(x => x.classList.toggle("active", x === b));
      renderPicker();
    }));

  function renderPicker() {
    const list = tickers.filter(t => !heldOnly || stocks[t].held);
    const picker = document.getElementById("picker");
    picker.innerHTML = list.map(t => {
      const s = stocks[t];
      return `<div class="p-item ${t === curTicker ? "active" : ""}" data-t="${t}">
        <div class="nm"><span class="tag-mkt ${s.market || ""}">${s.market || ""}</span>${API.esc(s.name || t)}${s.held ? ` <span class="badge brand" style="font-size:10px;padding:1px 7px">보유</span>` : ""}</div>
        <div class="sub">${API.esc(t)} · ${s.latest || ""}</div>
      </div>`;
    }).join("") || `<div class="empty" style="padding:20px">보유 종목이 없습니다.</div>`;
    picker.querySelectorAll(".p-item").forEach(el =>
      el.addEventListener("click", () => selectTicker(el.dataset.t)));
  }

  function selectTicker(t) {
    curTicker = t;
    window.history.replaceState(null, "", `?ticker=${encodeURIComponent(t)}`);
    document.querySelectorAll("#picker .p-item").forEach(el => el.classList.toggle("active", el.dataset.t === t));
    renderHistory();
    render(stocks[t].history[0]);
  }

  function renderHistory() {
    const s = stocks[curTicker];
    const hist = document.getElementById("hist");
    hist.innerHTML = s.history.map(d =>
      `<div class="h-item" data-d="${d}">
         <span>${d}</span><span class="fresh ${API.daysAgo(d) >= 7 ? "stale" : API.daysAgo(d) >= 3 ? "warn" : "ok"}"><span class="led"></span>${API.relDay(API.daysAgo(d))}</span>
       </div>`).join("");
    hist.querySelectorAll(".h-item").forEach(el =>
      el.addEventListener("click", () => render(el.dataset.d)));
  }

  async function render(date) {
    document.querySelectorAll("#hist .h-item").forEach(el => el.classList.toggle("active", el.dataset.d === date));
    const body = document.getElementById("body");
    body.innerHTML = `<div class="empty">불러오는 중…</div>`;
    let r;
    try { r = await API.stockReport(curTicker, date); } catch (e) {
      body.innerHTML = `<div class="empty">리포트를 불러오지 못했습니다.</div>`; return;
    }

    const f = r.fundamentals || {};
    const pos = r.position || {};
    const metric = (k, v) => v == null || v === "" ? "" :
      `<div class="metric"><span class="k">${k}</span><span class="v">${v}</span></div>`;

    let html = `
      <div class="card pad-lg">
        <div class="dh">
          <div>
            <div class="title"><span class="tag-mkt ${r.market || ""}">${r.market || ""}</span>${API.esc(r.name || r.ticker)}</div>
            <div class="meta">
              <span class="ticker">${API.esc(r.ticker)}</span>
              ${API.verdictBadge(r.verdict, r.verdict_label)}
              ${r.is_leader != null ? `<span class="badge ${r.is_leader ? "green" : "ghost"}">주도주 ${r.is_leader ? "YES" : "NO"}</span>` : ""}
              ${API.regimeBadge(r.regime)}
              ${API.freshness(date)}
            </div>
          </div>
          <div style="text-align:right"><div class="price">${API.price(r.price, r.market)}</div></div>
        </div>
        ${r.summary ? `<div class="callout"><b>한 줄 결론.</b> ${API.esc(r.summary)}</div>` : ""}
        <div class="metrics">
          ${metric("손익비", r.rr == null ? "—" : `${r.rr}:1`)}
          ${metric("vs시장 3M", API.signed(r.rs_3m))}
          ${metric("vs시장 6M", API.signed(r.rs_6m))}
          ${metric("vs섹터 3M", r.rs_sector_3m == null ? "" : `${API.signed(r.rs_sector_3m)}${r.sector_etf ? ` (${API.esc(r.sector_etf)})` : ""}`)}
          ${metric("ATR", r.atr == null ? "" : `${r.atr}${r.atr_pct == null ? "" : ` (${r.atr_pct}%)`}`)}
          ${metric("RSI", r.rsi == null ? "—" : r.rsi)}
          ${metric("다이버전스", r.divergence === "bullish" ? "강세 ▲" : r.divergence === "bearish" ? "약세 ▼" : "없음")}
          ${metric("파동", r.wave ? API.esc(r.wave) : "")}
        </div>
        <div class="metrics" style="border-top:1px solid var(--border);padding-top:14px">
          ${metric("시총", f.market_cap)}
          ${metric("매출(TTM)", f.rev_ttm)}
          ${metric("영업마진", f.op_margin == null ? "" : f.op_margin + "%")}
          ${metric("Fwd PE", f.fwd_pe)}
          ${metric("목표가", f.target == null ? "" : API.price(f.target, r.market))}
        </div>
        ${(pos.entry || pos.stop || pos.trail) ? `<div class="callout">
          <b>포지션.</b>
          ${pos.entry ? ` 평단 ${API.price(pos.entry, r.market)}` : ""}
          ${pos.stop ? ` · 손절 ${API.price(pos.stop, r.market)}` : ""}
          ${pos.trail ? ` · ${API.esc(pos.trail)}` : ""}
        </div>` : ""}
        ${(() => {
          const v = r.vbp || {};
          const hasV = v.poc != null || (v.resistance && v.resistance.length) || (v.support && v.support.length);
          if (!hasV) return "";
          const lvls = (arr) => (arr && arr.length) ? arr.map(p => API.price(p, r.market)).join(" · ") : "—";
          return `<div class="callout"><b>매물대.</b>
            ${v.poc != null ? ` POC ${API.price(v.poc, r.market)}` : ""}
            · 위 저항 ${lvls(v.resistance)}
            · 아래 지지 ${lvls(v.support)}</div>`;
        })()}
        ${(r.scenario && (r.scenario.up || r.scenario.down)) ? `<div class="callout"><b>시나리오.</b>
          ${r.scenario.up ? ` <b>지지 시</b> ${API.esc(r.scenario.up)}` : ""}
          ${r.scenario.down ? ` · <b>이탈 시</b> ${API.esc(r.scenario.down)}` : ""}</div>` : ""}
        ${r.credit_short ? `<div class="callout"><b>수급/신용.</b> ${API.esc(r.credit_short)}</div>` : ""}
      </div>`;

    if (r.chart) html += `<div class="chart-box"><img src="${API.esc(r.chart)}" alt="${API.esc(r.name || r.ticker)} 차트"></div>`;

    if (r.report_md) html += `
      <div class="card pad-lg">
        <div class="card-head"><div class="t"><h3>분석 보고서</h3></div></div>
        <div class="md">${API.renderMD(r.report_md)}</div>
      </div>`;

    body.innerHTML = html;
  }

  renderPicker();
  selectTicker(curTicker);
})();
