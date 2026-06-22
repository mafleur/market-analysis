(async function () {
  const app = document.getElementById("app");
  let idx;
  try {
    idx = await API.index();
  } catch (e) {
    document.getElementById("nav").innerHTML = API.nav("home");
    app.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다.<br>분석을 1회 이상 실행하면 표시됩니다. (${API.esc(String(e))})</div>`;
    return;
  }

  const mktDate = idx.market && idx.market.latest;
  document.getElementById("nav").innerHTML = API.nav("home",
    mktDate ? `마지막 시황 <b>${mktDate}</b> · ${API.relDay(API.daysAgo(mktDate))}` : "");

  // 시황 리포트(채권/시황 카드용) 로드
  let mkt = null;
  if (mktDate) { try { mkt = await API.marketReport(mktDate); } catch (e) {} }

  // 주요종목: 보유 우선, 그다음 최근 분석일자 순
  const tickers = Object.keys(idx.stocks || {});
  tickers.sort((a, b) => {
    const A = idx.stocks[a], B = idx.stocks[b];
    if (!!B.held - !!A.held) return !!B.held - !!A.held;
    return (B.latest || "").localeCompare(A.latest || "");
  });

  let html = `
    <div class="page-head">
      <h1>투자 대시보드</h1>
      <p>채권 · 시황 · 주요종목 최신 분석을 한눈에. 모든 카드에 분석일자가 표시됩니다.</p>
    </div>`;

  // ----- 매크로 지표 스트립 -----
  const snap = idx.macro_snapshot;
  if (snap && snap.length) {
    html += `<div class="macro-strip">
      <div class="macro-head"><h3>매크로 지표</h3>${mktDate ? API.freshness(mktDate) : ""}</div>
      <div class="macro-groups">`;
    for (const g of snap) {
      html += `<div class="macro-group"><div class="macro-group-label">${API.esc(g.group)}</div>`;
      for (const [k, v] of g.items) {
        const n = parseFloat(String(v).replace(/[^0-9.\-+]/g, ""));
        const cls = isNaN(n) ? "" : (n < 0 ? " neg" : n > 0 ? " pos" : "");
        html += `<div class="macro-item"><span class="k">${API.esc(k)}</span><span class="v${cls}">${API.esc(v)}</span></div>`;
      }
      html += `</div>`;
    }
    html += `</div></div>`;
  }

  // ----- 채권 / 시황 -----
  html += `<div class="section-title"><h2>시장 분석</h2><span class="hint">최신 시황 보고서 요약</span></div>`;
  if (mkt) {
    const bonds = (mkt.sections && mkt.sections.bonds) || null;
    html += `<div class="grid cols-2">`;
    // 채권
    html += `
      <a class="card pad-lg" href="market.html?date=${mktDate}#bonds">
        <div class="card-head"><div class="t"><h3>채권금리</h3></div>${API.freshness(mktDate)}</div>
        <p class="summary">${API.esc(bonds ? (bonds.summary || "") : "채권 섹션 데이터가 없습니다.")}</p>
      </a>`;
    // 시황 종합
    const chips = []
      .concat(mkt.cycle ? [`<span class="badge brand">${API.esc(mkt.cycle)}</span>`] : [])
      .concat(mkt.risk ? [`<span class="badge ${/off/i.test(mkt.risk) ? "red" : /on/i.test(mkt.risk) ? "green" : "slate"}">${API.esc(mkt.risk)}</span>`] : [])
      .concat((mkt.prefer_sectors || []).slice(0, 3).map(s => `<span class="badge ghost">${API.esc(s)}</span>`));
    html += `
      <a class="card pad-lg" href="market.html?date=${mktDate}">
        <div class="card-head"><div class="t"><h3>시황 종합</h3></div>${API.freshness(mktDate)}</div>
        <div class="chips">${chips.join("")}</div>
        <p class="summary">${API.esc(mkt.summary || mkt.korea || "")}</p>
      </a>`;
    html += `</div>`;
  } else {
    html += `<div class="card"><div class="empty">아직 시황 분석이 없습니다. <code>/시황분석</code>을 실행하세요.</div></div>`;
  }

  // ----- 주요종목 -----
  html += `<div class="section-title"><h2>주요 종목</h2><span class="hint">보유 종목 + 최근 분석한 종목</span></div>`;
  if (tickers.length === 0) {
    html += `<div class="card"><div class="empty">아직 종목 분석이 없습니다. <code>/종목분석 TICKER</code>를 실행하세요.</div></div>`;
  } else {
    html += `<div class="grid cards">`;
    for (const tk of tickers) {
      const s = idx.stocks[tk];
      html += `
        <a class="card" href="stocks.html?ticker=${encodeURIComponent(tk)}">
          <div class="card-head">
            <div class="t">
              <span class="tag-mkt ${s.market || ""}">${s.market || ""}</span>
              <h3>${API.esc(s.name || tk)}</h3>
            </div>
            ${s.held ? `<span class="badge brand">보유</span>` : ``}
          </div>
          <div class="ticker">${API.esc(tk)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px">
            <div class="price">${API.price(s.price, s.market)}</div>
            ${API.verdictBadge(s.verdict, s.verdict_label)}
          </div>
          ${(s.stop != null || s.target != null) ? `<div class="price-levels">${s.stop != null ? `<span class="pl stop">손절 ${API.price(s.stop, s.market)}</span>` : ""}${s.target != null ? `<span class="pl target">목표 ${API.price(s.target, s.market)}</span>` : ""}</div>` : ""}
          <div class="metrics">
            <div class="metric"><span class="k">주도주</span><span class="v">${s.is_leader == null ? "—" : (s.is_leader ? "YES" : "NO")}</span></div>
          </div>
          <div style="margin-top:12px">${API.freshness(s.latest)}</div>
        </a>`;
    }
    html += `</div>`;
  }

  html += `<div class="foot">MarketBullShits · 투자 대시보드 · index 생성 ${API.esc(idx.generated_at || "")}</div>`;
  app.innerHTML = html;
})();
