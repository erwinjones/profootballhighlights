(function(){
  const THEME_KEY = "pfh_theme";
  const AUTO_KEY  = "pfh_auto_refresh_5m";

  const themeBtn  = document.getElementById("themeToggle");
  const refreshBtn= document.getElementById("refreshBtn");
  const statusEl  = document.getElementById("dataStatus");

  const boardEl   = document.getElementById("scoreboard");
  const standingsEl = document.getElementById("standings");
  const standingsStatusEl = document.getElementById("standingsStatus");

  const autoToggle = document.getElementById("autoRefreshToggle");
  let autoTimer = null;

  function safeText(el, txt){ if(el) el.textContent = txt; }

  // ---------- Theme ----------
  function setTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    if(themeBtn){
      // If theme is light, button should offer Dark Mode, and vice versa
      themeBtn.textContent = theme === "light" ? "Dark Mode" : "Light Mode";
    }
  }

  function initTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if(saved === "light" || saved === "dark"){
      setTheme(saved);
    } else {
      setTheme("dark");
    }

    if(themeBtn){
      themeBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "dark";
        setTheme(current === "dark" ? "light" : "dark");
      });
    }
  }

  // ---------- Helpers ----------
  async function fetchJSON(url, timeoutMs=12000){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try{
      const res = await fetch(url, { signal: ctrl.signal });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function fmtKickoff(iso){
    if(!iso) return "";
    try{
      const d = new Date(iso);
      return d.toLocaleString(undefined, {weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"});
    }catch(e){ return ""; }
  }

  function scoreLine(comp){
    const competitors = comp?.competitors || [];
    const away = competitors.find(c => c?.homeAway === "away") || competitors[0];
    const home = competitors.find(c => c?.homeAway === "home") || competitors[1];
    const awayName = away?.team?.displayName || away?.team?.shortDisplayName || "Away";
    const homeName = home?.team?.displayName || home?.team?.shortDisplayName || "Home";
    const awayScore= away?.score ?? "";
    const homeScore= home?.score ?? "";
    return { awayName, homeName, awayScore, homeScore };
  }

  // ---------- Scoreboard ----------
  function renderScoreboard(events){
    if(!boardEl) return;
    if(!Array.isArray(events) || events.length === 0){
      boardEl.innerHTML = "<div class='small'>No games found right now.</div>";
      return;
    }
    const cards = events.slice(0, 24).map(ev => {
      const comp = ev?.competitions?.[0];
      const st = comp?.status?.type?.shortDetail || comp?.status?.type?.detail || "";
      const dt = fmtKickoff(comp?.date);
      const {awayName, homeName, awayScore, homeScore} = scoreLine(comp);
      const link = comp?.links?.find(l => (l?.rel||[]).includes("summary"))?.href;
      const right = (awayScore !== "" || homeScore !== "") ? `<div class="score">${awayScore}</div><div class="score">${homeScore}</div>` : "";
      const names = `<div class="team">${awayName}</div><div class="team">${homeName}</div>`;
      const header = `<div class="small">${dt ? dt + " • " : ""}${st}</div>`;
      const body = `<div class="scoregrid">${names}${right}</div>`;
      const wrapStart = link ? `<a class="cardlink" href="${link}" target="_blank" rel="noopener">` : `<div class="cardlink">`;
      const wrapEnd = link ? `</a>` : `</div>`;
      return `<div class="gamecard">${wrapStart}${header}${body}${wrapEnd}</div>`;
    }).join("");
    boardEl.innerHTML = cards;
  }

  async function loadScoreboard(){
    if(!boardEl) return;
    boardEl.innerHTML = "<div class='small'>Loading…</div>";
    try{
      const data = await fetchJSON(`/.netlify/functions/espnProxy?path=football/nfl/scoreboard`);
      const events = data?.events || data?.content?.events || [];
      renderScoreboard(events);
      safeText(statusEl, `Updated ${new Date().toLocaleTimeString()}`);
      if(statusEl) statusEl.classList.remove("bad");
    }catch(err){
      boardEl.innerHTML = "<div class='small'>Scoreboard unavailable right now.</div>";
      safeText(statusEl, `Scoreboard error: ${err.message || err}`);
      if(statusEl) statusEl.classList.add("bad");
    }
  }

  // ---------- Wikipedia Standings ----------
  function clearStandings(){
    if(standingsEl) standingsEl.innerHTML = "";
  }

  function buildTabs(divisions){
    const tabWrap = document.createElement("div");
    tabWrap.className = "tabs";

    const btnRow = document.createElement("div");
    btnRow.className = "tabbuttons";

    const panels = document.createElement("div");
    panels.className = "tabpanels";

    const mkPanel = (confKey, label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tabbtn";
      btn.textContent = label;

      const panel = document.createElement("div");
      panel.className = "tabpanel";
      panel.dataset.conf = confKey;

      const confDivs = divisions[confKey] || {};
      const divNames = Object.keys(confDivs);
      if(divNames.length === 0){
        panel.innerHTML = `<div class="small">No ${label} divisions found.</div>`;
      } else {
        panel.innerHTML = divNames.map(divName => {
          const rows = confDivs[divName] || [];
          const body = rows.map(r => `
            <tr>
              <td class="tname">${r.team}</td>
              <td>${r.w}</td>
              <td>${r.l}</td>
              <td>${r.t}</td>
              <td>${r.pct}</td>
            </tr>`).join("");
          return `
            <div class="divblock">
              <div class="divtitle">${divName}</div>
              <table class="standtable">
                <thead><tr><th>Team</th><th>W</th><th>L</th><th>T</th><th>PCT</th></tr></thead>
                <tbody>${body}</tbody>
              </table>
            </div>
          `;
        }).join("");
      }

      btnRow.appendChild(btn);
      panels.appendChild(panel);

      btn.addEventListener("click", () => {
        [...btnRow.querySelectorAll(".tabbtn")].forEach(b => b.classList.remove("active"));
        [...panels.querySelectorAll(".tabpanel")].forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        panel.classList.add("active");
      });

      return {btn, panel};
    };

    const a = mkPanel("afc", "AFC");
    const n = mkPanel("nfc", "NFC");
    a.btn.classList.add("active");
    a.panel.classList.add("active");

    tabWrap.appendChild(btnRow);
    tabWrap.appendChild(panels);
    return tabWrap;
  }

  function parseWikiHTML(html){
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const tables = [...doc.querySelectorAll("table.wikitable, table.sortable, table")];

    const divMap = {
      "AFC East": [], "AFC North": [], "AFC South": [], "AFC West": [],
      "NFC East": [], "NFC North": [], "NFC South": [], "NFC West": []
    };

    function norm(s){ return (s||"").replace(/\s+/g," ").trim(); }

    for(const tbl of tables){
      let divName = "";
      const cap = tbl.querySelector("caption");
      if(cap) divName = norm(cap.textContent);
      if(!divName){
        const prev = tbl.previousElementSibling;
        if(prev && /^h\d$/i.test(prev.tagName)) divName = norm(prev.textContent);
      }
      if(!divMap[divName]) continue;

      const rows = [...tbl.querySelectorAll("tr")].slice(1);
      for(const tr of rows){
        const tds = [...tr.querySelectorAll("th,td")];
        if(tds.length < 4) continue;
        const team = norm(tds[0].textContent).replace(/\*+$/,"");
        if(!team) continue;

        const w = norm(tds[1]?.textContent);
        const l = norm(tds[2]?.textContent);
        const t = norm(tds[3]?.textContent);
        const pct = norm(tds[4]?.textContent) || "";
        if(!/^\d+/.test(w) || !/^\d+/.test(l)) continue;

        divMap[divName].push({team, w, l, t, pct});
      }
    }

    const afc = {}, nfc = {};
    for(const [divName, rows] of Object.entries(divMap)){
      if(rows.length === 0) continue;
      if(divName.startsWith("AFC")) afc[divName] = rows;
      if(divName.startsWith("NFC")) nfc[divName] = rows;
    }
    return { afc, nfc };
  }

  async function loadStandings(){
    if(!standingsEl) return;
    clearStandings();
    if(standingsStatusEl){
      standingsStatusEl.classList.remove("bad");
      standingsStatusEl.textContent = "Loading…";
    }
    try{
      const data = await fetchJSON(`/.netlify/functions/wikiStandings`, 15000);
      const html = data?.html;
      if(!html) throw new Error(data?.error || "No HTML returned");
      const divisions = parseWikiHTML(html);
      const any = Object.keys(divisions.afc).length + Object.keys(divisions.nfc).length;
      if(!any) throw new Error("Wikipedia did not include division tables.");
      standingsEl.appendChild(buildTabs(divisions));
      if(standingsStatusEl){
        standingsStatusEl.textContent = `Standings feed: Wikipedia • Updated ${new Date().toLocaleTimeString()}`;
      }
    }catch(err){
      if(standingsEl) standingsEl.innerHTML = "";
      if(standingsStatusEl){
        standingsStatusEl.textContent = `Standings unavailable: ${err.message || err}`;
        standingsStatusEl.classList.add("bad");
      }
    }
  }

  // ---------- Refresh / Hybrid ----------
  function stopAuto(){
    if(autoTimer){
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }
  function startAuto(){
    stopAuto();
    autoTimer = setInterval(() => {
      loadScoreboard();
      loadStandings();
    }, 5*60*1000);
  }

  function initHybrid(){
    if(!autoToggle) return;
    const saved = localStorage.getItem(AUTO_KEY);
    autoToggle.checked = saved === "on";
    autoToggle.addEventListener("change", () => {
      if(autoToggle.checked){
        localStorage.setItem(AUTO_KEY, "on");
        startAuto();
        safeText(statusEl, `Auto-refresh ON • Updated ${new Date().toLocaleTimeString()}`);
      } else {
        localStorage.setItem(AUTO_KEY, "off");
        stopAuto();
        safeText(statusEl, `Auto-refresh OFF • Updated ${new Date().toLocaleTimeString()}`);
      }
    });
    if(autoToggle.checked) startAuto();
  }

  function initRefresh(){
    if(!refreshBtn) return;
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      const old = refreshBtn.textContent;
      refreshBtn.textContent = "Refreshing…";
      try{
        await Promise.all([loadScoreboard(), loadStandings()]);
      } finally {
        refreshBtn.textContent = old;
        refreshBtn.disabled = false;
      }
    });
  }

 // Init (wait for DOM so elements exist on every page)
function boot(){
  initTheme();
  initRefresh();
  initHybrid();
  loadScoreboard();
  loadStandings();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
})();
