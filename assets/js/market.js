(async function () {
  const app = document.getElementById("app");
  document.getElementById("nav").innerHTML = API.nav("market");

  let idx;
  try { idx = await API.index(); } catch (e) {
    app.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다.</div>`; return;
  }
  const history = (idx.market && idx.market.history) || [];
  if (history.length === 0) {
    app.innerHTML = `<div class="empty">아직 시황 분석이 없습니다. <code>/시황분석</code>을 실행하세요.</div>`;
    return;
  }

  const params = new URLSearchParams(location.search);
  let current = params.get("date");
  if (!history.includes(current)) current = history[0];

  app.innerHTML = `
    <div class="page-head"><h1>시황 분석</h1><p>채권 · 통화정책 · 환율 · 섹터 모멘텀 종합. 좌측에서 분석일자를 선택하세요.</p></div>
    <div class="detail">
      <div class="sidebar">
        <div class="section-title"><h2>분석 이력</h2></div>
        <div class="history-list" id="hist"></div>
      </div>
      <div id="body"></div>
    </div>`;

  const hist = document.getElementById("hist");
  hist.innerHTML = history.map(d =>
    `<div class="h-item ${d === current ? "active" : ""}" data-d="${d}">
       <span>${d}</span><span class="fresh ${API.daysAgo(d) >= 7 ? "stale" : API.daysAgo(d) >= 3 ? "warn" : "ok"}"><span class="led"></span>${API.relDay(API.daysAgo(d))}</span>
     </div>`).join("");
  hist.querySelectorAll(".h-item").forEach(el =>
    el.addEventListener("click", () => render(el.dataset.d)));

  async function render(date) {
    current = date;
    hist.querySelectorAll(".h-item").forEach(el => el.classList.toggle("active", el.dataset.d === date));
    window.history.replaceState(null, "", `?date=${date}`);
    const body = document.getElementById("body");
    body.innerHTML = `<div class="empty">불러오는 중…</div>`;
    let r;
    try { r = await API.marketReport(date); } catch (e) {
      body.innerHTML = `<div class="empty">리포트를 불러오지 못했습니다.</div>`; return;
    }

    const chips = []
      .concat(r.cycle ? [`<span class="badge brand">${API.esc(r.cycle)}</span>`] : [])
      .concat(r.risk ? [`<span class="badge ${/off/i.test(r.risk) ? "red" : /on/i.test(r.risk) ? "green" : "slate"}">${API.esc(r.risk)}</span>`] : [])
      .concat((r.prefer_sectors || []).map(s => `<span class="badge green">▲ ${API.esc(s)}</span>`))
      .concat((r.avoid_sectors || []).map(s => `<span class="badge red">▼ ${API.esc(s)}</span>`));

    // ── 지수 스냅샷 ──
    let html = "";
    const indices = r.indices;
    if (indices && indices.length) {
      html += `<div class="indices-strip">`;
      for (const ix of indices) {
        const n = parseFloat(String(ix.change).replace(/[^0-9.\-+]/g, ""));
        const cls = isNaN(n) ? "" : (n < 0 ? " neg" : n > 0 ? " pos" : "");
        html += `<div class="idx-item">
          <span class="idx-name">${API.esc(ix.name)}</span>
          <span class="idx-val">${API.esc(ix.value)}</span>
          <span class="idx-chg${cls}">${API.esc(ix.change)}</span>
        </div>`;
      }
      html += `</div>`;
    }

    // ── 이벤트 카운트다운 ──
    let evSchedule = [];
    try { const idxData = await API.index(); evSchedule = idxData.event_schedule || []; } catch(e) {}
    if (evSchedule.length) {
      html += API.renderEventStrip(evSchedule);
    }

    // ── 매크로 지표 스트립 ──
    const snap = r.macro_snapshot;
    const evByGroup = API.eventsByGroup(evSchedule, 10);
    if (snap && snap.length) {
      html += `<div class="macro-strip">
        <div class="macro-head"><h3>매크로 지표</h3>${API.freshness(date)}</div>
        <div class="macro-groups">`;
      for (const g of snap) {
        html += `<div class="macro-group"><div class="macro-group-label">${API.esc(g.group)}</div>`;
        for (const [k, v] of g.items) {
          const n = parseFloat(String(v).replace(/[^0-9.\-+]/g, ""));
          const cls = isNaN(n) ? "" : (n < 0 ? " neg" : n > 0 ? " pos" : "");
          html += `<div class="macro-item"><span class="k">${API.esc(k)}</span><span class="v${cls}">${API.esc(v)}</span></div>`;
        }
        const gev = evByGroup[g.group];
        if (gev) { for (const ev of gev) html += API.macroEventBadge(ev); }
        html += `</div>`;
      }
      html += `</div></div>`;
    }

    html += `
      <div class="card pad-lg" style="margin-top:18px">
        <div class="dh">
          <div><div class="title">시황 종합</div>
            <div class="meta">${API.freshness(date)}</div>
          </div>
        </div>
        <div class="chips" style="margin-top:12px">${chips.join("")}</div>
        ${r.summary ? `<div class="callout"><b>한 줄 결론.</b> ${API.esc(r.summary)}</div>` : ""}
        ${(r.alerts && r.alerts.length) ? `<div class="callout"><b>켜진 경보.</b> ${r.alerts.map(API.esc).join(" · ")}</div>` : ""}
        ${(r.events && r.events.length) ? `<div class="callout"><b>주의 이벤트.</b> ${r.events.map(API.esc).join(" · ")}</div>` : ""}
      </div>`;

    // 섹션별 (채권/종합 등)
    const sections = r.sections || {};
    for (const key of Object.keys(sections)) {
      const sec = sections[key];
      html += `
        <div class="card pad-lg" id="${key}" style="margin-top:18px">
          <div class="card-head"><div class="t"><h3>${API.esc(sec.title || key)}</h3></div></div>
          ${(sec.charts || []).map(c => `<div class="chart-box"><img src="${API.esc(c)}" alt=""></div>`).join("")}
          <div class="md">${API.renderMD(sec.report_md || sec.summary || "")}</div>
        </div>`;
    }

    // 전체 본문
    if (r.report_md) {
      html += `
        <div class="card pad-lg" style="margin-top:18px">
          <div class="card-head"><div class="t"><h3>전체 보고서</h3></div></div>
          ${(r.charts || []).map(c => `<div class="chart-box"><img src="${API.esc(c)}" alt=""></div>`).join("")}
          <div class="md">${API.renderMD(r.report_md)}</div>
        </div>`;
    }
    body.innerHTML = html;
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView({ behavior: "smooth" }); }
  }

  render(current);
})();
