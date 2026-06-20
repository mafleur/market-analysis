// 공용 헬퍼: 데이터 fetch, 신선도, 배지, 마크다운 렌더, 네비게이션
const API = (() => {
  const TODAY = new Date();

  async function getJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return res.json();
  }

  const index = () => getJSON("data/index.json");
  const marketReport = (date) => getJSON(`data/market/${date}.json`);
  const stockReport = (ticker, date) => getJSON(`data/stock/${ticker}/${date}.json`);

  // ----- 날짜 / 신선도 -----
  function daysAgo(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const t = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
    return Math.round((t - d) / 86400000);
  }
  function relDay(n) {
    if (n <= 0) return "오늘";
    if (n === 1) return "어제";
    return `${n}일 전`;
  }
  // 분석일자 + 신선도 배지 HTML (요구사항: 모든 분석일자 명시)
  function freshness(dateStr) {
    if (!dateStr) return `<span class="fresh stale"><span class="led"></span>분석 없음</span>`;
    const n = daysAgo(dateStr);
    const cls = n >= 7 ? "stale" : n >= 3 ? "warn" : "ok";
    return `<span class="fresh ${cls}"><span class="led"></span>${dateStr} · ${relDay(n)}</span>`;
  }

  // ----- 포맷 -----
  function price(v, market) {
    if (v == null) return "—";
    const n = Number(v);
    // 접두 기호형 통화
    const PREFIX = { US: "$", HK: "HK$", CN: "¥", TW: "NT$", IN: "₹", UK: "£" };
    if (PREFIX[market]) return PREFIX[market] + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    // 접미 단위형 통화 (시장 → 단위)
    const SUFFIX = { KR: "원", JP: "엔", DE: "유로", FR: "유로" };
    const unit = SUFFIX[market] || "원";
    return n.toLocaleString("ko-KR") + unit;
  }
  function signed(v) {
    if (v == null) return "—";
    const n = Number(v);
    return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  }

  // ----- verdict 배지 -----
  const VERDICT = {
    BUY:   { cls: "green",  txt: "매수" },
    HOLD:  { cls: "slate",  txt: "보유" },
    TRIM:  { cls: "orange", txt: "분할익절" },
    SELL:  { cls: "red",    txt: "매도" },
    AVOID: { cls: "red",    txt: "회피" },
  };
  function verdictBadge(v, label) {
    const m = VERDICT[v] || { cls: "ghost", txt: v || "—" };
    return `<span class="badge ${m.cls}"><span class="led"></span>${label || m.txt}</span>`;
  }

  // ----- 아주 작은 마크다운 → HTML (외부 의존 없음) -----
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  }
  function renderMD(src) {
    if (!src) return "";
    const lines = src.replace(/\r\n/g, "\n").split("\n");
    let html = "", i = 0;
    const closers = []; // 'ul'
    const closeLists = () => { while (closers.length) html += `</${closers.pop()}>`; };
    while (i < lines.length) {
      let line = lines[i];

      // code fence
      if (/^```/.test(line)) {
        closeLists();
        i++; let buf = [];
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        html += `<pre><code>${esc(buf.join("\n"))}</code></pre>`;
        continue;
      }
      // table (| a | b |)
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:\-|]+\|\s*$/.test(lines[i + 1])) {
        closeLists();
        const cells = (r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
        const head = cells(line);
        i += 2;
        let body = "";
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          body += "<tr>" + cells(lines[i]).map(c => `<td>${inline(c)}</td>`).join("") + "</tr>";
          i++;
        }
        html += `<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
        continue;
      }
      // headings
      let m;
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        closeLists();
        const lv = m[1].length; html += `<h${lv}>${inline(m[2])}</h${lv}>`; i++; continue;
      }
      // hr
      if (/^\s*(---|─{3,}|={3,})\s*$/.test(line)) { closeLists(); html += "<hr>"; i++; continue; }
      // list
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
        if (!closers.includes("ul")) { html += "<ul>"; closers.push("ul"); }
        html += `<li>${inline(m[1])}</li>`; i++; continue;
      }
      // blank
      if (/^\s*$/.test(line)) { closeLists(); i++; continue; }
      // paragraph
      closeLists();
      html += `<p>${inline(line)}</p>`; i++;
    }
    closeLists();
    return html;
  }

  // ----- 네비게이션 -----
  function nav(active, stamp) {
    const link = (href, key, label) =>
      `<a href="${href}" class="${active === key ? "active" : ""}">${label}</a>`;
    return `
      <div class="nav">
        <div class="brand"><span class="dot"></span>Printemps</div>
        <div class="links">
          ${link("index.html", "home", "대시보드")}
          ${link("market.html", "market", "시황 분석")}
          ${link("stocks.html", "stocks", "종목 분석")}
        </div>
        <div class="spacer"></div>
        <div class="stamp">${stamp || ""}</div>
      </div>`;
  }

  return { index, marketReport, stockReport, daysAgo, relDay, freshness,
           price, signed, verdictBadge, renderMD, nav, esc };
})();
