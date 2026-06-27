(async function () {
  const app = document.getElementById("app");
  document.getElementById("nav").innerHTML = API.nav("stocks");

  // 시장 → 벤치마크 지수 라벨 (vs시장 상대강도 기준)
  const BENCH = {
    US: "S&P500", KR: "KOSPI", JP: "닛케이225", HK: "항셍", CN: "상하이종합",
    TW: "대만가권", DE: "DAX", UK: "FTSE100", FR: "CAC40", IN: "Nifty50",
  };
  const benchLabel = (m) => BENCH[m] || "벤치마크 지수";

  // ⓘ 툴팁 마커
  const tipMark = (text) => text ? `<span class="tip" data-tip="${API.esc(text)}">i</span>` : "";
  const refTag = `<span class="tag-ref">참고</span>`;
  const injectRefTags = (html) => html.replace(
    /<strong>([^<]*(?:파동|다이버전스)[^<]*)<\/strong>/g,
    `<strong>$1</strong>${refTag}`
  );

  // 지표 해설 (툴팁 본문)
  const TIP = {
    rr: "손익비 = (목표가-진입가) ÷ (진입가-손절가). 3:1 이상이어야 진입. 신규 진입 시나리오가 없으면(보유 지속·신규진입 비권고) 비워둔다.",
    atr: "ATR(14): 최근 14거래일 평균 변동폭(True Range의 14일 평균).\n쓰임 ① 손절폭 = 진입가 -1.5~2 ATR(노이즈에 안 털릴 최소폭) ② 포지션 사이징(변동성 큰 종목은 자동으로 비중↓).\n변동성 레짐(확대/축소/안정) = 현재 ATR%가 최근 60일 평균 대비 어느 방향인지. 확대 = 손절폭·갭 리스크↑, 축소 = 변동성 수축(돌파 대기).",
    div: "RSI 다이버전스 = 가격과 RSI 방향 불일치(추세 전환 조기경보).\n강세 ▲: 가격 저점↓인데 RSI 저점↑ (하락 모멘텀 둔화).\n약세 ▼: 가격 고점↑인데 RSI 고점↓ (상승 모멘텀 둔화).\n없음: 마지막 두 스윙이 가격·RSI 같은 방향 = 모멘텀이 추세를 확인(건강).\n측정 불가: 비교할 스윙 고점/저점이 부족(신고가 직진 등). 보조 참고일 뿐 단독 매매 금지.",
    wave: "엘리엇 파동(보조 참고). 5파 상승 + 3파(A-B-C) 하락의 반복.\n1파 첫 반등 · 2파 되돌림 · 3파 가장 강함(불타기) · 4파 조정 · 5파 마지막(축소).\nA·B·C 하락 조정. 카운트는 확률 추정이며 손절선이 항상 우선.",
    revttm: "TTM = Trailing Twelve Months. 가장 최근 4개 분기를 합산한 직전 12개월 실적.\n회계연도와 무관하게 항상 최신 12개월을 보여줘 분기 발표 때마다 갱신된다.",
    target: "yfinance 애널리스트 평균 목표가(targetMeanPrice) — 12개월 컨센서스 평균.\n본 분석의 손익비용 목표가와는 별개이며, 현재가가 이미 이를 추월했다면 컨센서스는 추가 상향 추정이 필요하다는 신호.",
    trail: "트레일링 스탑(추적 손절): 손절선을 올리기만 한다(절대 안 내림).\nhigher-low(직전 저점) = 최근 상승 중 찍은 '눌림목 바닥'. 신고가가 새로 날 때마다 그 직전 눌림목 바닥 아래로 손절선을 끌어올려, 이익을 보호하며 추세를 끝까지 끌고 간다.",
    vbp: "매물대(Volume-by-Price) = 과거 거래량이 어느 '가격대'에 쌓였나.\nPOC(Point of Control): 거래량이 가장 두껍게 쌓인 단일 가격대. 자석처럼 가격을 끌어당기는 경향.\n위 저항: 현재가보다 '위'에 있는 매물대 — 거기서 물린 사람들이 본전에 팔아 위로 갈 때 벽(저항)이 된다.\n아래 지지: 현재가보다 '아래'에 있는 매물대 — 거기서 산 사람들이 방어해 떨어질 때 받침(지지)이 된다.",
  };

  // 파동 → 시각적 위치 표시 (5파 상승 - 3파 하락)
  const waveStage = (w) => {
    if (!w) return null;
    let m = w.match(/([1-5])\s*파/);
    if (m) return m[1];
    m = w.match(/([ABCabc])\s*파/);
    if (m) return m[1].toUpperCase();
    return null;
  };
  const waveCallout = (r) => {
    if (!r.wave) return "";
    const cur = waveStage(r.wave);
    const up = ["1", "2", "3", "4", "5"], down = ["A", "B", "C"];
    const cell = (k, isUp) =>
      `<span class="wave-step ${isUp ? "up" : "down"} ${k === cur ? "active" : ""}">${k}</span>`;
    const seq = up.map(k => cell(k, true)).join("") + `<span class="wave-sep"></span>`
      + down.map(k => cell(k, false)).join("");
    return `<details class="callout wave-callout"><summary><b>파동</b>${refTag}${tipMark(TIP.wave)}<span class="wave-label">${API.esc(r.wave)}</span><span class="wave-more"></span></summary>
      <div class="wave-seq">${seq}</div>
      <div class="wave-cap">상승 임펄스 1·2·3·4·5  →  하락 조정 A·B·C  (파랑=상승 / 주황=하락, 채워진 원=현재 추정 위치)</div>
      ${r.wave_detail ? `<div class="wave-detail">${API.esc(r.wave_detail)}</div>` : ""}
      ${r.wave_chart ? `<div class="chart-box wave-chart-box"><img src="${API.esc(r.wave_chart)}" alt="엘리엇 파동 구간 차트"></div>` : ""}
    </details>`;
  };
  // 이벤트(어닝) 게이트 배지 — 실적 발표 D-day. 임박할수록 갭 리스크 경고
  const earningsBadge = (dateStr) => {
    if (!dateStr) return "";
    const du = -API.daysAgo(dateStr); // 미래면 양수
    if (du < 0) return ""; // 이미 발표됨
    const cls = du <= 7 ? "red" : du <= 21 ? "orange" : "slate";
    const tip = `다음 실적 발표 ${dateStr} (D-${du}). 실적 직전 신규 진입은 갭 리스크로 비중 축소·보류 권고(이벤트 게이트). 손절선이 갭에 무력화될 수 있다.`;
    return `<span class="badge ${cls}"><span class="led"></span>실적 D-${du}</span>${tipMark(tip)}`;
  };

  const vsTip = (m) => `기준 지수: ${benchLabel(m)}. 종목 누적수익률 ÷ 지수 누적수익률로 시장 대비 초과수익을 본다. (미국주식=S&P500, 한국=KOSPI, 일본=닛케이225 등 시장별 자동 적용.)`;

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
    const metric = (k, v, tip) => v == null || v === "" ? "" :
      `<div class="metric"><span class="k">${k}${tipMark(tip)}</span><span class="v">${v}</span></div>`;

    let html = `
      <div class="card pad-lg">
        <div class="dh">
          <div>
            <div class="title"><span class="tag-mkt ${r.market || ""}">${r.market || ""}</span>${API.esc(r.name || r.ticker)}<span class="ticker">${API.esc(r.ticker)}</span></div>
            <div class="meta">
              ${API.verdictBadge(r.verdict, r.verdict_label)}
              ${r.is_leader != null ? `<span class="badge ${r.is_leader ? "green" : "ghost"}">주도주 ${r.is_leader ? "YES" : "NO"}</span>` : ""}
              ${API.regimeBadge(r.regime)}
              ${earningsBadge(r.next_earnings)}
              ${API.freshness(date)}
            </div>
          </div>
          <div style="text-align:right">
            <div class="price">${API.price(r.price, r.market)}</div>
            ${(pos.stop != null || pos.target != null) ? `<div class="price-levels" style="justify-content:flex-end">${pos.stop != null ? `<span class="pl stop">손절 ${API.price(pos.stop, r.market)}</span>` : ""}${pos.target != null ? `<span class="pl target">목표 ${API.price(pos.target, r.market)}</span>` : ""}</div>` : ""}
          </div>
        </div>
        ${r.summary ? `<div class="callout"><b>한 줄 결론.</b> ${API.esc(r.summary)}</div>` : ""}
        <div class="metrics">
          ${metric("손익비", r.rr == null ? "—" : `${r.rr}:1`, TIP.rr + (r.rr == null && r.rr_note ? `\n\n현재 비어있는 이유: ${r.rr_note}` : ""))}
          ${metric(`vs시장 3M·${benchLabel(r.market)}`, API.signed(r.rs_3m), vsTip(r.market))}
          ${metric(`vs시장 6M·${benchLabel(r.market)}`, API.signed(r.rs_6m), vsTip(r.market))}
          ${metric("vs섹터 3M", r.rs_sector_3m == null ? "" : `${API.signed(r.rs_sector_3m)}${r.sector_etf ? ` (${API.esc(r.sector_etf)})` : ""}`)}
          ${metric("ATR", r.atr == null ? "" : `${r.atr}${r.atr_pct == null ? "" : ` (${r.atr_pct}%)`}${r.atr_trend ? ` · ${API.esc(r.atr_trend)}` : ""}`, TIP.atr)}
          ${metric("다이버전스" + refTag,
              r.divergence === "bullish" ? "강세 ▲"
              : r.divergence === "bearish" ? "약세 ▼"
              : (r.divergence === "n/a" || r.divergence === "insufficient" || r.divergence === "unmeasurable") ? "측정 불가"
              : "없음",
              TIP.div + (r.divergence_note ? `\n\n이 종목: ${r.divergence_note}` : ""))}
        </div>
        <div class="metrics" style="border-top:1px solid var(--border);padding-top:14px">
          ${metric("시총", f.market_cap)}
          ${metric("매출(TTM)", f.rev_ttm, TIP.revttm)}
          ${metric("영업마진", f.op_margin == null ? "" : f.op_margin + "%")}
          ${metric("Fwd PE", f.fwd_pe)}
          ${metric("목표가", f.target == null ? "" : API.price(f.target, r.market), TIP.target)}
        </div>
        ${(pos.entry || pos.stop || pos.trail) ? `<div class="callout">
          <b>포지션.</b>
          ${pos.entry ? ` 평단 ${API.price(pos.entry, r.market)}` : ""}
          ${pos.stop ? ` · 손절 ${API.price(pos.stop, r.market)}` : ""}
          ${pos.trail ? ` · ${API.esc(pos.trail)}${tipMark(TIP.trail)}` : ""}
        </div>` : ""}
        ${(() => {
          const v = r.vbp || {};
          const res = (v.resistance || []).slice();
          const sup = (v.support || []).slice();
          const hasV = v.poc != null || res.length || sup.length;
          if (!hasV) return "";
          const px = r.price;
          const d = (p) => (px && p) ? (p / px - 1) * 100 : null;
          const sgn = (x) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
          const lvl = (p) => { const dd = d(p); return `${API.price(p, r.market)}${dd == null ? "" : ` <span class="vbp-d">${sgn(dd)}</span>`}`; };

          let resLine;
          if (!res.length) {
            resLine = `<b>위 저항</b> 없음 — 머리 위 매물벽이 없어 신고가 가속이 쉽다.`;
          } else {
            const near = Math.min(...res), dd = d(near);
            const caution = (dd != null && dd <= 3) ? " 바로 위 매물벽 — 거래량 동반 돌파 확인 전 추격 주의." : "";
            resLine = `<b>위 저항</b> 가장 가까운 ${lvl(near)}${res.length > 1 ? ` (외 ${res.length - 1})` : ""}.${caution}`;
          }

          let supLine;
          if (!sup.length) {
            supLine = `<b>아래 지지</b> 없음 — 이탈 시 받쳐줄 매물대가 없어 낙폭이 깊어질 수 있다.`;
          } else {
            const near = Math.max(...sup), dd = d(near);
            const far = (dd != null && dd <= -15) ? ` 멀다 — 손절 이탈 시 여기까지 받침 공백.` : "";
            supLine = `<b>아래 지지</b> 가장 가까운 ${lvl(near)}${sup.length > 1 ? ` (외 ${sup.length - 1})` : ""}.${far}`;
          }

          let pocLine = "";
          if (v.poc != null) {
            const dd = d(v.poc);
            let so = "";
            if (dd != null && dd <= -20) so = " — 현재가는 매물 희박한 미답지(air pocket), 되돌림 시 빠르게 빠질 수 있다.";
            else if (dd != null && Math.abs(dd) <= 5) so = " — 현재가가 최대 매물대 부근, 자석처럼 횡보로 끌릴 수 있다.";
            pocLine = `<div class="vbp-line"><b>POC</b> ${lvl(v.poc)}${so}</div>`;
          }

          return `<div class="callout vbp-callout"><div class="vbp-head"><b>매물대</b>${tipMark(TIP.vbp)}</div>
            <div class="vbp-line">${resLine}</div>
            <div class="vbp-line">${supLine}</div>
            ${pocLine}</div>`;
        })()}
        ${(r.scenario && (r.scenario.up || r.scenario.down)) ? `<div class="callout"><b>시나리오.</b>
          ${r.scenario.up ? `<div class="scenario-line"><b>지지 시</b> ${API.esc(r.scenario.up)}</div>` : ""}
          ${r.scenario.down ? `<div class="scenario-line"><b>이탈 시</b> ${API.esc(r.scenario.down)}</div>` : ""}</div>` : ""}
        ${r.credit_short ? `<div class="callout"><b>수급/신용.</b> ${API.esc(r.credit_short)}</div>` : ""}
        ${waveCallout(r)}
      </div>`;

    if (r.chart) html += `<div class="chart-box"><img src="${API.esc(r.chart)}" alt="${API.esc(r.name || r.ticker)} 차트"></div>`;

    if (r.report_md) html += `
      <div class="card pad-lg">
        <div class="card-head"><div class="t"><h3>분석 보고서</h3></div></div>
        <div class="md">${injectRefTags(API.renderMD(r.report_md))}</div>
      </div>`;

    body.innerHTML = html;
  }

  renderPicker();
  selectTicker(curTicker);
})();
