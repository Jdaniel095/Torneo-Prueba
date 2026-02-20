const API = "https://script.google.com/macros/s/AKfycbyCKV9peBewnrgGZDFnZWt6k3oUlRQ4TdHtHHquNHlj4QZ57V4vdwC8e3DhRenZQYB6zg/exec";
const $ = (id) => document.getElementById(id);



let ROLE = "";
let CURRENT_USER = "";
let ADMIN_USER = "";   // ✅ compat por si quedó código viejo usando ADMIN_USER
let ADMIN_PIN = "";
let SELECTED_TORNEO_ID = ""; // ✅ multi-eventos
let SELECTED_TORNEO_OPEN = null; // ✅ guarda si el torneo seleccionado está abierto/cerrado

// ======================================================
// 🔎 MODLOG (DEBUG de modales / scroll lock)
//  - Apagar: MODLOG.enabled = false
// ======================================================
window.MODLOG = window.MODLOG || (() => {
  const api = {
    enabled: true,
    max: 250,
    lines: [],
    ui: null,
    showUI: true, // pon false si solo quieres consola
  };

  const pad2 = (n) => String(n).padStart(2, "0");
  const ts = () => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3,"0")}`;
  };

  function safeStr(v){
    try{ return JSON.stringify(v); }catch{ return String(v); }
  }

  function getBodyState(){
    const b = document.body;
    const cs = b ? getComputedStyle(b) : null;
    return {
      className: b ? b.className : "",
      overflow: cs ? cs.overflow : "",
      scrollY: window.scrollY
    };
  }

  function getOpenModals(){
    const modals = Array.from(document.querySelectorAll(".modal"));
    const out = modals.map((m, i) => {
      const cs = getComputedStyle(m);
      return {
        id: m.id || `(modal_${i})`,
        display: cs.display,
        zIndex: cs.zIndex,
        opacity: cs.opacity,
        pointerEvents: cs.pointerEvents
      };
    });
    return out.filter(x => x.display !== "none");
  }

  api.snap = () => ({ body: getBodyState(), openModals: getOpenModals() });

  api._push = (kind, msg, data) => {
    if(!api.enabled) return;
    const lineObj = { t: ts(), kind, msg, data: data || null };
    api.lines.push(lineObj);
    if(api.lines.length > api.max) api.lines.shift();

    try{
      console.log(`%c[MODLOG ${lineObj.t}] ${kind}: ${msg}`, "color:#ffe27a;font-weight:700", data || "");
    }catch{
      console.log(`[MODLOG ${lineObj.t}] ${kind}: ${msg}`);
    }

    if(api.showUI) api._renderUI();
  };

  api.log = (msg, data) => api._push("LOG", msg, data);
  api.call = (fnName, args, extra) => {
    const stack = (new Error()).stack || "";
    api._push("CALL", `${fnName}(${(args||[]).map(a => safeStr(a)).join(", ")})`, {
      ...api.snap(),
      ...(extra || {}),
      stack: stack.split("\n").slice(0,6).join("\n")
    });
  };

  api.clear = () => { api.lines = []; api._renderUI(true); };
  api.export = () => api.lines
    .map(x => `[${x.t}] ${x.kind}: ${x.msg} ${x.data ? safeStr(x.data) : ""}`)
    .join("\n");

  api._renderUI = () => {
    if(!api.showUI) return;
    if(!document.body) return;

    if(!api.ui){
      const box = document.createElement("div");
      box.id = "modlog-ui";
      box.style.cssText =
        "position:fixed;left:12px;bottom:12px;width:min(520px,calc(100vw - 24px));max-height:40vh;z-index:999999;" +
        "background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.18);border-radius:12px;" +
        "padding:10px;font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;color:#fff;overflow:auto;";

      const head = document.createElement("div");
      head.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;";

      const title = document.createElement("div");
      title.textContent = "MODLOG (modales)";
      title.style.cssText = "font-weight:800;color:#ffe27a;margin-right:auto;";

      const btnCss = "padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;cursor:pointer;";

      const btnCopy = document.createElement("button");
      btnCopy.type = "button";
      btnCopy.textContent = "Copiar";
      btnCopy.style.cssText = btnCss;
      btnCopy.onclick = async () => {
        const txt = api.export();
        try{ await navigator.clipboard.writeText(txt); api.log("📋 Logs copiados"); }catch{ api.log("⚠ No se pudo copiar"); }
      };

      const btnClear = document.createElement("button");
      btnClear.type = "button";
      btnClear.textContent = "Limpiar";
      btnClear.style.cssText = btnCss;
      btnClear.onclick = () => api.clear();

      const btnHide = document.createElement("button");
      btnHide.type = "button";
      btnHide.textContent = "Ocultar";
      btnHide.style.cssText = btnCss;
      btnHide.onclick = () => { box.style.display = "none"; api.log("UI oculta"); };

      head.appendChild(title);
      head.appendChild(btnCopy);
      head.appendChild(btnClear);
      head.appendChild(btnHide);

      const pre = document.createElement("pre");
      pre.id = "modlog-pre";
      pre.style.cssText = "margin:0;white-space:pre-wrap;word-break:break-word;";

      box.appendChild(head);
      box.appendChild(pre);

      document.body.appendChild(box);
      api.ui = box;
    }

    const pre = api.ui.querySelector("#modlog-pre");
    if(pre){
      pre.textContent = api.lines.map(x => `[${x.t}] ${x.kind}: ${x.msg}`).join("\n");
    }
  };

  return api;
})();



// ================= MATCH UI SCOREBOARD =================
const MATCH_ROW = new Map(); // matchId -> { tr, box }
const MATCH_UI_STATE = new Map(); 
// matchId -> { a:0, b:0, locked:false, winnerId:"" }

function needWinsFromBestOf(bestOf){
  const bo = Number(bestOf || 3);
  return Math.floor(bo / 2) + 1; // BO3=>2, BO5=>3
}

function getOrInitMatchState(matchId){
  if(!MATCH_UI_STATE.has(matchId)){
    MATCH_UI_STATE.set(matchId, { a:0, b:0, locked:false, winnerId:"" });
  }
  return MATCH_UI_STATE.get(matchId);
}

function clampScore(n){ 
  n = Number(n||0);
  if(n < 0) return 0;
  if(n > 99) return 99;
  return n;
}

/* ================= MATCH OPS (Status/Ubicación) ================= */
function normMatchStatus(m){
  const ms = String(m?.MatchStatus ?? m?.matchStatus ?? "").trim().toLowerCase();
  if(ms) return ms;
  const st = String(m?.Status ?? m?.status ?? "").trim().toLowerCase();
  return (st === "done") ? "finished" : "scheduled";
}

function matchStatusLabel(ms){
  ms = String(ms||"").trim().toLowerCase();
  if(ms === "scheduled") return "🕒 Programado";
  if(ms === "running")   return "▶ En juego";
  if(ms === "paused")    return "⏸ Pausado";
  if(ms === "finished")  return "✅ Finalizado";
  if(ms === "cancelled") return "⛔ Cancelado";
  return "—";
}

function applyOpsVisual(tr, ms){
  ms = String(ms||"").trim().toLowerCase();

  tr.classList.toggle("match-paused", ms === "paused");
  tr.classList.toggle("match-cancelled", ms === "cancelled");

  const chip = tr.querySelector('[data-mchip="1"]');
  if(chip){
    chip.textContent = matchStatusLabel(ms);
    chip.classList.toggle("chip-paused", ms === "paused");
    chip.classList.toggle("chip-finished", ms === "finished");
    chip.classList.toggle("chip-cancelled", ms === "cancelled");
  }

  const btn = tr.querySelector('[data-mtoggle="1"]');
  if(btn){
    const disabled = (ms === "finished" || ms === "cancelled");
    btn.disabled = disabled;
    btn.textContent = (ms === "paused") ? "Reanudar" : "Pausar";
  }
}


function applyRowVisual(tr, st){
  tr.classList.remove("match-done","match-a-win","match-b-win");
  if(st.locked){
    tr.classList.add("match-done");
    if(st.winnerId === "A") tr.classList.add("match-a-win");
    if(st.winnerId === "B") tr.classList.add("match-b-win");
  }
}

function applyButtonsVisual(tr, st){
  const btnA = tr.querySelector('[data-winbtn="A"]');
  const btnB = tr.querySelector('[data-winbtn="B"]');
  if(!btnA || !btnB) return;

  btnA.classList.remove("win-green","win-red");
  btnB.classList.remove("win-green","win-red");

  if(st.locked){
    if(st.winnerId === "A"){ btnA.classList.add("win-green"); btnB.classList.add("win-red"); }
    if(st.winnerId === "B"){ btnB.classList.add("win-green"); btnA.classList.add("win-red"); }
  }
}

function renderScore(tr, st){
  const scoreEl = tr.querySelector("[data-score]");
  if(scoreEl) scoreEl.textContent = `${st.a} - ${st.b}`;
}

async function refrescarSoloMatches(torneoId, matchIds = []) {
  // ✅ si no me pasan ids, refresco todos los que están pintados en la tabla
  if (!Array.isArray(matchIds) || matchIds.length === 0) {
    matchIds = Array.from(MATCH_ROW.keys());
  }

  matchIds = Array.from(new Set(matchIds.map(String).filter(Boolean)));
  if (matchIds.length === 0) return;

  const r = await torneoGET("torneo_list_matches", { torneoId });
  if (!r.ok) return;

  const all = Array.isArray(r.matches) ? r.matches : [];
  const byId = new Map(all.map(m => [String(m.MatchId), m]));

  // 🚀 OPTIMIZACIÓN: Mapeo de nombres para quitar el "TBD"
  const inscritos = window.PARTICIPANTES_CACHE || [];
  const nameMap = {};
  inscritos.forEach(p => {
    nameMap[p.PlayerId] = p.NombrePokemonGO || p.Nombre || p.PlayerId;
  });

  matchIds.forEach(id => {
    const ref = MATCH_ROW.get(id);
    const m = byId.get(id);
    if (!ref || !m) return;

    const { tr, box } = ref;

    // 🚀 1. ACTUALIZAR IDs Y NOMBRES DE LA PRÓXIMA RONDA
    const aId = String(m.PlayerAId || "");
    const bId = String(m.PlayerBId || "");
    box.dataset.aid = aId;
    box.dataset.bid = bId;

    const aName = aId ? (nameMap[aId] || aId) : "TBD";
    const bName = bId ? (nameMap[bId] || bId) : "TBD";

    const nameEls = tr.querySelectorAll(".m-name");
    if(nameEls.length >= 2){
      nameEls[0].textContent = aName;
      nameEls[1].textContent = bName;
    }

    // 2. ACTUALIZAR DATA LOCAL
    box.dataset.scorea = String(Number(m.ScoreA ?? 0));
    box.dataset.scoreb = String(Number(m.ScoreB ?? 0));
    box.dataset.status = String(m.Status || "");
    box.dataset.winnerid = String(m.WinnerId || "");

    box.dataset.matchstatus = String(m.MatchStatus || "");
    box.dataset.location = String(m.Location || "");

    // 3. ACTUALIZAR ESTADO DE UBICACIÓN
    const locEl = tr.querySelector('[data-mloc="1"]');
    if (locEl) locEl.value = String(m.Location || "");

    const msEl = tr.querySelector('[data-mstatus="1"]');
    if (msEl) {
      const ms = normMatchStatus(m);
      msEl.value = ms;
      applyOpsVisual(tr, ms);
    }

    // 4. ACTUALIZAR ESTADO DEL SCORE
    const st = getOrInitMatchState(id);
    st.a = Number(m.ScoreA ?? 0);
    st.b = Number(m.ScoreB ?? 0);

    if (String(m.Status) === "done") {
      st.locked = true;
      const w = String(m.WinnerId || "");
      st.winnerId = (w && w === aId) ? "A" : (w && w === bId) ? "B" : "";
    } else {
      st.locked = false;
      st.winnerId = "";
    }

    // 🚀 5. HABILITAR BOTONES SI LOS JUGADORES YA LLEGARON
    const missingPlayers = (!aId || !bId);
    
    // Botones de acción (+, -, Ganador, Subir Marcador)
    const actionBtns = tr.querySelectorAll('[data-scorebtn], [data-pushscore="1"], [data-winbtn]');
    actionBtns.forEach(b => {
       // Se habilitan si ya hay 2 jugadores y el match NO ha terminado
       b.disabled = missingPlayers || st.locked;
    });

    // Botón de editar
    const editBtn = tr.querySelector('[data-edit="1"]');
    if(editBtn) {
       // El botón de editar solo requiere que haya jugadores para poder alterar el resultado
       editBtn.disabled = missingPlayers;
    }

    // 6. RENDERIZAR VISUALMENTE
    renderScore(tr, st);
    applyRowVisual(tr, st);
    applyButtonsVisual(tr, st);
  });
}


/* ================= UTIL ================= */
function safe(v){ return (v===undefined || v===null) ? "" : String(v); }

function normStatus(v){
  const s = String(v || "").trim().toLowerCase();
  if(s === "finished" || s === "finish" || s === "finalizado" || s === "finalizado ✅") return "finished";
  return "active";
}

function statusLabel(v){
  return normStatus(v) === "finished" ? "Finalizado" : "Activo";
}

function parsePrizesJson(raw){
  const s = String(raw || "").trim();
  if(!s) return [];
  try{
    const arr = JSON.parse(s);
    if(!Array.isArray(arr)) return [];
    return arr
      .map(x => ({
        name: String(x?.name || "").trim(),
        icon: String(x?.icon || "").trim()
      }))
      .filter(x => x.name || x.icon);
  }catch{
    return [];
  }
}

function buildPrizesJson(list){
  const clean = (Array.isArray(list) ? list : [])
    .map(x => ({
      name: String(x?.name || "").trim(),
      icon: String(x?.icon || "").trim()
    }))
    .filter(x => x.name || x.icon);
  return JSON.stringify(clean);
}

function renderPrizesUI(list){
  const box = document.getElementById("tPrizesList");
  const hidden = document.getElementById("tPrizesJson");
  if(!box || !hidden) return;

  box.innerHTML = "";

  (list || []).forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "prize-row";

    const img = document.createElement("img");
    img.className = "prize-icon";
    img.alt = "";
    img.src = p.icon || "favicon.png"; // fallback simple
    img.onerror = () => { img.src = "favicon.png"; };

    const nameInput = document.createElement("input");
    nameInput.placeholder = "Nombre del premio (ej: S/ 50, Medalla, Cupón...)";
    nameInput.value = p.name || "";

    const iconInput = document.createElement("input");
    iconInput.placeholder = "URL del ícono (https://...)";
    iconInput.value = p.icon || "";

    const fields = document.createElement("div");
    fields.style.display = "grid";
    fields.style.gridTemplateColumns = "1fr";
    fields.style.gap = "8px";
    fields.appendChild(nameInput);
    fields.appendChild(iconInput);

    const actions = document.createElement("div");
    actions.className = "prize-actions";

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn-danger btn-mini";
    btnDel.textContent = "🗑️";
    btnDel.onclick = () => {
      const current = parsePrizesJson(hidden.value);
      current.splice(idx, 1);
      hidden.value = buildPrizesJson(current);
      renderPrizesUI(current);
    };

    actions.appendChild(btnDel);

    // layout: icon | fields | actions
    row.appendChild(img);
    row.appendChild(fields);
    row.appendChild(actions);

    // sync changes
    const sync = () => {
      const current = parsePrizesJson(hidden.value);
      if(!current[idx]) current[idx] = { name:"", icon:"" };
      current[idx].name = nameInput.value.trim();
      current[idx].icon = iconInput.value.trim();
      hidden.value = buildPrizesJson(current);
      img.src = current[idx].icon || "favicon.png";
    };

    nameInput.addEventListener("input", sync);
    iconInput.addEventListener("input", sync);

    box.appendChild(row);
  });
}

function setPrizesFromJson(raw){
  const hidden = document.getElementById("tPrizesJson");
  if(!hidden) return;
  const list = parsePrizesJson(raw);
  hidden.value = buildPrizesJson(list);
  renderPrizesUI(list);
}

/* =============================
   ✅ BO POR FASE (SUBMODAL)
   - Default: ON (G1 / L3 / F5)
   - Guarda en JSON: boPhasesJson
============================= */

function boPhaseDefaults_(){
  return { enabled:true, groups:1, playoffs:3, final:5 };
}

function readBoPhaseFromInputs_(){
  const d = boPhaseDefaults_();
  const enEl = document.getElementById("tBoPerPhase");
  const gEl  = document.getElementById("tBoGroups");
  const pEl  = document.getElementById("tBoPlayoffs");
  const fEl  = document.getElementById("tBoFinal");

  return {
    enabled: enEl ? !!enEl.checked : d.enabled,
    groups:  Number(gEl?.value || d.groups),
    playoffs:Number(pEl?.value || d.playoffs),
    final:   Number(fEl?.value || d.final),
  };
}

function updateBoPhaseSummary_(){
  const sum = document.getElementById("tBoPhaseSummary");
  if(!sum) return;

  const c = readBoPhaseFromInputs_();
  if(!c.enabled){
    sum.textContent = "Usando Best Of global";
    return;
  }
  sum.textContent = `Grupos: BO${c.groups} · Llaves: BO${c.playoffs} · Final: BO${c.final}`;
}

function updateBoPhaseControlsState_(){
  const btn = document.getElementById("btnBoAdvOpen");
  if(!btn) return;
  btn.disabled = !readBoPhaseFromInputs_().enabled;
}

function writeBoPhaseToInputs_(cfg){
  const d = boPhaseDefaults_();
  const c = cfg || {};

  const enabled = (c.enabled !== undefined) ? !!c.enabled : d.enabled;
  const groups  = Number(c.groups ?? d.groups);
  const playoffs= Number(c.playoffs ?? d.playoffs);
  const final   = Number(c.final ?? d.final);

  const enEl = document.getElementById("tBoPerPhase");
  const gEl  = document.getElementById("tBoGroups");
  const pEl  = document.getElementById("tBoPlayoffs");
  const fEl  = document.getElementById("tBoFinal");

  if(enEl) enEl.checked = enabled;
  if(gEl)  gEl.value = String(groups);
  if(pEl)  pEl.value = String(playoffs);
  if(fEl)  fEl.value = String(final);

  updateBoPhaseSummary_();
  updateBoPhaseControlsState_();
}

function buildBoPhasesJson_(){
  const c = readBoPhaseFromInputs_();
  if(!c.enabled) return "";
  // JSON “estable” para backend
  return JSON.stringify({
    version: 1,
    groups: c.groups,
    bracket: c.playoffs,
    final: c.final
  });
}

function parseBoPhasesJson_(raw){
  const d = boPhaseDefaults_();
  const s = String(raw || "").trim();
  if(!s) return { ...d, enabled:false };

  try{
    const o = JSON.parse(s);
    return {
      enabled: true,
      groups:  Number(o.groups ?? d.groups),
      playoffs:Number(o.bracket ?? o.playoffs ?? d.playoffs),
      final:   Number(o.final ?? d.final),
    };
  }catch{
    return { ...d, enabled:false };
  }
}

/* ===== SUBMODAL BO (abrir/cerrar/aplicar) ===== */

function boAdvPreviewUpdate_(){
  const g = document.getElementById("boAdvGroups");
  const p = document.getElementById("boAdvPlayoffs");
  const f = document.getElementById("boAdvFinal");
  const prev = document.getElementById("boAdvPreview");
  if(!prev) return;

  prev.textContent = `Grupos: BO${g?.value || 1} · Llaves: BO${p?.value || 3} · Final: BO${f?.value || 5}`;
}

function boAdvOpen_(){
  const modal = document.getElementById("boAdvModal");
  if(!modal) return;

  const c = readBoPhaseFromInputs_();
  const g = document.getElementById("boAdvGroups");
  const p = document.getElementById("boAdvPlayoffs");
  const f = document.getElementById("boAdvFinal");

  if(g) g.value = String(c.groups);
  if(p) p.value = String(c.playoffs);
  if(f) f.value = String(c.final);

  boAdvPreviewUpdate_();
  modal.style.display = "block";
}

function boAdvClose_(){
  const modal = document.getElementById("boAdvModal");
  if(!modal) return;
  modal.style.display = "none";
}

function boAdvApply_(){
  const g = Number(document.getElementById("boAdvGroups")?.value || 1);
  const p = Number(document.getElementById("boAdvPlayoffs")?.value || 3);
  const f = Number(document.getElementById("boAdvFinal")?.value || 5);

  writeBoPhaseToInputs_({ enabled:true, groups:g, playoffs:p, final:f });
  boAdvClose_();
}


function addEmptyPrizeRow(){
  const hidden = document.getElementById("tPrizesJson");
  if(!hidden) return;
  const list = parsePrizesJson(hidden.value);
  list.push({ name:"", icon:"" });
  hidden.value = buildPrizesJson(list);
  renderPrizesUI(list);
}


function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

/* =============================
   PANEL: Reglas por liga en vista del torneo (tStatusRules)
   - Si 2+ ligas => usa leagueRulesJson + tabs
   - Si 1 liga  => usa global como siempre
============================= */

const PANEL_RULES_PICK = {}; // torneoId -> leagueKey seleccionado

function panelTryParseLeagueRulesJson_(s){
  const raw = String(s||"").trim();
  if(!raw) return null;
  try{
    const obj = JSON.parse(raw);
    if(!obj || obj.mode !== "perLeague" || !obj.leagues || typeof obj.leagues !== "object") return null;
    return obj;
  }catch(_){
    return null;
  }
}

function panelNormArr_(v, lower){
  const a = Array.isArray(v) ? v : (typeof v === "string" ? v.split(/[,\n]+/g) : []);
  const out = a.map(x => String(x).trim()).filter(Boolean);
  return lower ? out.map(x => x.toLowerCase()) : out;
}

function panelNormalizeRuleSet_(r){
  const o = (r && typeof r === "object") ? r : {};
  return {
    allowedTypes: panelNormArr_(o.allowedTypes, true),
    allowedCategories: panelNormArr_(o.allowedCategories, true),
    bannedTypes: panelNormArr_(o.bannedTypes, true),
    bannedCategories: panelNormArr_(o.bannedCategories, true),
    allowedPokemon: panelNormArr_(o.allowedPokemon, false),
    bannedPokemon: panelNormArr_(o.bannedPokemon, false),
    bannedFastMoves: panelNormArr_(o.bannedFastMoves, false),
    bannedChargedMoves: panelNormArr_(o.bannedChargedMoves, false)
  };
}

function panelJoinCsv_(arr){
  return (arr && arr.length) ? arr.join(",") : "";
}

function panelMoveIdsToNames_(raw){
  const ids = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim())
    .filter(Boolean);

  if(ids.length === 0) return "—";

  return ids.map(id => {
    const m = (typeof MOVE_BY_ID !== "undefined") ? MOVE_BY_ID.get(String(id)) : null;
    if(m && typeof moveLabel === "function") return moveLabel(m);
    return String(id).replace(/_/g, " ");
  }).join(", ");
}

function panelDexListToNames_(raw){
  const ids = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim())
    .filter(Boolean);

  if(ids.length === 0) return "—";

  return ids.map(iconId => {
    const dex = String(iconId).split("_")[0];
    const name = (typeof POKEMON_BY_DEX !== "undefined" && POKEMON_BY_DEX.get(dex))
      ? POKEMON_BY_DEX.get(dex)
      : `Dex ${dex}`;
    const extra = (typeof kindLabelFromIconId === "function") ? kindLabelFromIconId(iconId) : "";
    return `${name}${extra}`;
  }).join(", ");
}

function panelPrettyTypes_(raw){
  const keys = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  if(keys.length === 0) return "—";
  const uniq = [...new Set(keys)];
  const out = uniq.map(k => (typeof typeLabel === "function") ? typeLabel(k) : k);
  return escapeHtml(out.join(", "));
}

function panelPrettyCategories_(raw){
  const keys = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  if(keys.length === 0) return "—";
  const uniq = [...new Set(keys)];
  const out = uniq.map(k => (typeof categoryLabel === "function") ? categoryLabel(k) : k);
  return escapeHtml(out.join(", "));
}

function panelLeagueLabel_(key, isTie){
  const k = String(key||"");

  try{
    if(typeof LEAGUE_ITEMS !== "undefined"){
      const it = LEAGUE_ITEMS.find(x => x.key === k);
      if(it) return isTie ? `${it.label} (Desempate)` : it.label;
    }
  }catch(_){}

  const cp = k.replace(/[^\d]/g, "");
  const base = cp ? `Liga ${cp}` : k;
  return isTie ? `${base} (Desempate)` : base;
}

function panelRenderRulesGrid_(r){
  return `
    <div class="t-rules-grid">

      <div class="t-rule is-ban">
        <div class="t-rule-k">Básicos prohibidos</div>
        <div class="t-rule-v">${escapeHtml(panelMoveIdsToNames_(r.bannedFastMoves))}</div>
      </div>

      <div class="t-rule is-ban">
        <div class="t-rule-k">Cargados prohibidos</div>
        <div class="t-rule-v">${escapeHtml(panelMoveIdsToNames_(r.bannedChargedMoves))}</div>
      </div>

      <div class="t-rule is-ban full">
        <div class="t-rule-k">Pokémon prohibidos</div>
        <div class="t-rule-v">${escapeHtml(panelDexListToNames_(r.bannedPokemon))}</div>
      </div>

      <div class="t-rule is-ban">
        <div class="t-rule-k">Tipos prohibidos</div>
        <div class="t-rule-v">${panelPrettyTypes_(r.bannedTypes)}</div>
      </div>

      <div class="t-rule is-ban">
        <div class="t-rule-k">Categorías prohibidas</div>
        <div class="t-rule-v">${panelPrettyCategories_(r.bannedCategories)}</div>
      </div>

      <div class="t-rule is-allow">
        <div class="t-rule-k">Tipos permitidos</div>
        <div class="t-rule-v">${panelPrettyTypes_(r.allowedTypes)}</div>
      </div>

      <div class="t-rule is-allow">
        <div class="t-rule-k">Categorías permitidas</div>
        <div class="t-rule-v">${panelPrettyCategories_(r.allowedCategories)}</div>
      </div>

      <div class="t-rule is-allow full">
        <div class="t-rule-k">Excepciones permitidas</div>
        <div class="t-rule-v">${escapeHtml(panelDexListToNames_(r.allowedPokemon))}</div>
      </div>

    </div>
  `;
}

function renderPanelRulesBox(boxEl, c, tid){
  if(!boxEl) return;

  const lpRaw = safe(c.leaguePlan || c.league || "").trim();
  const lp = (typeof parseLeaguePlanValue === "function")
    ? parseLeaguePlanValue(lpRaw)
    : { mains: new Set(lpRaw ? [lpRaw] : []), tie: "" };

  const mains = Array.from(lp.mains || []);
  const isMulti = mains.length >= 2;

  // ✅ Caso A: 1 liga => global
  if(!isMulti){
    const r = {
      bannedFastMoves: safe(c.bannedFastMoves),
      bannedChargedMoves: safe(c.bannedChargedMoves),
      bannedPokemon: safe(c.bannedPokemon),
      bannedTypes: safe(c.bannedTypes),
      bannedCategories: safe(c.bannedCategories),
      allowedTypes: safe(c.allowedTypes),
      allowedCategories: safe(c.allowedCategories),
      allowedPokemon: safe(c.allowedPokemon)
    };
    boxEl.innerHTML = panelRenderRulesGrid_(r);
    return;
  }

  // ✅ Caso B: multi-liga => JSON + tabs
  const keys = mains.slice();
  const tie = safe(lp.tie);
  if(tie && tie !== "none" && !keys.includes(tie)) keys.push(tie);

  let active = PANEL_RULES_PICK[tid] || boxEl.dataset.activeLeague || keys[0] || "";
  if(!keys.includes(active)) active = keys[0] || "";
  boxEl.dataset.activeLeague = active;

  const tabsHtml = `
    <div class="t-league-tabs">
      ${keys.map(k => {
        const isA = (k === active);
        const isTie = (k === tie);
        return `<button type="button" class="t-league-tab ${isA ? "is-active" : ""}" data-leaguekey="${escapeHtml(k)}">${escapeHtml(panelLeagueLabel_(k, isTie))}</button>`;
      }).join("")}
    </div>
  `;

  const lrj = panelTryParseLeagueRulesJson_(c.leagueRulesJson);
  if(!lrj){
    boxEl.innerHTML = tabsHtml + `
      <div class="t-rule is-ban full">
        <div class="t-rule-k">⚠ Reglas por liga</div>
        <div class="t-rule-v">Este torneo es multi-liga, pero <b>leagueRulesJson</b> está vacío o inválido.</div>
      </div>
    `;
    return;
  }

  let rs = (lrj.leagues && lrj.leagues[active]) ? lrj.leagues[active] : null;
  if(!rs){
    const cp = String(active).replace(/[^\d]/g, "");
    if(cp && lrj.leagues && lrj.leagues[cp]) rs = lrj.leagues[cp];
  }

  const norm = panelNormalizeRuleSet_(rs || {});
  const r = {
    bannedFastMoves: panelJoinCsv_(norm.bannedFastMoves),
    bannedChargedMoves: panelJoinCsv_(norm.bannedChargedMoves),
    bannedPokemon: panelJoinCsv_(norm.bannedPokemon),
    bannedTypes: panelJoinCsv_(norm.bannedTypes),
    bannedCategories: panelJoinCsv_(norm.bannedCategories),
    allowedTypes: panelJoinCsv_(norm.allowedTypes),
    allowedCategories: panelJoinCsv_(norm.allowedCategories),
    allowedPokemon: panelJoinCsv_(norm.allowedPokemon)
  };

  const warn = rs ? "" : `
    <div class="t-rule is-ban full">
      <div class="t-rule-k">⚠ Sin reglas para esta liga</div>
      <div class="t-rule-v">No hay reglas definidas para <b>${escapeHtml(active)}</b> dentro de <b>leagueRulesJson</b>.</div>
    </div>
  `;

  boxEl.innerHTML = tabsHtml + warn + panelRenderRulesGrid_(r);
}

function bindPanelRulesTabsOnce_(){
  const box = document.getElementById("tStatusRules");
  if(!box || box.dataset.rulesTabsBound === "1") return;

  box.dataset.rulesTabsBound = "1";
  box.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-leaguekey]");
    if(!btn) return;

    const key = btn.getAttribute("data-leaguekey");
    if(!key) return;

    const tid = (typeof LAST_TORNEO_ID !== "undefined") ? LAST_TORNEO_ID : "";
    if(tid) PANEL_RULES_PICK[tid] = key;

    box.dataset.activeLeague = key;

    if(typeof LAST_TORNEO_CFG !== "undefined" && LAST_TORNEO_CFG){
      renderPanelRulesBox(box, LAST_TORNEO_CFG, tid);
    }
  });
}


function isTrue(v){
  const s = String(v||"").trim().toLowerCase();
  return s === "true" || s === "verdadero" || s === "1" || s === "si" || s === "sí";
}

async function torneoGET(accion, params = {}){
  const qs = new URLSearchParams({ accion: accion, ...params });
  return fetch(`${API}?${qs.toString()}`).then(r=>r.json());
}

async function torneoPOST(payload){
  const accion = String(payload?.accion || payload?.action || "").trim();
  const url = accion ? `${API}?accion=${encodeURIComponent(accion)}` : API;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload || {})
  });

  return r.json();
}




function fmtDateTimeHuman(dt){
  if(!dt) return "-";
  let d = null;

  // "YYYY-MM-DD HH:MM"
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(dt)) {
    d = new Date(dt.replace(" ", "T"));
  } else {
    d = new Date(dt);
  }
  if (isNaN(d.getTime())) return dt;

  return d.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function badge(text, cls=""){
  return `<span class="badge ${cls}">${escapeHtml(text)}</span>`;
}

function suggestedByFormat(format){
  if (format === "single") return 16;
  if (format === "double") return 16;
  if (format === "groups") return 16;
  if (format === "swiss")  return 0;
  return 16;
}

function getSelectedTorneoId(){
  const sel = document.getElementById("tSelect");
  const id = sel ? sel.value : "";
  return String(id || SELECTED_TORNEO_ID || "").trim();
}

/* ================= TOAST ================= */
function toast(msg, tipo = "ok") {
  const box = document.getElementById("toastBox");
  if(!box) return alert(msg);

  const div = document.createElement("div");
  div.className = `toast ${tipo}`;
  div.textContent = msg;

  box.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}


function setBtnLoading(btn, isLoading, loadingText = "Procesando…"){
  if(!btn) return;

  if(isLoading){
    if(btn.dataset._loading === "1") return;
    btn.dataset._loading = "1";
    btn.dataset._oldText = btn.textContent;
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.textContent = loadingText;
  }else{
    btn.disabled = false;
    btn.classList.remove("is-loading");
    if(btn.dataset._oldText !== undefined) btn.textContent = btn.dataset._oldText;
    delete btn.dataset._oldText;
    delete btn.dataset._loading;
  }
}


async function runWithBtn(btn, loadingText, fn){
  setBtnLoading(btn, true, loadingText);
  try{
    return await fn();
  }catch(e){
    toast("⚠ Error: " + (e?.message || e), "error");
    throw e;
  }finally{
    setBtnLoading(btn, false);
  }
}


function updateToggleInscripcionesButton(open){
  const btn = document.getElementById("btnTorneoToggleInscripciones");
 // tu id actual
  if(!btn) return;

  // guardamos estado global
  SELECTED_TORNEO_OPEN = !!open;

  // reset clases
  btn.classList.remove("open","close");

  if(open){
    btn.textContent = "🔒 Cerrar inscripciones";
    btn.classList.add("close");
  }else{
    btn.textContent = "🟢 Abrir inscripciones";
    btn.classList.add("open");
  }
}



/* ================= LOGIN ================= */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if(!form) return;

  const btn  = form.querySelector("button");

  form.addEventListener("submit", function(e) {
    e.preventDefault();
    if (btn.disabled) return;

    const user = document.getElementById("user").value.trim();
    const pin  = document.getElementById("pin").value.trim();

    if (!user || !pin) {
      alert("Completa los datos");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Ingresando…";

    fetch(`${API}?accion=login&user=${encodeURIComponent(user)}&pin=${encodeURIComponent(pin)}`)
      .then(r => r.json())
      .then(async (res) => {
        if (!res.ok) {
          alert("Acceso denegado");
          btn.disabled = false;
          btn.textContent = "Ingresar";
          return;
        }

        ROLE = res.role;
        CURRENT_USER = user;
        ADMIN_USER = user;     // ✅ compat
        ADMIN_PIN = pin;

        document.getElementById("login").style.display = "none";
        document.getElementById("panel").style.display = "block";

        cargar();
        await torneoCargarLista();      // ✅ carga torneos y setea seleccionado
        await torneoActualizar();       // ✅ pinta status y matches del seleccionado
      })
    .catch((e) => {
  console.error(e);
  alert("⚠ Error: " + (e?.message || e));
  btn.disabled = false;
  btn.textContent = "Ingresar";
});

  });
});

/* =============================
   ✅ BO POR FASE: Bind UI
============================= */
document.addEventListener("DOMContentLoaded", () => {
  const chk = document.getElementById("tBoPerPhase");
  const btn = document.getElementById("btnBoAdvOpen");
  const apply = document.getElementById("btnBoAdvApply");

  // init defaults si el form todavía no tiene valores
  const g = document.getElementById("tBoGroups");
  const p = document.getElementById("tBoPlayoffs");
  const f = document.getElementById("tBoFinal");
  const hasAny = !!(g?.value || p?.value || f?.value);

  if(!hasAny){
    writeBoPhaseToInputs_({ enabled:true, groups:1, playoffs:3, final:5 });
  }else{
    updateBoPhaseSummary_();
    updateBoPhaseControlsState_();
  }

  if(chk){
    chk.addEventListener("change", () => {
      updateBoPhaseSummary_();
      updateBoPhaseControlsState_();
    });
  }

  if(btn){
    btn.addEventListener("click", () => {
      if(!readBoPhaseFromInputs_().enabled) return;
      boAdvOpen_();
    });
  }

  if(apply){
    apply.addEventListener("click", boAdvApply_);
  }

  // close handlers (backdrop + X + cancelar)
  const modal = document.getElementById("boAdvModal");
  if(modal){
    modal.querySelectorAll('[data-boadv-close="1"]').forEach(el => {
      el.addEventListener("click", boAdvClose_);
    });
  }

  // preview live
  ["boAdvGroups","boAdvPlayoffs","boAdvFinal"].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener("change", boAdvPreviewUpdate_);
  });
});


/* ================= PENDIENTES ================= */
async function cargar() {
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "flex";

  try {
    const r = await fetch(`${API}?accion=panelListar`);
    const data = await r.json();
    renderTabla(data);
  } catch (e) {
    toast("Error cargando registros", "error");
  } finally {
    if (loading) loading.style.display = "none";
  }
}


function renderTabla(registros) {
  const tbody = document.getElementById("tablaBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!registros.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay registros pendientes</td></tr>`;
    return;
  }

  registros.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Nombre">${escapeHtml(r.nombre)}</td>
      <td data-label="Pokémon">${escapeHtml(r.pokemon)}</td>
      <td data-label="Código">${escapeHtml(r.codigo)}</td>
      <td data-label="Campfire">${escapeHtml(r.campfire || "-")}</td>
      <td class="acciones">
        <button class="action-btn aprobar" onclick="aprobar(${r.fila}, this)">✔ Aprobar</button>
        <button class="action-btn rechazar" onclick="rechazar(${r.fila}, this)">✖ Rechazar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function aprobar(fila, btn) {
  const tr = btn?.closest("tr");
  if(tr) tr.classList.add("aprobado");

  runWithBtn(btn, "Aprobando…", async () => {
    await fetch(`${API}?accion=aprobar&fila=${fila}&user=${encodeURIComponent(CURRENT_USER)}`);
    toast(`Aprobado por ${CURRENT_USER} ✔`);
    await cargar(); // opcional: refresca la lista para que desaparezca
  });
}

function rechazar(fila, btn) {
  const tr = btn?.closest("tr");
  if(tr) tr.classList.add("rechazado");

  runWithBtn(btn, "Rechazando…", async () => {
    await fetch(`${API}?accion=rechazar&fila=${fila}&user=${encodeURIComponent(CURRENT_USER)}`);
    toast(`Rechazado por ${CURRENT_USER} ✖`, "error");
    await cargar(); // opcional
  });
}


async function actualizarDatos() {
  const btn = document.getElementById("btnActualizar");
  if(!btn) return;

  await runWithBtn(btn, "Publicando…", async () => {
    try{
      await fetch(`${API}?accion=limpiarCache`);
      toast("Datos publicados correctamente ✔");
    }catch{
      toast("Error al publicar", "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const dt = document.getElementById("tDateTime");
  if(dt){
    dt.addEventListener("click", () => dt.showPicker?.());
  }
});


/* ================= TORNEO: AUTO SUGERIDO ================= */
document.addEventListener("DOMContentLoaded", () => {
  const formatEl = document.getElementById("tFormat");
  const sugEl = document.getElementById("tSuggested");

  if (formatEl && sugEl) {
    formatEl.addEventListener("change", () => {
      if (sugEl.value.trim() !== "") return;
      const s = suggestedByFormat(formatEl.value);
      sugEl.value = s ? String(s) : "";
    });
  }
});

/* ================= TORNEO: LISTA + SELECTOR ================= */
async function torneoCargarLista({keepSelection=true} = {}){
  const select = document.getElementById("tSelect");
  if(!select) return;

  const prev = keepSelection ? getSelectedTorneoId() : "";

  select.innerHTML = `<option value="">Cargando…</option>`;
  const r = await torneoGET("torneo_list");
  if(!r.ok){
    select.innerHTML = `<option value="">(Error cargando lista)</option>`;
    return;
  }

  const torneos = Array.isArray(r.torneos) ? r.torneos : [];

  if(torneos.length === 0){
    select.innerHTML = `<option value="">(No hay torneos)</option>`;
    SELECTED_TORNEO_ID = "";
    return;
  }

  // ✅ orden: activos arriba, finalizados abajo; y dentro por createdAt
torneos.sort((a,b)=>{
  const sa = normStatus(a.status);
  const sb = normStatus(b.status);
  if(sa !== sb) return (sa === "active") ? -1 : 1;
  return String(a.createdAt||"").localeCompare(String(b.createdAt||""));
});


  select.innerHTML = "";
  torneos.forEach(t => {
    const id = safe(t.torneoId).trim();
    const title = safe(t.title) || "(sin título)";
    const dt = safe(t.dateTime);
    const open = isTrue(t.inscriptionsOpen);
    const gen = isTrue(t.generated);

  const st = normStatus(t.status);
const stMark = (st === "finished") ? "✅" : "🔥";
const label = `${stMark} ${title} — ${fmtDateTimeHuman(dt)} ${open ? "🟢" : "🔒"}`;



    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    select.appendChild(opt);
  });

  // Selección: mantener si existe; sino elegir último
  const exists = prev && torneos.some(t => String(t.torneoId).trim() === prev);
  const actives = torneos.filter(t => normStatus(t.status) === "active");
const fallbackId = actives.length
  ? String(actives[actives.length - 1].torneoId).trim()
  : String(torneos[torneos.length - 1].torneoId).trim();

const chosen = exists ? prev : fallbackId;

  select.value = chosen;
  SELECTED_TORNEO_ID = chosen;

  // al cambiar selector, refresca
   select.onchange = async () => {
    SELECTED_TORNEO_ID = getSelectedTorneoId();
    SELECTED_TORNEO_OPEN = null;
    await torneoActualizar();
  };
}

function torneoIrUltimo(){
  const select = document.getElementById("tSelect");
  if(!select || select.options.length === 0) return;
  select.selectedIndex = select.options.length - 1;
  SELECTED_TORNEO_ID = getSelectedTorneoId();
  torneoActualizar();
}

/* ================= TORNEO: UI + ACCIONES ================= */
async function torneoActualizar(){
  const torneoId = getSelectedTorneoId();

  const infoEl   = document.getElementById("torneoInscritosInfo");
  const body     = document.getElementById("torneoMatchesBody");

  const boxTitle  = document.getElementById("tStatusTitle");
  const boxId     = document.getElementById("tStatusId");
  const boxBadges = document.getElementById("tStatusBadges");
  const boxMeta   = document.getElementById("tStatusMeta");

  if (boxTitle) boxTitle.textContent = "Cargando torneo…";
  if (boxId) boxId.textContent = "";
  if (boxBadges) boxBadges.innerHTML = "";
  if (boxMeta) boxMeta.innerHTML = "";
  if(infoEl) infoEl.textContent = "";
  if(body) body.innerHTML = "";

  MATCH_ROW.clear();


  if(!torneoId){
    if (boxTitle) boxTitle.textContent = "Selecciona un torneo";
    if (boxBadges) boxBadges.innerHTML = badge("Sin torneo seleccionado", "warn");
    if(body) body.innerHTML = `<tr><td colspan="5">Selecciona un torneo</td></tr>`;
    return;
  }

const dashboard = await torneoGET("torneo_dashboard", { torneoId });
  if(!dashboard.ok){
    if (boxTitle) boxTitle.textContent = "Error cargando torneo.";
    if (boxBadges) boxBadges.innerHTML = badge("Error", "warn");
    return;
  }

  const c = dashboard.config || {};
  const tid = safe(dashboard.torneoId || c.torneoId || torneoId).trim();
  LAST_TORNEO_CFG = c;
LAST_TORNEO_ID  = tid;

const open = isTrue(c.inscriptionsOpen);
  const gen  = isTrue(c.generated);
  const prep = String(c.prepEndsAt || "").trim();

  // Mantiene el color/texto del botón original
  updateToggleInscripcionesButton(open);

  // === LÓGICA DE VISIBILIDAD DE BOTONES ===
  const bToggle = document.getElementById("btnTorneoToggleInscripciones");
  const bCerrarM = document.getElementById("btnCerrarManual");
  const bInic30 = document.getElementById("btnIniciar30m");
  const bForce = document.getElementById("btnForceStart");
  const bGen = document.getElementById("btnTorneoGenerarSingle");

  // Verificar si el tiempo de preparación sigue activo (Manual o Cronómetro corriendo)
  let isPrepRunning = false;
  if (prep === "MANUAL") {
    isPrepRunning = true;
  } else if (prep) {
    const endMs = new Date(prep.replace(" ", "T")).getTime();
    if (Date.now() < endMs) isPrepRunning = true;
  }

  if (open) {
    // ABIERTO: Mostrar Cerrar Manual y ocultar el resto
    if(bToggle) bToggle.style.display = "none"; 
    if(bCerrarM) bCerrarM.style.display = "inline-block";
    if(bInic30) bInic30.style.display = "none";
    if(bForce) bForce.style.display = "none";
    if(bGen) bGen.style.display = "none";
  } else if (!gen) {
    // CERRADO PERO SIN GENERAR: Mostrar opciones de prep y Generar Bracket
    if(bToggle) bToggle.style.display = "inline-block"; 
    if(bCerrarM) bCerrarM.style.display = "none";
    if(bInic30) bInic30.style.display = (prep === "MANUAL") ? "inline-block" : "none";
    if(bForce) bForce.style.display = "inline-block";
    if(bGen) bGen.style.display = "inline-block";
  } else {
    // GENERADO (En curso)
    if(bToggle) bToggle.style.display = "none";
    if(bCerrarM) bCerrarM.style.display = "none";
    // Si ya se generó pero el cronómetro o espera manual siguen activos, mantén el botón rojo
    if(bForce) bForce.style.display = isPrepRunning ? "inline-block" : "none";
    // Puedes iniciar los 30 min incluso con el bracket ya generado
    if(bInic30) bInic30.style.display = (isPrepRunning && prep === "MANUAL") ? "inline-block" : "none";
    if(bGen) bGen.style.display = "none";
  }

  const title = safe(c.title) || "(sin título)";
  const format = safe(c.format) || "-";
  const league = safe(c.leaguePlan || c.league) || "-";
  const mode   = safe(c.mode) || "-";
  const dt     = safe(c.dateTime) || "-";
  const bo     = safe(c.bestOf) || "-";
    // ✅ BO por fase (para calcular needWins por match)
  // Si no viene guardado aún, usamos default ON (1/3/5) como pediste.
  let BO_PHASE = { enabled:true, groups:1, playoffs:3, final:5 };

  try{
    const rawBo = safe(c.boPhasesJson || c.boRulesJson || "");
    const parsed = (typeof parseBoPhasesJson_ === "function") ? parseBoPhasesJson_(rawBo) : null;
    if(parsed && parsed.enabled){
      BO_PHASE = { enabled:true, groups:parsed.groups, playoffs:parsed.playoffs, final:parsed.final };
    }
  }catch(_){}

  const BO_GLOBAL_NUM = Number(c.bestOf || 3);

  function boForMatch_(m){
    if(!BO_PHASE.enabled) return BO_GLOBAL_NUM || 3;

    const stage = String(m.Stage || m.stage || "").trim().toLowerCase();
    const next  = String(m.NextMatchId || m.nextMatchId || "").trim();

    if(stage === "groups") return BO_PHASE.groups;
    if(!next && stage !== "groups" && stage !== "swiss") return BO_PHASE.final;
    return BO_PHASE.playoffs;
  }

  const suggested = Number(c.suggestedSize || 0);
    const st = normStatus(c.status || "active");
  const finishedAtRaw = c.finishedAt ?? "";
  const prizesList = parsePrizesJson(c.prizesJson || "[]");

const banFastEl = document.getElementById("tBanFast");
const banChargedEl = document.getElementById("tBanCharged");
const banPokemonEl = document.getElementById("tBanPokemon");
const banTypesEl = document.getElementById("tBanTypes");
const banCatsEl = document.getElementById("tBanCategories");
const allowPokemonEl = document.getElementById("tAllowedPokemon");
if (banPokemonEl) banPokemonEl.value = safe(c.bannedPokemon);

// ✅ además, pinta chips según el valor cargado del torneo
if (typeof setBansFromValue === "function") {
  setBansFromValue(banPokemonEl.value);
}


if(banFastEl) banFastEl.value = safe(c.bannedFastMoves);
if(banChargedEl) banChargedEl.value = safe(c.bannedChargedMoves);
if(banPokemonEl) banPokemonEl.value = safe(c.bannedPokemon);
if(banTypesEl) banTypesEl.value = safe(c.bannedTypes);
if(banCatsEl) banCatsEl.value = safe(c.bannedCategories);
if(allowPokemonEl) allowPokemonEl.value = safe(c.allowedPokemon);

const allowTypesEl = document.getElementById("tAllowTypes");
const allowCatsEl  = document.getElementById("tAllowCategories");

if (allowTypesEl) allowTypesEl.value = safe(c.allowedTypes);
if (allowCatsEl)  allowCatsEl.value  = safe(c.allowedCategories);


// re-render chips
if(typeof bindTypeCategoryChips === "function") bindTypeCategoryChips();
if(typeof setAllowedFromValue === "function") setAllowedFromValue(allowPokemonEl?.value || "");

  if (boxTitle) boxTitle.textContent = title;
  if (boxId) boxId.textContent = `ID: ${tid}`;

  if (boxBadges){
    const badges = [];
    // ✅ NUEVO: estado del torneo (activo / finalizado)
    badges.push(st === "finished" ? badge("Finalizado", "warn") : badge("Activo", "ok"));

    badges.push(open ? badge("Inscripciones abiertas", "ok") : badge("Inscripciones cerradas", "lock"));
    badges.push(gen ? badge("Bracket generado", "ok") : badge("Bracket no generado", "warn"));
    badges.push(badge(`Formato: ${format}`));
    badges.push(badge(`Liga: ${league}`));
    badges.push(badge(mode === "presencial" ? "Presencial" : "Virtual"));
    badges.push(badge(`BO${bo}`));

    // ✅ NUEVO: indicador rápido de premios (sin imagen)
    if (prizesList && prizesList.length){
      badges.push(badge(`Premios: ${prizesList.length}`, "ok"));
    }

    boxBadges.innerHTML = badges.join("");
  }

    if (boxMeta){
    const prizesText = (()=>{
      if(!prizesList || prizesList.length === 0) return "—";
      const names = prizesList.map(p => (p?.name || "").trim()).filter(Boolean);
      if(names.length) return escapeHtml(names.join(", "));
      // fallback: si no hay nombres, mostramos el último segmento del URL del ícono
      const urls = prizesList.map(p => String(p?.icon || "").trim()).filter(Boolean);
      if(!urls.length) return "—";
      const last = urls.map(u => u.split("/").pop()).filter(Boolean);
      return escapeHtml(last.join(", "));
    })();

    const finishedAt = safe(finishedAtRaw).trim();
    const finishedHtml = (st === "finished" && finishedAt)
      ? `<div><span class="k">Finalizado</span><span class="v">${escapeHtml(fmtDateTimeHuman(finishedAt))}</span></div>`
      : "";

    boxMeta.innerHTML = `
      <div><span class="k">Fecha</span><span class="v">${escapeHtml(fmtDateTimeHuman(dt))}</span></div>
      <div><span class="k">Sugerido</span><span class="v">${suggested ? escapeHtml(String(suggested)) : "Auto"}</span></div>
      <div><span class="k">Estado</span><span class="v">${escapeHtml(statusLabel(st))}</span></div>
      ${finishedHtml}
      <div class="full"><span class="k">Premios</span><span class="v">${prizesText}</span></div>
    `;
  }


  const boxRules = document.getElementById("tStatusRules");

function prettyRule(s){
  const v = safe(s).trim();
  return v ? escapeHtml(v) : "—";
}


function prettyTypes(raw){
  const keys = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  if(keys.length === 0) return "—";
  return escapeHtml(keys.map(k => typeLabel(k)).join(", "));
}

function prettyCategories(raw){
  const keys = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  if(keys.length === 0) return "—";
  return escapeHtml(keys.map(k => categoryLabel(k)).join(", "));
}

if(boxRules){
  // ✅ tabs + render por liga (si multi)
  bindPanelRulesTabsOnce_();
  renderPanelRulesBox(boxRules, c, tid);
}



function moveIdsToNames(raw){
  const ids = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim())
    .filter(Boolean);

  if(ids.length === 0) return "—";

  return ids.map(id => {
    const m = MOVE_BY_ID.get(String(id));
    if(m) return moveLabel(m);
    // fallback: si viniera con _ (por si acaso)
    return String(id).replace(/_/g, " ");
  }).join(", ");
}


function dexListToNames(raw){
  const ids = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim())
    .filter(Boolean);

  if(ids.length === 0) return "—";

  return ids.map(iconId => {
    const dex = String(iconId).split("_")[0];
    const name = POKEMON_BY_DEX.get(dex) || `Dex ${dex}`;
    return `${name}${kindLabelFromIconId(iconId)}`;
  }).join(", ");
}



// inscritos (Cargados desde el dashboard en 1 sola llamada)
  window.PARTICIPANTES_CACHE = (dashboard.inscritos || []); 
  const inscritos = window.PARTICIPANTES_CACHE;
  const count = inscritos.length;

  if(infoEl){
    if(suggested > 0 && open){
      const faltan = Math.max(0, suggested - count);
      infoEl.textContent = `Inscritos: ${count}. Faltan ${faltan} para llegar a ${suggested}.`;
    }else{
      infoEl.textContent = `Inscritos: ${count}.`;
    }
  }

  const nameMap = {};
  inscritos.forEach(p => {
    nameMap[p.PlayerId] = p.NombrePokemonGO || p.Nombre || p.PlayerId;
  });

// matches (Cargados desde el dashboard en 1 sola llamada)
  const matches = (dashboard.matches || []);

  if(!body) return;

  body.innerHTML = "";
  if(matches.length === 0){
    body.innerHTML = `<tr><td colspan="5">Aún no hay matches (genera el bracket)</td></tr>`;
    return;
  }

  matches
    .sort((a,b)=> (Number(a.Round)-Number(b.Round)) || (Number(a.Slot)-Number(b.Slot)))
    .forEach(m => {
      const aId = safe(m.PlayerAId);
      const bId = safe(m.PlayerBId);
      const aName = aId ? (nameMap[aId] || aId) : "TBD";
      const bName = bId ? (nameMap[bId] || bId) : "TBD";
      const boThisMatch = boForMatch_(m);
// ✅ Operación (status/ubicación) para UI
const opStatus = normMatchStatus(m); // scheduled/running/paused/finished/cancelled
const location = String(m.Location ?? m.location ?? "");


    const done = safe(m.Status) === "done";
const disabled = (!aId || !bId); // ✅ NO bloquees por done, porque Editar debe quedar disponible


      // si el match ya está finalizado en backend, lo marcamos como locked en UI
if(done){
  const st = getOrInitMatchState(String(m.MatchId));
  st.locked = true;
  // no sabemos si ganó A o B desde backend (si no viene winnerId),
  // pero al menos quedará deshabilitado.
}


      const tr = document.createElement("tr");
tr.innerHTML = `
  <td>${escapeHtml(safe(m.MatchId))}</td>
  <td>${escapeHtml(safe(m.Round))}</td>

  <td>
    <div class="match-actions"
      data-match="${escapeHtml(safe(m.MatchId))}"
      data-aid="${escapeHtml(aId)}"
      data-bid="${escapeHtml(bId)}"
      data-needwins="${escapeHtml(String(needWinsFromBestOf(boThisMatch)))}"
      data-nextmatch="${escapeHtml(safe(m.NextMatchId))}"
      data-scorea="${escapeHtml(String(Number(m.ScoreA ?? 0)))}"
      data-scoreb="${escapeHtml(String(Number(m.ScoreB ?? 0)))}"
      data-status="${escapeHtml(safe(m.Status))}"
data-winnerid="${escapeHtml(safe(m.WinnerId))}"
data-matchstatus="${escapeHtml(opStatus)}"
data-location="${escapeHtml(location)}">


      <div class="match-grid">
        <!-- A -->
        <div class="m-player">
          <div class="m-name">${escapeHtml(aName)}</div>
          <button class="btn-gold btn-win" data-winbtn="A" ${disabled ? "disabled" : ""}>Ganador A</button>
        </div>

        <!-- SCORE -->
        <div class="m-score">
          <div class="m-scoreline">
            <!-- Controles A (junto a Carlos) -->
            <button class="score-btn" data-scorebtn="A" data-delta="+1" ${disabled ? "disabled" : ""}>+</button>
            <button class="score-btn" data-scorebtn="A" data-delta="-1" ${disabled ? "disabled" : ""}>−</button>

            <span class="score-pill" data-score>${Number(m.ScoreA ?? 0)} - ${Number(m.ScoreB ?? 0)}</span>

            <!-- Controles B (junto a Ramon) -->
            <button class="score-btn" data-scorebtn="B" data-delta="-1" ${disabled ? "disabled" : ""}>−</button>
            <button class="score-btn" data-scorebtn="B" data-delta="+1" ${disabled ? "disabled" : ""}>+</button>
          </div>

          <button class="btn-gold btn-scorepush" data-pushscore="1" ${disabled ? "disabled" : ""}>SUBIR MARCADOR</button>
        </div>

        <!-- B -->
        <div class="m-player">
          <div class="m-name">${escapeHtml(bName)}</div>
          <button class="btn-gold btn-win" data-winbtn="B" ${disabled ? "disabled" : ""}>Ganador B</button>
        </div>
        </div>

      <div class="match-ops" data-matchops="1">
        <span class="chip chip-op" data-mchip="1">${escapeHtml(matchStatusLabel(opStatus))}</span>

        <input class="m-loc" data-mloc="1"
          placeholder="Ubicación (Mesa 4)"
          value="${escapeHtml(location)}"
        />

        <select class="m-opstatus" data-mstatus="1">
          <option value="scheduled" ${opStatus==="scheduled" ? "selected" : ""}>Programado</option>
          <option value="running"   ${opStatus==="running" ? "selected" : ""}>En juego</option>
          <option value="paused"    ${opStatus==="paused" ? "selected" : ""}>Pausado</option>
          <option value="finished"  ${opStatus==="finished" ? "selected" : ""}>Finalizado</option>
          <option value="cancelled" ${opStatus==="cancelled" ? "selected" : ""}>Cancelado</option>
        </select>

        <button class="btn-ghost" data-mtoggle="1">${opStatus==="paused" ? "Reanudar" : "Pausar"}</button>
      </div>
    </div>
  </td>


  <!-- Editar separado y centrado -->
  <td class="m-edit-td">
    <button class="btn-ghost btn-edit" data-edit="1" ${(!aId || !bId) ? "disabled" : ""}>Editar</button>
  </td>
`;

      body.appendChild(tr);
      // ✅ Guarda referencia para refrescar SOLO este match luego
const box = tr.querySelector(".match-actions");
if (box) {
  MATCH_ROW.set(String(m.MatchId), { tr, box });
}

    });

// ================= MATCH UI EVENTS =================
body.querySelectorAll(".match-actions").forEach(box => {
  const tr = box.closest("tr");
  const matchId = box.getAttribute("data-match");
  const needWins = Number(box.getAttribute("data-needwins") || 2);


  const st = getOrInitMatchState(matchId);

 st.a = Number(box.dataset.scorea || 0);
st.b = Number(box.dataset.scoreb || 0);

// si ya estaba terminado en la hoja, bloquea y pinta ganador
const status = String(box.dataset.status || "");
const w = String(box.dataset.winnerid || "");
const aId = String(box.dataset.aid || "");
const bId = String(box.dataset.bid || "");


if(status === "done"){
  st.locked = true;
  if(w && w === aId) st.winnerId = "A";
  else if(w && w === bId) st.winnerId = "B";
}
renderScore(tr, st);



  // Si el backend marca done, bloquea visualmente (si tienes Status=done)
  // Nota: si tu backend devuelve winnerId en m, aquí podrías setearlo.
  // Por ahora el lock real pasa cuando guardas.

  renderScore(tr, st);
  applyRowVisual(tr, st);
  applyButtonsVisual(tr, st);
// ✅ Operación (MatchStatus/Ubicación)
  const locEl = box.querySelector('[data-mloc="1"]');
  const msEl  = box.querySelector('[data-mstatus="1"]');
  const tglEl = box.querySelector('[data-mtoggle="1"]');

  if(msEl){
    msEl.value = String(box.dataset.matchstatus || normMatchStatus(box.dataset)).toLowerCase() || "scheduled";
    applyOpsVisual(tr, msEl.value);

    msEl.addEventListener("change", () => {
      const torneoId = getSelectedTorneoId();
      const matchStatus = String(msEl.value || "").trim().toLowerCase();

      // 🚀 OPTIMIZACIÓN: Actualización local inmediata
      box.dataset.matchstatus = matchStatus;
      applyOpsVisual(tr, matchStatus);
      toast("⏳ Guardando status...", "ok");

      // Llamada en segundo plano sin 'await'
      torneoPOST({
        accion: "match_update_status", user: CURRENT_USER, pin: ADMIN_PIN,
        torneoId, matchId, matchStatus
      }).then(r => {
        if(!r.ok){
          toast("❌ " + (r.error || "Error de status"), "error");
          refrescarSoloMatches(torneoId, [matchId]); // Revertir visualmente
        } else {
          toast("✅ Status actualizado", "ok");
        }
      });
    });
  }

  if(locEl){
    locEl.addEventListener("blur", () => {
      const torneoId = getSelectedTorneoId();
      const location = String(locEl.value || "").trim();
      
      if(box.dataset.location === location) return; // Evitar fetch innecesario

      // 🚀 OPTIMIZACIÓN: Actualización local inmediata
      box.dataset.location = location;

      torneoPOST({
        accion: "match_update_location", user: CURRENT_USER, pin: ADMIN_PIN,
        torneoId, matchId, location
      }).then(r => {
        if(!r.ok){
          toast("❌ " + (r.error || "Error en ubicación"), "error");
          refrescarSoloMatches(torneoId, [matchId]);
        } else {
          toast("✅ Ubicación guardada", "ok");
        }
      });
    });
  }

  if(tglEl && msEl){
    tglEl.addEventListener("click", () => {
      const torneoId = getSelectedTorneoId();
      const current = String(msEl.value || "").trim().toLowerCase();
      const next = (current === "paused") ? "running" : "paused";

      // 🚀 OPTIMIZACIÓN: Actualización local inmediata
      msEl.value = next;
      box.dataset.matchstatus = next;
      applyOpsVisual(tr, next);

      torneoPOST({
        accion: "match_update_status", user: CURRENT_USER, pin: ADMIN_PIN,
        torneoId, matchId, matchStatus: next
      }).then(r => {
        if(!r.ok){
          toast("❌ " + (r.error || "No se pudo pausar/reanudar"), "err");
          refrescarSoloMatches(torneoId, [matchId]);
        } else {
          toast(next === "paused" ? "⏸ Match pausado" : "▶ Match reanudado", "ok");
        }
      });
    });
  }

  // + / - marcador (100% local, no requiere servidor hasta presionar subir/guardar)
  box.querySelectorAll("[data-scorebtn]").forEach(btn => {
    btn.onclick = () => {
      if(st.locked) return;

      const side = btn.getAttribute("data-scorebtn"); // A o B
      const delta = Number(btn.getAttribute("data-delta") || 0);

      if(side === "A") st.a = clampScore(st.a + delta);
      if(side === "B") st.b = clampScore(st.b + delta);

      renderScore(tr, st);

      // Sugerir ganador visualmente
      if(st.a >= needWins){
        st.winnerId = "A";
        applyButtonsVisual(tr, st);
      } else if(st.b >= needWins){
        st.winnerId = "B";
        applyButtonsVisual(tr, st);
      } else {
        st.winnerId = "";
        applyButtonsVisual(tr, st);
      }
    };
  });

  // Editar (desbloquea localmente)
  const editBtn = tr.querySelector("[data-edit='1']");
  if(editBtn){
    editBtn.onclick = () => {
      st.locked = false;
      st.winnerId = "";
      renderScore(tr, st);
      applyRowVisual(tr, st);
      applyButtonsVisual(tr, st);
      box.querySelectorAll("button").forEach(b => b.disabled = false);
    };
  }

  // 🚀 OPTIMIZACIÓN: Subir marcador al instante
  const pushBtn = box.querySelector("[data-pushscore='1']");
  if(pushBtn){
    pushBtn.onclick = () => {
      if(st.locked) return;

      // Actualización visual inmediata
      box.dataset.scorea = String(st.a);
      box.dataset.scoreb = String(st.b);
      renderScore(tr, st);
      toast("✅ Marcador actualizado", "ok"); // Feedback engañoso pero fluido

      setBtnLoading(pushBtn, true, "..."); 

      // Fetch en segundo plano
      torneoPOST({
        accion: "torneo_update_score", user: CURRENT_USER, pin: ADMIN_PIN,
        torneoId: tid, matchId, scoreA: st.a, scoreB: st.b
      }).then(r => {
        setBtnLoading(pushBtn, false);
        if(!r.ok){
          toast("⚠ " + (r.error || "Error de red"), "error");
          refrescarSoloMatches(tid, [matchId]); // revierte si falla
        }
      }).catch(() => {
        setBtnLoading(pushBtn, false);
        toast("⚠ Error de conexión", "error");
      });
    };
  }

  // 🚀 OPTIMIZACIÓN: Guardar Ganador al instante
  box.querySelectorAll("[data-winbtn]").forEach(btn => {
    btn.onclick = () => {
      if(st.locked) return;

      const side = btn.getAttribute("data-winbtn"); // A o B
      const a = st.a, b = st.b;
      const okWinner = (side === "A" && a >= needWins) || (side === "B" && b >= needWins);

      if(!okWinner){
        toast(`⚠ Para guardar, ${side} debe llegar a ${needWins} (ahora va ${a}-${b})`, "error");
        return;
      }

      // Bloqueo visual inmediato (UI optimista)
      st.locked = true;
      st.winnerId = side;
      applyRowVisual(tr, st);
      applyButtonsVisual(tr, st);
      
      const winnerId = (side === "A") ? box.getAttribute("data-aid") : box.getAttribute("data-bid");
      box.dataset.status = "done";
      box.dataset.winnerid = winnerId;

      toast("⏳ Guardando resultado...", "ok");
      setBtnLoading(btn, true, "...");

      // Enviamos POST sin bloquear la pantalla con await
      torneoPOST({
        accion: "torneo_report_result", user: CURRENT_USER, pin: ADMIN_PIN,
        torneoId: tid, matchId, winnerId, scoreA: st.a, scoreB: st.b
      }).then(r => {
        setBtnLoading(btn, false);
        
        if(!r.ok){
          // Si el servidor rechazó, desbloqueamos la fila (rollback)
          st.locked = false;
          st.winnerId = "";
          box.dataset.status = "";
          box.dataset.winnerid = "";
          applyRowVisual(tr, st);
          applyButtonsVisual(tr, st);
          return toast("⚠ " + (r.error || "Error"), "error");
        }

        toast("✅ Resultado confirmado", "ok");

        // Refrescamos en segundo plano SOLO la llave siguiente para que el nombre 
        // del ganador pase automáticamente a la siguiente ronda sin pausar la web.
        const nextMatchId = String(box.dataset.nextmatch || "");
        if(nextMatchId) refrescarSoloMatches(tid, [matchId, nextMatchId]);
        
      }).catch(() => {
        setBtnLoading(btn, false);
        toast("⚠ Error de conexión", "error");
      });
    };
  });
});

}

/* ===== BOTONES TORNEO + TABS ===== */

/* ===== BOTONES TORNEO + TABS ===== */
document.addEventListener("DOMContentLoaded", () => {
  const btnCrear   = document.getElementById("btnTorneoCrear");
  const btnAct     = document.getElementById("btnTorneoActualizar");
  const btnCerrar  = document.getElementById("btnTorneoToggleInscripciones");
  const btnGen     = document.getElementById("btnTorneoGenerarSingle");
  const btnForceStart = document.getElementById("btnTorneoForceStart");
const btnSeed40     = document.getElementById("btnTorneoSeed40");
  const btnRefList = document.getElementById("btnTorneoRefrescarLista");
  
  const btnSaveRules = document.getElementById("btnTorneoGuardarReglas");
const btnDelete = document.getElementById("btnTorneoEliminar");
const btnSave = document.getElementById("btnTorneoGuardarCambios");

  if(!btnSave) return;

  btnSave.onclick = async () => {
    const torneoId = getSelectedTorneoId();
    if(!torneoId) return toast("⚠ Selecciona un torneo", "error");

    const rawDT = document.getElementById("tDateTime").value.trim();
    const dateTime = rawDT ? rawDT.replace("T", " ") : "";

   const payload = {
  accion: "torneo_update",
  user: CURRENT_USER,
  pin: ADMIN_PIN,
  torneoId,
  // ✅ premios
prizesJson: document.getElementById("tPrizesJson")?.value || "[]",

  title: document.getElementById("tTitle").value.trim(),
  format: document.getElementById("tFormat").value,
  leaguePlan: document.getElementById("tLeaguePlan").value,
  mode: document.getElementById("tMode").value,
  dateTime,
  bestOf: document.getElementById("tBestOf").value,
    // ✅ BO por fase (JSON)
  boPhasesJson: (typeof buildBoPhasesJson_ === "function") ? buildBoPhasesJson_() : "",

  suggestedSize: document.getElementById("tSuggested").value.trim(),
  bannedFastMoves: document.getElementById("tBanFast").value || "",
  bannedChargedMoves: document.getElementById("tBanCharged").value || "",
  bannedPokemon: document.getElementById("tBanPokemon").value || "",
  bannedTypes: document.getElementById("tBanTypes")?.value || "",
  bannedCategories: document.getElementById("tBanCategories")?.value || "",
  allowedPokemon: document.getElementById("tAllowedPokemon")?.value || "",

  // ✅ NUEVO
  allowedTypes: document.getElementById("tAllowTypes")?.value || "",
  allowedCategories: document.getElementById("tAllowCategories")?.value || ""
};

// ✅ Presencial: mesas / escenario
const venueCfg = readVenueCfg_();
payload.tablesCount = venueCfg.tablesCount;
payload.hasMainStage = venueCfg.hasMainStage;
payload.mainStageFrom = venueCfg.mainStageFrom;
payload.mainStageRandomPct = venueCfg.mainStageRandomPct;


// ✅ FIX: si el formato es "groups", suggestedSize NO se guarda directo.
// El backend calcula suggestedSize = groupsCount * 4, así que debemos mandar groupsCount.
const fmtEdit = String(payload.format || "").trim().toLowerCase();

if (fmtEdit === "groups") {
  const sug = Number(payload.suggestedSize || 0);

  if (!Number.isFinite(sug) || sug <= 0) {
    return toast("⚠ En GRUPOS debes poner Participantes (múltiplo de 4).", "error");
  }

  if (sug % 4 !== 0) {
    return toast("⚠ En GRUPOS los participantes deben ser múltiplo de 4 (16, 20, 24, 28...).", "error");
  }

  let gCount = Math.floor(sug / 4);
  gCount = Math.max(2, Math.min(10, gCount)); // 8 a 40 participantes

  payload.groupsCount = String(gCount);

  // Mantener el "clasifican 1 o 2 por grupo" si ya existía; si no, default 2.
  const gqFromCfg =
    (typeof LAST_TORNEO_CFG === "object" && LAST_TORNEO_CFG && String(LAST_TORNEO_ID || "") === String(torneoId))
      ? Number(LAST_TORNEO_CFG.groupsQualify || 2)
      : 2;

  payload.groupsQualify = (gqFromCfg === 1) ? "1" : "2";
} else {
  // Si no es groups, no mandamos config de grupos
  delete payload.groupsCount;
  delete payload.groupsQualify;
}


// ✅ MULTI-LIGA: guardar por liga en leagueRulesJson y limpiar reglas globales
const lrj = (typeof lrjPrepareForSubmit_ === "function")
  ? lrjPrepareForSubmit_()
  : { isMulti:false, leagueRulesJson:"" };

if(lrj.isMulti){
  payload.leagueRulesJson = lrj.leagueRulesJson || "";

  // 🚫 en multi-liga NO hay reglas globales
  payload.bannedFastMoves = "";
  payload.bannedChargedMoves = "";
  payload.bannedPokemon = "";
  payload.bannedTypes = "";
  payload.bannedCategories = "";
  payload.allowedPokemon = "";
  payload.allowedTypes = "";
  payload.allowedCategories = "";
}else{
  // Caso A: 1 liga -> no se usa JSON (y limpiamos por si antes era multi)
  payload.leagueRulesJson = "";
}

    await runWithBtn(btnSave, "Guardando…", async () => {
      const r = await torneoPOST(payload);
      if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");
      toast("✅ Torneo actualizado");
      modalClose();
      await torneoCargarLista({keepSelection:true});
      await torneoActualizar();
    });
  };

if(btnSaveRules) btnSaveRules.onclick = async () => {
  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");

  const bannedFastMoves = document.getElementById("tBanFast")?.value || "";
const bannedChargedMoves = document.getElementById("tBanCharged")?.value || "";
const bannedPokemon = document.getElementById("tBanPokemon")?.value || ""; // hidden con los dex

  await runWithBtn(btnSaveRules, "Guardando…", async () => {
    const payload = {
  accion: "torneo_update_rules",
  user: CURRENT_USER,
  pin: ADMIN_PIN,
  torneoId,
  bannedFastMoves,
  bannedChargedMoves,
  bannedPokemon,
  bannedTypes: document.getElementById("tBanTypes")?.value || "",
  bannedCategories: document.getElementById("tBanCategories")?.value || "",
  allowedPokemon: document.getElementById("tAllowedPokemon")?.value || "",

  // ✅ NUEVO
  allowedTypes: document.getElementById("tAllowTypes")?.value || "",
  allowedCategories: document.getElementById("tAllowCategories")?.value || ""
};

// ✅ MULTI-LIGA: guardar por liga y limpiar reglas globales
const lrj = (typeof lrjPrepareForSubmit_ === "function")
  ? lrjPrepareForSubmit_()
  : { isMulti:false, leagueRulesJson:"" };

if(lrj.isMulti){
  payload.leagueRulesJson = lrj.leagueRulesJson || "";

  payload.bannedFastMoves = "";
  payload.bannedChargedMoves = "";
  payload.bannedPokemon = "";
  payload.bannedTypes = "";
  payload.bannedCategories = "";
  payload.allowedPokemon = "";
  payload.allowedTypes = "";
  payload.allowedCategories = "";
}else{
  payload.leagueRulesJson = "";
}

const r = await torneoPOST(payload);


    if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");
    toast("✅ Reglas guardadas");
    await torneoActualizar();
  });
};

if(btnForceStart) btnForceStart.onclick = async () => {
  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");

  const ok = confirm("⚡ ¿Forzar INICIO AHORA?\n\nEsto pondrá la preparación en 0 (prepEndsAt = ahora).\nÚsalo solo por fuerza mayor.");
  if(!ok) return;

  await runWithBtn(btnForceStart, "Iniciando…", async () => {
    const r = await torneoPOST({
      accion: "torneo_force_start",
      user: CURRENT_USER,
      pin: ADMIN_PIN,
      torneoId
    });

    if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");

    toast("✅ Preparación finalizada (inicio forzado)");
    await torneoCargarLista({keepSelection:true});
    await torneoActualizar();
  });
};


if(btnSeed40) btnSeed40.onclick = async () => {
  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");

  const raw = prompt("¿A cuántos participantes quieres llegar? (recomendado: 40)", "40");
  if(raw === null) return;

  const targetCount = Number(String(raw).trim());
  if(!Number.isFinite(targetCount) || targetCount < 1 || targetCount > 200){
    return toast("⚠ Número inválido (1 a 200)", "error");
  }

  const ok = confirm(`🧪 ¿Poblar inscritos hasta llegar a ${targetCount}?\n\nSe crearán participantes dummy con IDs/códigos únicos.`);
  if(!ok) return;

  await runWithBtn(btnSeed40, "Poblando…", async () => {
    const r = await torneoPOST({
      accion: "torneo_seed_dummy_inscritos",
      user: CURRENT_USER,
      pin: ADMIN_PIN,
      torneoId,
      targetCount
    });

    if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");

    toast(`✅ Listo: agregados ${r.added || 0} (total objetivo: ${r.targetCount || targetCount})`);
    await torneoActualizar();
  });
};


if(btnDelete) btnDelete.onclick = async () => {
  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");

  const ok = confirm(`¿Seguro que quieres borrar el torneo?\n${torneoId}\n\nSe borrarán: torneo + matches + inscritos.`);
  if(!ok) return;

  await runWithBtn(btnDelete, "Borrando…", async () => {
    const r = await torneoPOST({
      accion: "torneo_delete",
      user: CURRENT_USER,
      pin: ADMIN_PIN,
      torneoId
    });

    if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");

    toast("🗑️ Torneo borrado");
    await torneoCargarLista({keepSelection:false});
    await torneoActualizar();
  });
};


 if(btnAct) btnAct.onclick = async () => {
  await runWithBtn(btnAct, "Actualizando…", async () => {
    await torneoCargarLista({keepSelection:true});
    await torneoActualizar();
  });
};



  // anti-spam
let creandoTorneo = false;

if (btnCrear) btnCrear.onclick = async () => {
  if (creandoTorneo) return;
  creandoTorneo = true;

  await runWithBtn(btnCrear, "Creando…", async () => {
    const title = document.getElementById("tTitle").value.trim();
    const rawDT = document.getElementById("tDateTime").value.trim();
    const dateTime = rawDT ? rawDT.replace("T", " ") : "";

    const format = document.getElementById("tFormat").value;

    const leaguePlanEl = document.getElementById("tLeaguePlan");
    const leaguePlan = leaguePlanEl ? leaguePlanEl.value : "";

    const mode = document.getElementById("tMode").value;
    const bestOf = document.getElementById("tBestOf").value;

    const suggestedRaw = document.getElementById("tSuggested").value.trim();
    const suggestedSize = suggestedRaw ? Number(suggestedRaw) : null;

    if (!title || !rawDT) {
      toast("⚠ Falta título o fecha/hora", "error");
      return;
    }

const bannedFastMoves    = document.getElementById("tBanFast")?.value || "";
const bannedChargedMoves = document.getElementById("tBanCharged")?.value || "";
const bannedPokemon      = document.getElementById("tBanPokemon")?.value || ""; // hidden dex list

const payload = {
  accion: "torneo_crear",
  user: CURRENT_USER,
  pin: ADMIN_PIN,
  title,
  format,
  leaguePlan,
  mode,
  dateTime,
  bestOf,
    // ✅ BO por fase (JSON)
  boPhasesJson: (typeof buildBoPhasesJson_ === "function") ? buildBoPhasesJson_() : "",

  // ✅ premios
prizesJson: document.getElementById("tPrizesJson")?.value || "[]",

  bannedFastMoves,
  bannedChargedMoves,
  bannedPokemon,
  bannedTypes: document.getElementById("tBanTypes")?.value || "",
  bannedCategories: document.getElementById("tBanCategories")?.value || "",
  allowedPokemon: document.getElementById("tAllowedPokemon")?.value || "",

  // ✅ NUEVO
  allowedTypes: document.getElementById("tAllowTypes")?.value || "",
  allowedCategories: document.getElementById("tAllowCategories")?.value || "",

  // ✅ NUEVO (premios + estado)
  prizesJson: document.getElementById("tPrizesJson")?.value || "[]",
  status: document.getElementById("tStatus")?.value || "active"
  
};

// ✅ Presencial: mesas / escenario
const venueCfg = readVenueCfg_();
payload.tablesCount = venueCfg.tablesCount;
payload.hasMainStage = venueCfg.hasMainStage;
payload.mainStageFrom = venueCfg.mainStageFrom;
payload.mainStageRandomPct = venueCfg.mainStageRandomPct;


// ✅ MULTI-LIGA: guardar por liga en leagueRulesJson y limpiar reglas globales
const lrj = (typeof lrjPrepareForSubmit_ === "function")
  ? lrjPrepareForSubmit_()
  : { isMulti:false, leagueRulesJson:"" };

if(lrj.isMulti){
  payload.leagueRulesJson = lrj.leagueRulesJson || "";

  payload.bannedFastMoves = "";
  payload.bannedChargedMoves = "";
  payload.bannedPokemon = "";
  payload.bannedTypes = "";
  payload.bannedCategories = "";
  payload.allowedPokemon = "";
  payload.allowedTypes = "";
  payload.allowedCategories = "";
}else{
  payload.leagueRulesJson = "";
}



if (suggestedSize !== null && Number.isFinite(suggestedSize)) {
  payload.suggestedSize = suggestedSize;
}

// ✅ FIX: si creas en "groups", debes enviar groupsCount (participantes / 4)
const fmtCreate = String(format || "").trim().toLowerCase();
if (fmtCreate === "groups") {
  const sug = Number(payload.suggestedSize || 16);

  if (sug % 4 !== 0) {
    toast("⚠ En GRUPOS los participantes deben ser múltiplo de 4 (16, 20, 24, 28...).", "error");
    return;
  }

  let gCount = Math.floor(sug / 4);
  gCount = Math.max(2, Math.min(10, gCount)); // 8 a 40

  payload.groupsCount = String(gCount);
  payload.groupsQualify = "2"; // default: clasifican 2 por grupo
}


    const r = await torneoPOST(payload);
    if (!r.ok) return toast("⚠ " + (r.error || "Error"), "error");

    
// ✅ segundo guardado asegurado de reglas (con el torneoId nuevo)
const payload2 = {
  accion: "torneo_update_rules",
  user: CURRENT_USER,
  pin: ADMIN_PIN,
  torneoId: r.torneoId,
  bannedFastMoves,
  bannedChargedMoves,
  bannedPokemon,
  bannedTypes: document.getElementById("tBanTypes")?.value || "",
  bannedCategories: document.getElementById("tBanCategories")?.value || "",
  allowedPokemon: document.getElementById("tAllowedPokemon")?.value || "",

  // ✅ NUEVO
  allowedTypes: document.getElementById("tAllowTypes")?.value || "",
  allowedCategories: document.getElementById("tAllowCategories")?.value || "",
  prizesJson: document.getElementById("tPrizesJson")?.value || "[]",
  status: document.getElementById("tStatus")?.value || "active"
};

// ✅ MULTI-LIGA: guardar por liga y limpiar reglas globales
if(lrj && lrj.isMulti){
  payload2.leagueRulesJson = lrj.leagueRulesJson || "";

  payload2.bannedFastMoves = "";
  payload2.bannedChargedMoves = "";
  payload2.bannedPokemon = "";
  payload2.bannedTypes = "";
  payload2.bannedCategories = "";
  payload2.allowedPokemon = "";
  payload2.allowedTypes = "";
  payload2.allowedCategories = "";
}else{
  payload2.leagueRulesJson = "";
}

await torneoPOST(payload2);




    toast("✅ Torneo creado");

    // ✅ cierra modal y limpia para el próximo uso
    modalClose();
    clearTorneoForm();

    await torneoCargarLista({keepSelection:false});
    const select = document.getElementById("tSelect");
    if(select && r.torneoId){
      select.value = r.torneoId;
      SELECTED_TORNEO_ID = r.torneoId;
    }
    await torneoActualizar();
  });

  creandoTorneo = false;
};


// === EVENTOS DE BOTONES (Espera Libre / 30 Min / Generar) ===
const bToggleInsc = document.getElementById("btnTorneoToggleInscripciones");
const bCerrarMan = document.getElementById("btnCerrarManual");
const bIniciar30 = document.getElementById("btnIniciar30m");
const bForzarIni = document.getElementById("btnForceStart");
const bGenerarBr = document.getElementById("btnTorneoGenerarSingle");

if (bToggleInsc) bToggleInsc.onclick = async () => {
  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");
  // En la nueva lógica, este botón solo sirve para ABRIR
  await runWithBtn(bToggleInsc, "Abriendo…", async () => {
    const r = await torneoPOST({ accion: "torneo_open", user: CURRENT_USER, pin: ADMIN_PIN, torneoId });
    if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");
    toast("🟢 Inscripciones abiertas");
    
    // OPTIMIZACIÓN: Actualización local instantánea sin recargar todo el torneo
    updateToggleInscripcionesButton(true);
    if (LAST_TORNEO_CFG) LAST_TORNEO_CFG.inscriptionsOpen = "TRUE";
    
    // Actualizar badges visualmente si existen
    const boxBadges = document.getElementById("tStatusBadges");
    if (boxBadges && boxBadges.innerHTML.includes("Inscripciones cerradas")) {
       boxBadges.innerHTML = boxBadges.innerHTML.replace(
         '<span class="badge lock">Inscripciones cerradas</span>', 
         '<span class="badge ok">Inscripciones abiertas</span>'
       );
    }
    
    // Ajustar visibilidad de los botones de acciones rápidas
    if(bToggleInsc) bToggleInsc.style.display = "none"; 
    if(bCerrarMan) bCerrarMan.style.display = "inline-block";
    if(bIniciar30) bIniciar30.style.display = "none";
    if(bForzarIni) bForzarIni.style.display = "none";
    if(bGenerarBr) bGenerarBr.style.display = "none";
  });
};

if (bCerrarMan) bCerrarMan.onclick = async () => {
  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");
  if(!confirm("¿Cerrar inscripciones y dejar el torneo en ESPERA LIBRE?")) return;
  
  await runWithBtn(bCerrarMan, "Cerrando…", async () => {
    const r = await torneoPOST({ accion: "torneo_close", user: CURRENT_USER, pin: ADMIN_PIN, torneoId });
    if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");
    toast("✅ Inscripciones cerradas en modo manual");
    
    // OPTIMIZACIÓN: Actualización local instantánea sin recargar todo el torneo
    updateToggleInscripcionesButton(false);
    if (LAST_TORNEO_CFG) {
      LAST_TORNEO_CFG.inscriptionsOpen = "FALSE";
      LAST_TORNEO_CFG.prepEndsAt = "MANUAL";
    }
    
    // Actualizar badges visualmente si existen
    const boxBadges = document.getElementById("tStatusBadges");
    if (boxBadges && boxBadges.innerHTML.includes("Inscripciones abiertas")) {
       boxBadges.innerHTML = boxBadges.innerHTML.replace(
         '<span class="badge ok">Inscripciones abiertas</span>', 
         '<span class="badge lock">Inscripciones cerradas</span>'
       );
    }
    
    // Ajustar visibilidad de los botones de acciones rápidas
    const gen = LAST_TORNEO_CFG ? isTrue(LAST_TORNEO_CFG.generated) : false;
    if(bToggleInsc) bToggleInsc.style.display = gen ? "none" : "inline-block"; 
    if(bCerrarMan) bCerrarMan.style.display = "none";
    if(bIniciar30) bIniciar30.style.display = "inline-block";
    if(bForzarIni) bForzarIni.style.display = "inline-block";
    if(bGenerarBr) bGenerarBr.style.display = gen ? "none" : "inline-block";
  });
};

if (bIniciar30) bIniciar30.onclick = async () => {
  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");
  if(!confirm("¿Iniciar el cronómetro de 30 minutos para los jugadores?")) return;
  
  await runWithBtn(bIniciar30, "Iniciando…", async () => {
    const r = await torneoPOST({ accion: "torneo_start_prep", user: CURRENT_USER, pin: ADMIN_PIN, torneoId });
    if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");
    toast("⏳ Cronómetro de 30 minutos iniciado");
    await torneoActualizar();
  });
};

if (bForzarIni) bForzarIni.onclick = async () => {
  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");
  const ok = confirm("⚡ ¿Forzar INICIO AHORA?\n\nEsto pondrá la preparación en 0.\nÚsalo solo por fuerza mayor.");
  if(!ok) return;
  
  await runWithBtn(bForzarIni, "Forzando…", async () => {
    const r = await torneoPOST({ accion: "torneo_force_start", user: CURRENT_USER, pin: ADMIN_PIN, torneoId });
    if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");
    toast("✅ Preparación finalizada (inicio forzado)");
    await torneoCargarLista({keepSelection:true});
    await torneoActualizar();
  });
};

if (bGenerarBr) bGenerarBr.onclick = async () => {
  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");
  
  await runWithBtn(bGenerarBr, "Generando…", async () => {
    const r = await torneoPOST({ accion: "torneo_generate", user: CURRENT_USER, pin: ADMIN_PIN, torneoId });
    if(!r.ok) return toast("⚠ " + (r.error || "Error"), "error");
    toast(`🏆 Bracket generado (BYE: ${r.byes ?? "-"})`);
    await torneoCargarLista({keepSelection:true});
    await torneoActualizar();
  });
};

  // Tabs
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabs = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      tabs.forEach(t => t.style.display = "none");
      const id = btn.getAttribute("data-tab");
      const target = document.getElementById(id);
      if (target) target.style.display = "block";
    });
  });
});


/* =========================
   POKEMON JSON + AUTOCOMPLETE (BAN/ALLOWED) — VARIANTES (UICONS)
   - Guarda iconId: "25", "25_s", "25_a1", "25_b1", "25_b2", "25_e1"...
========================= */

const ICON_BASE = "https://raw.githubusercontent.com/nileplumb/PkmnShuffleMap/master/UICONS/pokemon/";
function iconUrl(iconId){ return `${ICON_BASE}${iconId}.png`; }

let POKEMON_LIST = [];
let POKEMON_BY_DEX = new Map();         // dex -> nombre base
let POKEMON_VARIANT_LIST = [];          // lista expandida
let POKEMON_VARIANT_BY_ID = new Map();  // iconId -> entry

// Mapas de selección: iconId -> entry
let selectedBans = new Map();
let selectedAllowed = new Map();

function pokemonName(p){
  const n = p?.name;
  if(!n) return "";
  if(typeof n === "string") return n;
  return (n.es_419 || n.es_ES || n.en || "").trim();
}

function pNormalizeText(s){
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const KIND_ORDER = { normal:0, shadow:1, purified:2, shiny:3, dynamax:4, gigamax:5, mega:6 };

function kindLabelFromIconId(iconId){
  const id = String(iconId || "");
  if(/_a1$/.test(id)) return " (Oscuro)";
  if(/_a2$/.test(id)) return " (Purificado)";
  if(/_s$/.test(id))  return " (Shiny)";
  if(/_b1$/.test(id)) return " (Dynamax)";
  if(/_b2$/.test(id)) return " (Gigamax)";
  const m = id.match(/_e(\d+)$/);
  if(m) return ` (Mega ${m[1]})`;
  return "";
}

function buildVariantEntries(p){
  const dex = String(p.dex);
  const baseName = pokemonName(p);
  const out = [];

  // En tu json nuevo, lo más común es tener:
  // p.uicons.recommended = { normal, shadow, purified, shiny, dynamax, gigamax, mega:[...] }
  const rec = p?.uicons?.recommended || {};

  const pushOne = (kind, iconId, megaIdx=null) => {
    if(!iconId) return;
    const label =
      kind === "normal" ? "Normal" :
      kind === "shadow" ? "Oscuro" :
      kind === "purified" ? "Purificado" :
      kind === "shiny" ? "Shiny" :
      kind === "dynamax" ? "Dynamax" :
      kind === "gigamax" ? "Gigamax" :
      kind === "mega" ? (megaIdx ? `Mega ${megaIdx}` : "Mega") :
      kind;

    const text = `#${dex} ${baseName} · ${label}`;
    const search = pNormalizeText(`${dex} ${baseName} ${label} ${kind}`);
    const e = { id:String(iconId), dex, baseName, kind, label, text, search };
    out.push(e);
  };

  // Normal (si no existe rec.normal, usamos dex)
  pushOne("normal", rec.normal || dex);

  pushOne("shadow", rec.shadow);
  pushOne("purified", rec.purified);
  pushOne("shiny", rec.shiny);
  pushOne("dynamax", rec.dynamax);
  pushOne("gigamax", rec.gigamax);

  const megaArr = Array.isArray(rec.mega) ? rec.mega : [];
  megaArr.forEach((mid, i) => pushOne("mega", mid, i+1));

  return out;
}

async function loadPokemonJson(){
  try{
    const r = await fetch(`pokemon.json?v=${Date.now()}`, { cache: "no-store" });
    if(!r.ok) throw new Error("No se pudo cargar pokemon.json");
    const data = await r.json();

    POKEMON_LIST = Array.isArray(data) ? data : [];
    POKEMON_BY_DEX = new Map(POKEMON_LIST.map(p => [String(p.dex), pokemonName(p)]));

    // construye lista expandida
    POKEMON_VARIANT_LIST = [];
    POKEMON_VARIANT_BY_ID = new Map();

    POKEMON_LIST.forEach(p => {
      const entries = buildVariantEntries(p);
      entries.forEach(e => {
        POKEMON_VARIANT_LIST.push(e);
        POKEMON_VARIANT_BY_ID.set(e.id, e);
      });
    });

    // orden bonito
    POKEMON_VARIANT_LIST.sort((a,b)=>{
      const da = Number(a.dex), db = Number(b.dex);
      if(da !== db) return da - db;
      return (KIND_ORDER[a.kind] ?? 99) - (KIND_ORDER[b.kind] ?? 99);
    });

  }catch(e){
    console.error(e);
    toast("⚠ No se pudo cargar pokemon.json", "error");
  }
}

function renderPokemonChips(map, chipsBoxId, hiddenId, clsExtra=""){
  const chipsBox = document.getElementById(chipsBoxId);
  const hidden = document.getElementById(hiddenId);
  if(!chipsBox || !hidden) return;

  chipsBox.innerHTML = "";

  const entries = Array.from(map.values()).sort((a,b)=>{
    const da = Number(a.dex), db = Number(b.dex);
    if(da !== db) return da - db;
    return (KIND_ORDER[a.kind] ?? 99) - (KIND_ORDER[b.kind] ?? 99);
  });

  entries.forEach(e => {
    const chip = document.createElement("div");
    chip.className = "poke-chip" + (clsExtra ? " " + clsExtra : "");

    chip.innerHTML = `
      <img src="${iconUrl(e.id)}" alt="" style="width:22px;height:22px;vertical-align:middle;margin-right:6px;border-radius:6px;">
      <span>${escapeHtml(e.text)} ✕</span>
    `;

    chip.onclick = () => {
      map.delete(e.id);
      renderPokemonChips(map, chipsBoxId, hiddenId, clsExtra);
    };

    chipsBox.appendChild(chip);
  });

  // ✅ guarda iconIds tal cual
  hidden.value = entries.map(e => e.id).join(",");
}

function setFromValue(map, raw){
  map.clear();

  const ids = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim())
    .filter(Boolean);

  ids.forEach(idRaw => {
    const id = String(idRaw);

    // si existe exacto en el json
    const e = POKEMON_VARIANT_BY_ID.get(id);
    if(e){
      map.set(e.id, e);
      return;
    }

    // fallback: si viene "25" o "25_s" aunque no esté en recommended
    const dex = id.split("_")[0];
    if(/^\d+$/.test(dex)){
      const baseName = POKEMON_BY_DEX.get(dex) || `Dex ${dex}`;
      const kind =
        /_a1$/.test(id) ? "shadow" :
        /_a2$/.test(id) ? "purified" :
        /_s$/.test(id) ? "shiny" :
        /_b1$/.test(id) ? "dynamax" :
        /_b2$/.test(id) ? "gigamax" :
        /_e\d+$/.test(id) ? "mega" : "normal";

      const label =
        kind === "normal" ? "Normal" :
        kind === "shadow" ? "Oscuro" :
        kind === "purified" ? "Purificado" :
        kind === "shiny" ? "Shiny" :
        kind === "dynamax" ? "Dynamax" :
        kind === "gigamax" ? "Gigamax" :
        kind === "mega" ? "Mega" : kind;

      const text = `#${dex} ${baseName} · ${label}`;
      const search = pNormalizeText(`${dex} ${baseName} ${label} ${kind}`);
      map.set(id, { id, dex, baseName, kind, label, text, search });
    }
  });
}

function bindPokemonAutocomplete(map, inputId, dropId, chipsBoxId, hiddenId, chipExtraClass=""){
  const input = document.getElementById(inputId);
  const drop  = document.getElementById(dropId);
  const hidden = document.getElementById(hiddenId);
  if(!input || !drop || !hidden) return;

  input.addEventListener("input", () => {
    const q = pNormalizeText(input.value.trim());
    drop.innerHTML = "";

    if(!q){
      drop.style.display = "none";
      return;
    }

    const matches = POKEMON_VARIANT_LIST
      .filter(e => e.search.includes(q))
      .slice(0, 30);

    if(matches.length === 0){
      drop.style.display = "none";
      return;
    }

    matches.forEach(e => {
      if(map.has(e.id)) return;

      const div = document.createElement("div");
      div.className = "poke-item";
      div.innerHTML = `
        <img src="${iconUrl(e.id)}" alt="" style="width:26px;height:26px;margin-right:8px;border-radius:8px;">
        <span>${escapeHtml(e.text)}</span>
      `;

      div.onclick = () => {
        map.set(e.id, e);
        renderPokemonChips(map, chipsBoxId, hiddenId, chipExtraClass);
        input.value = "";
        drop.style.display = "none";
      };

      drop.appendChild(div);
    });

    drop.style.display = "block";
  });

  document.addEventListener("click", (e) => {
    if(!drop.contains(e.target) && e.target !== input){
      drop.style.display = "none";
    }
  });

  // pinta desde hidden si ya había guardado
  setFromValue(map, hidden.value);
  renderPokemonChips(map, chipsBoxId, hiddenId, chipExtraClass);
}

// ===== wrappers con los mismos nombres que tu código ya llama =====
function renderBanChips(){
  renderPokemonChips(selectedBans, "tBanPokemonChips", "tBanPokemon", "ban");
}
function bindPokemonBanAutocomplete(){
  bindPokemonAutocomplete(
    selectedBans,
    "tBanPokemonSearch",
    "tBanPokemonDrop",
    "tBanPokemonChips",
    "tBanPokemon",
    "ban"
  );
}


function renderAllowedChips(){
  renderPokemonChips(selectedAllowed, "tAllowedPokemonChips", "tAllowedPokemon", "allow");
}
function setAllowedFromValue(raw){
  setFromValue(selectedAllowed, raw);
  renderAllowedChips();
}

function setBansFromValue(raw){
  setFromValue(selectedBans, raw);
  renderBanChips();
}

function bindAllowedPokemonAutocomplete(){
  bindPokemonAutocomplete(
    selectedAllowed,
    "tAllowedPokemonSearch",
    "tAllowedPokemonDrop",
    "tAllowedPokemonChips",
    "tAllowedPokemon",
    "allow"
  );
}


/* =========================
   TIPOS + CATEGORÍAS (chips)
========================= */
const ALL_TYPES = [
  "normal","fire","water","electric","grass","ice","fighting","poison","ground","flying",
  "psychic","bug","rock","ghost","dragon","dark","steel","fairy"
];

const ALL_CATEGORIES = [
  // categorías “clásicas”
  "legendary","mythical","baby","normal",

  // ✅ nuevas categorías (formas/variantes)
  "shadow",
  "purified",
  "shiny",
  "dynamax",
  "gigamax",
  "mega"
];



// ✅ Etiquetas en español para chips
const TYPE_LABEL_ES_419 = {
  normal:"Normal", fire:"Fuego", water:"Agua", electric:"Eléctrico", grass:"Planta", ice:"Hielo",
  fighting:"Lucha", poison:"Veneno", ground:"Tierra", flying:"Volador", psychic:"Psíquico", bug:"Bicho",
  rock:"Roca", ghost:"Fantasma", dragon:"Dragón", dark:"Siniestro", steel:"Acero", fairy:"Hada"
};

const CATEGORY_LABEL_ES_419 = {
  legendary:"Legendario",
  mythical:"Mítico",
  baby:"Bebé",
  normal:"Normal",

  // ✅ nuevas etiquetas
  shadow:"Oscuro",
  purified:"Purificado",
  shiny:"Shiny",
  dynamax:"Dynamax",
  gigamax:"Gigamax",
  mega:"Mega"
};


function typeLabel(key){ return TYPE_LABEL_ES_419[key] || key; }
function categoryLabel(key){ return CATEGORY_LABEL_ES_419[key] || key; }


let selectedTypes = new Set();
let selectedCategories = new Set();
let selectedAllowTypes = new Set();
let selectedAllowCategories = new Set();


function setChipGroup(containerId, hiddenId, items, selectedSet, labelFn){
  const box = document.getElementById(containerId);
  const hidden = document.getElementById(hiddenId);
  if(!box || !hidden) return;

  box.innerHTML = "";

  items.forEach(key => {
    const chip = document.createElement("div");
    chip.className = "mini-chip" + (selectedSet.has(key) ? " active" : "");
    chip.textContent = (typeof labelFn === "function") ? labelFn(key) : key;

    chip.onclick = () => {
      if(selectedSet.has(key)) selectedSet.delete(key);
      else selectedSet.add(key);
      // re-render
      setChipGroup(containerId, hiddenId, items, selectedSet, labelFn);
    };

    box.appendChild(chip);
  });

  hidden.value = Array.from(selectedSet.values()).join(", ");
}

function setSelectedFromHidden(hiddenId, selectedSet){
  const hidden = document.getElementById(hiddenId);
  if(!hidden) return;
  selectedSet.clear();

  const parts = String(hidden.value || "")
    .split(/[,\n]+/g)
    .map(s=>s.trim().toLowerCase())
    .filter(Boolean);

  parts.forEach(p => selectedSet.add(p));
}

function bindTypeCategoryChips(){
  // bans
  setSelectedFromHidden("tBanTypes", selectedTypes);
  setSelectedFromHidden("tBanCategories", selectedCategories);

  // allows (nuevos)
  setSelectedFromHidden("tAllowTypes", selectedAllowTypes);
  setSelectedFromHidden("tAllowCategories", selectedAllowCategories);

  // render
  setChipGroup("tBanTypesChips", "tBanTypes", ALL_TYPES, selectedTypes, typeLabel);
  setChipGroup("tAllowTypesChips", "tAllowTypes", ALL_TYPES, selectedAllowTypes, typeLabel);

  setChipGroup("tAllowCategoriesChips", "tAllowCategories", ALL_CATEGORIES, selectedAllowCategories, categoryLabel);
  setChipGroup("tBanCategoriesChips", "tBanCategories", ALL_CATEGORIES, selectedCategories, categoryLabel);
}


/* =========================
   LIGA PLAN (chips multi) + TIEBREAK (chips single)
   - Guarda en hidden #tLeaguePlan como:
     super1500
     super1500+ultra2500|tiebreak:mini500
     super1500+ultra2500+master|tiebreak:super1500
========================= */

const LEAGUE_ITEMS = [
  { key:"mini500",    label:"Liga 500" },
  { key:"super1500",  label:"Liga 1500" },
  { key:"ultra2500",  label:"Liga 2500" },
  { key:"master",     label:"Liga Master" }
];

// ✅ Tiebreak puede ser una liga o "sin desempate"
const TIE_NONE_KEY = "none";
const TIE_ITEMS = [
  ...LEAGUE_ITEMS,
  { key: TIE_NONE_KEY, label: "Sin desempate" }
];

function isValidTieKey(k){
  return k === TIE_NONE_KEY || isValidLeagueKey(k);
}


// orden “bonito” para construir el string (como tus ejemplos)
const LEAGUE_ORDER = ["super1500","ultra2500","master","mini500"];

function isValidLeagueKey(k){
  return LEAGUE_ITEMS.some(x => x.key === k);
}
function leagueSort(arr){
  return arr.slice().sort((a,b) => (LEAGUE_ORDER.indexOf(a) - LEAGUE_ORDER.indexOf(b)));
}
function normLeague(s){
  return String(s||"").trim().toLowerCase();
}

// estado UI
let LP_MAIN = new Set();     // ligas principales (multi)
let LP_TIE  = "mini500";     // desempate (single)

function parseLeaguePlanValue(raw){
  const v = String(raw || "").trim();

  let mainPart = v;
  let tie = null; // lo decidimos según el caso

  if(v.includes("|")){
    const parts = v.split("|").map(x => x.trim()).filter(Boolean);
    mainPart = parts[0] || "";

    const tb = parts.find(p => /^tiebreak:/i.test(p));
  if(tb){
  const k = normLeague((tb.split(":")[1] || ""));
  if(isValidTieKey(k)) tie = k;
}
  }

  const mains = mainPart
    .split("+")
    .map(normLeague)
    .filter(isValidLeagueKey);

  if(mains.length === 0) mains.push("super1500");

  // ✅ default inteligente:
  // - si hay 1 liga: desempate = esa misma (para guardar limpio sin suffix)
  // - si hay 2+ ligas: default mini500
if(!tie || !isValidTieKey(tie)){
  tie = (mains.length === 1) ? mains[0] : "mini500";
}


  return { mains: new Set(mains), tie };
}


function buildLeaguePlanValue(mainsSet, tie){
  let mains = leagueSort(Array.from(mainsSet || []));
  if(mains.length === 0) mains = ["super1500"];

  const main = mains[0];

  // ✅ 1 liga:
  // - si el desempate es distinto, guardamos "super1500|tiebreak:mini500"
  // - si es igual, guardamos "super1500"
  if(mains.length === 1){
   // ✅ si el usuario dejó "sin desempate" en algún momento, en 1 liga guardamos limpio
const tb = (tie === TIE_NONE_KEY) ? main : (isValidLeagueKey(tie) ? tie : main);
if(tb && tb !== main) return `${main}|tiebreak:${tb}`;
return main;

  }

// ✅ 2+ ligas: tiebreak puede ser una liga o "none"
if(tie === TIE_NONE_KEY){
  return `${mains.join("+")}|tiebreak:${TIE_NONE_KEY}`;
}
const tb = isValidLeagueKey(tie) ? tie : "mini500";
return `${mains.join("+")}|tiebreak:${tb}`;

}

function syncLeaguePlanHidden(){
  const hidden = document.getElementById("tLeaguePlan");
  if(!hidden) return;

  hidden.value = buildLeaguePlanValue(LP_MAIN, LP_TIE);

  // preview (opcional)
  const prev = document.getElementById("tLeaguePlanPreview");
  if(prev) prev.textContent = `Se guardará como: ${hidden.value}`;

    // ✅ Multi-liga: mostrar/ocultar editor y sincronizar store
  if(typeof lrjOnLeaguePlanChanged_ === "function"){
    lrjOnLeaguePlanChanged_();
  }


}

function renderLeagueMainChips(){
  const box = document.getElementById("tLeagueMainChips");
  if(!box) return;

  box.innerHTML = "";
  LEAGUE_ITEMS.forEach(item => {
    const chip = document.createElement("div");
    chip.className = "mini-chip" + (LP_MAIN.has(item.key) ? " active" : "");
    chip.textContent = item.label;

    chip.onclick = () => {
      // toggle, pero NO permitir dejarlo vacío
      if(LP_MAIN.has(item.key)){
        if(LP_MAIN.size === 1) return; // no dejes 0 ligas
        LP_MAIN.delete(item.key);
      }else{
        LP_MAIN.add(item.key);
      }

      // ✅ si quedamos con 1 liga y tiebreak estaba en "none", lo normalizamos a la liga
if(LP_MAIN.size === 1 && LP_TIE === TIE_NONE_KEY){
  LP_TIE = Array.from(LP_MAIN)[0];
}


      renderLeagueMainChips();
      renderLeagueTieChips();
      syncLeaguePlanHidden();
    };

    box.appendChild(chip);
  });
}

function renderLeagueTieChips(){
  const box = document.getElementById("tLeagueTiebreakChips");
  if(!box) return;

  box.innerHTML = "";
  TIE_ITEMS.forEach(item => {
    const chip = document.createElement("div");
    chip.className = "mini-chip" + (LP_TIE === item.key ? " active" : "");
    chip.textContent = item.label;

    chip.onclick = () => {
      LP_TIE = item.key;
      renderLeagueTieChips();
      syncLeaguePlanHidden();
    };

    box.appendChild(chip);
  });

}

function renderLeaguePlanUI(){
  renderLeagueMainChips();
  renderLeagueTieChips();
  syncLeaguePlanHidden();
}

// ✅ para setear desde un value (crear/editar)
function setLeaguePlanFromValue(raw){
  const p = parseLeaguePlanValue(raw);
  LP_MAIN = p.mains;
  LP_TIE  = p.tie;
  renderLeaguePlanUI();
}

// ✅ init al cargar
function bindLeaguePlanUI(){
  const hidden = document.getElementById("tLeaguePlan");
  const mainBox = document.getElementById("tLeagueMainChips");
  const tieBox  = document.getElementById("tLeagueTiebreakChips");

  if(!hidden || !mainBox || !tieBox) return;

  setLeaguePlanFromValue(hidden.value || "super1500");
}


/* =========================
   MULTI-LIGA: leagueRulesJson (v1)
   - helpers para guardar reglas por liga reutilizando la UI actual
   - (en este paso NO activamos UI ni tocamos botones de guardar)
========================= */



const LRJ_VERSION = 1;

// Estado en memoria
let LRJ_STORE = null;          // {version, mode:"perLeague", leagues:{...}}
let LRJ_ACTIVE_LEAGUE = "";    // key de liga editándose (super1500, ultra2500, ...)
let LRJ_ENABLED = false;       // se activará cuando detectemos 2+ ligas (pasos siguientes)

function lrjEmptyRules_(){
  return {
    allowedTypes: [],
    allowedCategories: [],
    bannedTypes: [],
    bannedCategories: [],
    allowedPokemon: [],
    bannedPokemon: [],
    bannedFastMoves: [],
    bannedChargedMoves: []
  };
}

function lrj_normArr_(v, lower){
  const a = Array.isArray(v)
    ? v
    : (typeof v === "string" ? v.split(/[,\n]+/g) : []);
  const out = a.map(x => String(x).trim()).filter(Boolean);
  return lower ? out.map(x => x.toLowerCase()) : out;
}

function lrjNormalizeRuleSet_(r){
  const o = (r && typeof r === "object") ? r : {};
  return {
    allowedTypes: lrj_normArr_(o.allowedTypes, true),
    allowedCategories: lrj_normArr_(o.allowedCategories, true),
    bannedTypes: lrj_normArr_(o.bannedTypes, true),
    bannedCategories: lrj_normArr_(o.bannedCategories, true),
    allowedPokemon: lrj_normArr_(o.allowedPokemon, false),
    bannedPokemon: lrj_normArr_(o.bannedPokemon, false),
    bannedFastMoves: lrj_normArr_(o.bannedFastMoves, false),
    bannedChargedMoves: lrj_normArr_(o.bannedChargedMoves, false)
  };
}

function lrjInitStore_(){
  if(LRJ_STORE && LRJ_STORE.mode === "perLeague") return;
  LRJ_STORE = { version: LRJ_VERSION, mode: "perLeague", leagues: {} };
}

function lrjSafeParse_(s){
  try { return JSON.parse(String(s || "")); }
  catch(_) { return null; }
}

// Carga store desde string JSON (ej. lo que viene de la hoja)
function lrjLoadFromString_(jsonStr){
  const obj = lrjSafeParse_(jsonStr);
  if(!obj || obj.mode !== "perLeague" || !obj.leagues || typeof obj.leagues !== "object"){
    return false;
  }
  LRJ_STORE = { version: Number(obj.version || LRJ_VERSION), mode: "perLeague", leagues: {} };
  Object.keys(obj.leagues).forEach(k => {
    LRJ_STORE.leagues[k] = lrjNormalizeRuleSet_(obj.leagues[k]);
  });
  return true;
}

// Convierte store a string JSON para guardar en la hoja
function lrjToString_(){
  lrjInitStore_();
  return JSON.stringify({
    version: LRJ_VERSION,
    mode: "perLeague",
    leagues: LRJ_STORE.leagues
  });
}

// Detecta ligas principales desde tLeaguePlan (usa tu parseLeaguePlanValue)
function lrjLeagueKeysFromLeaguePlan_(){
  const hidden = document.getElementById("tLeaguePlan");
  const raw = hidden ? hidden.value : "super1500";
  const p = parseLeaguePlanValue(raw);

  const mains = Array.from(p.mains);
  const keys = mains.slice();

  // ✅ si es multi-liga y hay desempate (no "none"), lo sumamos para editar reglas también
  if(mains.length >= 2 && p.tie && p.tie !== TIE_NONE_KEY && keys.indexOf(p.tie) === -1){
    keys.push(p.tie);
  }

  return keys;
}


function lrjIsMultiByLeaguePlan_(){
  const hidden = document.getElementById("tLeaguePlan");
  const raw = hidden ? hidden.value : "super1500";
  const p = parseLeaguePlanValue(raw);
  return Array.from(p.mains).length >= 2;
}


// Lee reglas desde la UI (hidden inputs actuales)
function lrjReadRulesFromUI_(){
  const read = (id, lower) => {
    const el = document.getElementById(id);
    const s = el ? el.value : "";
    return lrj_normArr_(s, lower);
  };

  return {
    allowedTypes: read("tAllowTypes", true),
    allowedCategories: read("tAllowCategories", true),
    bannedTypes: read("tBanTypes", true),
    bannedCategories: read("tBanCategories", true),
    allowedPokemon: read("tAllowedPokemon", false),
    bannedPokemon: read("tBanPokemon", false),
    bannedFastMoves: read("tBanFast", false),
    bannedChargedMoves: read("tBanCharged", false)
  };
}

// Escribe reglas a la UI y repinta chips/autocomplete existentes
function lrjWriteRulesToUI_(rules){
  const r = lrjNormalizeRuleSet_(rules);

  const write = (id, arr) => {
    const el = document.getElementById(id);
    if(el) el.value = (arr || []).join(", ");
  };

  write("tAllowTypes", r.allowedTypes);
  write("tAllowCategories", r.allowedCategories);
  write("tBanTypes", r.bannedTypes);
  write("tBanCategories", r.bannedCategories);

  write("tAllowedPokemon", r.allowedPokemon);
  write("tBanPokemon", r.bannedPokemon);

  write("tBanFast", r.bannedFastMoves);
  write("tBanCharged", r.bannedChargedMoves);

  // Re-pinta UI si tus funciones existen (están más abajo en el archivo)
  if(typeof bindTypeCategoryChips === "function") bindTypeCategoryChips();
  if(typeof setAllowedFromValue === "function") setAllowedFromValue(document.getElementById("tAllowedPokemon")?.value || "");
  if(typeof setBansFromValue === "function") setBansFromValue(document.getElementById("tBanPokemon")?.value || "");
  if(typeof setMovesFromValue === "function"){
    setMovesFromValue("fast", document.getElementById("tBanFast")?.value || "");
    setMovesFromValue("charged", document.getElementById("tBanCharged")?.value || "");
  }
}

// Guarda lo que está en UI dentro del store para la liga indicada
function lrjSaveUIIntoStore_(leagueKey){
  if(!leagueKey) return;
  lrjInitStore_();
  LRJ_STORE.leagues[leagueKey] = lrjReadRulesFromUI_();
}

// Carga al UI las reglas de una liga (crea vacío si no existe)
function lrjLoadLeagueIntoUI_(leagueKey){
  lrjInitStore_();
  const current = LRJ_STORE.leagues[leagueKey] || lrjEmptyRules_();
  LRJ_STORE.leagues[leagueKey] = lrjNormalizeRuleSet_(current);
  lrjWriteRulesToUI_(LRJ_STORE.leagues[leagueKey]);
}

/* =========================
   MULTI-LIGA UI (Panel)
   - muestra/oculta barra #leagueRulesBar
   - dropdown de liga activa + copiar reglas
   - guarda cambios al cambiar de liga
========================= */

function lrjLeagueLabel_(k){
  const it = (typeof LEAGUE_ITEMS !== "undefined") ? LEAGUE_ITEMS.find(x => x.key === k) : null;
  return it ? it.label : k;
}
function lrjGet_(id){ return document.getElementById(id); }

function lrjShowEditorBar_(show){
  const bar = lrjGet_("leagueRulesBar");
  if(!bar) return; // si aún no pegaste el HTML, no rompe
  bar.style.display = show ? "" : "none";
}

function lrjFillSelect_(sel, keys, prefer){
  if(!sel) return;
  const prev = String(prefer || sel.value || "");
  sel.innerHTML = "";
  keys.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = lrjLeagueLabel_(k);
    sel.appendChild(opt);
  });
  const pick = keys.includes(prev) ? prev : (keys[0] || "");
  if(pick) sel.value = pick;
}

function lrjRefreshCopyFrom_(){
  const keys = lrjLeagueKeysFromLeaguePlan_();
  const sel = lrjGet_("lrCopyFromSelect");
  const btn = lrjGet_("lrCopyBtn");
  if(!sel) return;

  const active = String(LRJ_ACTIVE_LEAGUE || "");
  const fromKeys = keys.filter(k => k && k !== active);

  const prev = String(sel.value || "");
  sel.innerHTML = "";

  fromKeys.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = lrjLeagueLabel_(k);
    sel.appendChild(opt);
  });

  if(btn) btn.disabled = (fromKeys.length === 0);
  if(fromKeys.length > 0){
    sel.value = fromKeys.includes(prev) ? prev : fromKeys[0];
  }
}

function lrjSyncJsonHidden_(){
  const hid = lrjGet_("tLeagueRulesJson");
  if(!hid) return; // si aún no pegaste el HTML, no rompe

  if(!LRJ_ENABLED){
    hid.value = "";
    return;
  }

  lrjInitStore_();
  const keys = lrjLeagueKeysFromLeaguePlan_();

  // ✅ guardamos solo ligas MAIN actuales (evita “basura” en JSON)
  const leaguesOut = {};
  keys.forEach(k => {
    leaguesOut[k] = lrjNormalizeRuleSet_(LRJ_STORE.leagues[k] || lrjEmptyRules_());
  });

  hid.value = JSON.stringify({
    version: LRJ_VERSION,
    mode: "perLeague",
    leagues: leaguesOut
  });
}

function lrjSetActiveLeague_(leagueKey){
  leagueKey = String(leagueKey || "");
  if(!leagueKey) return;

  // guarda lo que estabas editando
  if(LRJ_ACTIVE_LEAGUE && LRJ_ACTIVE_LEAGUE !== leagueKey){
    lrjSaveUIIntoStore_(LRJ_ACTIVE_LEAGUE);
  }

  LRJ_ACTIVE_LEAGUE = leagueKey;

  // carga reglas de esta liga a la UI
  lrjLoadLeagueIntoUI_(LRJ_ACTIVE_LEAGUE);

  // refleja en dropdowns
  const sel = lrjGet_("lrLeagueSelect");
  if(sel) sel.value = LRJ_ACTIVE_LEAGUE;

  lrjRefreshCopyFrom_();
  lrjSyncJsonHidden_();
}



function lrjBindLeagueRulesUI_(){
  const bar = lrjGet_("leagueRulesBar");
  const sel = lrjGet_("lrLeagueSelect");
  const copySel = lrjGet_("lrCopyFromSelect");
  const copyBtn = lrjGet_("lrCopyBtn");

  if(!bar || !sel) return;       // si no existe el HTML, no hacemos bind
  if(lrjBindLeagueRulesUI_._bound) return;
  lrjBindLeagueRulesUI_._bound = true;

  sel.addEventListener("change", () => {
    if(!LRJ_ENABLED) return;
    const next = String(sel.value || "");
    if(!next || next === LRJ_ACTIVE_LEAGUE) return;
    lrjSetActiveLeague_(next);
  });

  if(copyBtn){
    copyBtn.addEventListener("click", () => {
      if(!LRJ_ENABLED) return;
      const from = String(copySel?.value || "");
      const to = String(LRJ_ACTIVE_LEAGUE || "");
      if(!from || !to || from === to) return;

      lrjInitStore_();
      LRJ_STORE.leagues[to] = lrjNormalizeRuleSet_(LRJ_STORE.leagues[from] || lrjEmptyRules_());
      lrjLoadLeagueIntoUI_(to);
      lrjSyncJsonHidden_();
      lrjRefreshCopyFrom_();
      if(typeof toast === "function") toast("✅ Reglas copiadas a " + lrjLeagueLabel_(to), "ok");
    });
  }
}

function lrjOnLeaguePlanChanged_(){
  const isMulti = lrjIsMultiByLeaguePlan_();

  if(!isMulti){
    LRJ_ENABLED = false;
    LRJ_ACTIVE_LEAGUE = "";
    lrjShowEditorBar_(false);
    lrjSyncJsonHidden_(); // limpia hidden
    return;
  }

  // ✅ multi-liga ON
  LRJ_ENABLED = true;
  lrjInitStore_();

  const keys = lrjLeagueKeysFromLeaguePlan_();

  // asegura reglas por cada liga seleccionada
  keys.forEach(k => {
    if(!LRJ_STORE.leagues[k]) LRJ_STORE.leagues[k] = lrjEmptyRules_();
  });

  // si no hay nada aún, “semilla” la primera liga con lo que ya estaba en UI
  const first = keys[0] || "";
  if(first){
    const hasAny = Object.values(LRJ_STORE.leagues).some(r => {
      const rr = lrjNormalizeRuleSet_(r);
      return Object.values(rr).some(arr => Array.isArray(arr) && arr.length > 0);
    });
    if(!hasAny){
      LRJ_STORE.leagues[first] = lrjReadRulesFromUI_();
    }
  }

  lrjShowEditorBar_(true);
  lrjBindLeagueRulesUI_();

  // llena selector y activa liga
  const sel = lrjGet_("lrLeagueSelect");
  if(sel) lrjFillSelect_(sel, keys, sel.value || LRJ_ACTIVE_LEAGUE);

  const desired = (sel && sel.value) ? sel.value :
    (LRJ_ACTIVE_LEAGUE && keys.includes(LRJ_ACTIVE_LEAGUE) ? LRJ_ACTIVE_LEAGUE : (keys[0] || ""));

  if(desired) lrjSetActiveLeague_(desired);

  lrjSyncJsonHidden_();
  lrjRefreshCopyFrom_();
}

// ✅ Antes de guardar/crear: asegura que lo editado en la liga actual se guarde al store y al hidden JSON
function lrjPrepareForSubmit_(){
  const isMulti = (typeof LRJ_ENABLED !== "undefined" && LRJ_ENABLED === true);

  if(!isMulti){
    // Caso A: 1 liga -> no usamos JSON
    return { isMulti:false, leagueRulesJson:"" };
  }

  // guarda lo que el usuario estaba editando en la liga seleccionada
  if(typeof lrjSaveUIIntoStore_ === "function" && LRJ_ACTIVE_LEAGUE){
    lrjSaveUIIntoStore_(LRJ_ACTIVE_LEAGUE);
  }

  // sincroniza el hidden #tLeagueRulesJson con el store
  if(typeof lrjSyncJsonHidden_ === "function"){
    lrjSyncJsonHidden_();
  }

  const hid = document.getElementById("tLeagueRulesJson");
  const s = hid ? String(hid.value || "") : "";

  return { isMulti:true, leagueRulesJson:s };
}


/* =========================
   MOVES JSON + AUTOCOMPLETE (BAN LIST)
   - Busca por en, es_ES, es_419
   - Guarda SOLO IDs en hidden
========================= */

let MOVES_FAST = [];     // [{id,en,es_ES,es_419,type}]
let MOVES_CHARGED = [];  // [{id,en,es_ES,es_419,type}]
let MOVE_BY_ID = new Map(); // id -> move

let selectedFast = new Map();    // id -> move
let selectedCharged = new Map(); // id -> move

// Si tu web/panel es LATAM, usa esto para mostrar
const UI_LANG = "es_419"; // "es_419" | "es_ES" | "en"

function moveLabel(m){
  if(!m) return "";
  return (m[UI_LANG] || m.es_419 || m.es_ES || m.en || "").trim();
}

async function loadMovesJson(){
  try{
    // ✅ soporta ambos nombres por si tu archivo está con o sin .json
    const candidates = [
      "moves.i18n.latam.withId.json",
      "moves.i18n.latam.withId"
    ];

    let r = null;
    for (const url of candidates){
      try{
        const resp = await fetch(url, { cache: "no-store" });
        if(resp.ok){ r = resp; break; }
      }catch(_){}
    }
    if(!r) throw new Error("No se pudo cargar moves JSON");

    const data = await r.json();

    MOVES_FAST = Array.isArray(data.fast) ? data.fast : [];
    MOVES_CHARGED = Array.isArray(data.charged) ? data.charged : [];

    MOVE_BY_ID = new Map();
    [...MOVES_FAST, ...MOVES_CHARGED].forEach(m => {
      if(m?.id) MOVE_BY_ID.set(String(m.id), m);
    });

  }catch(e){
    console.error(e);
    toast("⚠ No se pudo cargar moves JSON (revisa ruta/archivo)", "error");
  }
}

function normalizeText(s){
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes
}

function renderMoveChips(kind){
  const isFast = kind === "fast";
  const box = document.getElementById(isFast ? "tBanFastChips" : "tBanChargedChips");
  const hidden = document.getElementById(isFast ? "tBanFast" : "tBanCharged");
  const map = isFast ? selectedFast : selectedCharged;

  if(!box || !hidden) return;

  box.innerHTML = "";

  const entries = Array.from(map.entries()).sort((a,b)=> a[0].localeCompare(b[0]));

  entries.forEach(([id, m]) => {
    const chip = document.createElement("div");
    chip.className = "poke-chip";

    const name = moveLabel(m) || m.en || id;
    const type = (m.type || "").toUpperCase();
    chip.textContent = `${name}${type ? " · " + type : ""} ✕`;

    chip.onclick = () => {
      map.delete(id);
      renderMoveChips(kind);
    };

    box.appendChild(chip);
  });

  // ✅ guarda SOLO IDs separados por coma
  hidden.value = entries.map(([id]) => id).join(",");
}

function setMovesFromValue(kind, raw){
  const isFast = kind === "fast";
  const map = isFast ? selectedFast : selectedCharged;

  map.clear();

  const ids = String(raw || "")
    .split(/[,\n]+/g)
    .map(x => x.trim())
    .filter(Boolean);

  ids.forEach(id => {
    const m = MOVE_BY_ID.get(id);
    if(m) map.set(id, m);
  });

  renderMoveChips(kind);
}

function bindMovesAutocomplete(kind){
  const isFast = kind === "fast";

  const input = document.getElementById(isFast ? "tBanFastSearch" : "tBanChargedSearch");
  const drop = document.getElementById(isFast ? "tBanFastDrop" : "tBanChargedDrop");
  const hidden = document.getElementById(isFast ? "tBanFast" : "tBanCharged");
  const map = isFast ? selectedFast : selectedCharged;

  const list = isFast ? MOVES_FAST : MOVES_CHARGED;

  if(!input || !drop || !hidden) return;

  input.addEventListener("input", () => {
    const q = normalizeText(input.value.trim());
    drop.innerHTML = "";

    if(!q){
      drop.style.display = "none";
      return;
    }

   const matches = list
  .filter(m => {
    const es = normalizeText(m.es_419 || "");
    const en = normalizeText(m.en || "");
    return es.includes(q) || en.includes(q);
  })
  .slice(0, 25);


    if(matches.length === 0){
      drop.style.display = "none";
      return;
    }

    matches.forEach(m => {
      const id = String(m.id);
      if(map.has(id)) return;

      const div = document.createElement("div");
      div.className = "poke-item";

      // mostramos: nombre UI + (EN pequeño)
      const main = escapeHtml(moveLabel(m) || m.es_419 || "");
div.innerHTML = `<span>${main}</span>`;

      div.onclick = () => {
        map.set(id, m);
        renderMoveChips(kind);
        input.value = "";
        drop.style.display = "none";
      };

      drop.appendChild(div);
    });

    drop.style.display = "block";
  });

  // cerrar dropdown click afuera
  document.addEventListener("click", (e) => {
    if(!drop.contains(e.target) && e.target !== input){
      drop.style.display = "none";
    }
  });

  // pinta desde hidden si ya había guardado
  setMovesFromValue(kind, hidden.value);
}


let TORNEO_MODAL_MODE = "create"; // "create" | "edit"

// ✅ Cache del config para abrir editar rápido
let LAST_TORNEO_CFG = null;
let LAST_TORNEO_ID  = "";

function setModalLoading(isLoading){
  const sub = document.getElementById("torneoModalSub");
  const btnSave = document.getElementById("btnTorneoGuardarCambios");
  if(sub){
    sub.textContent = isLoading ? "Cargando datos del torneo…" : "Actualiza datos del torneo seleccionado";
  }
  if(btnSave){
    btnSave.disabled = !!isLoading;
  }
}

// ======================================================
// ✅ PRESENCIAL (MODAL): UI + LECTURA DE CONFIG
// ======================================================
function syncVenueUI_(){
  const mode = document.getElementById("tMode")?.value || "";
  const isPres = String(mode).trim().toLowerCase() === "presencial";

  const card = document.getElementById("tVenueCard");
  if(card) card.style.display = isPres ? "" : "none";

  const chk = document.getElementById("tHasMainStage");
  const adv = document.getElementById("tMainStageAdv");
  if(adv) adv.style.display = (isPres && chk && chk.checked) ? "" : "none";
}

function readVenueCfg_(){
  const mode = document.getElementById("tMode")?.value || "";
  const isPres = String(mode).trim().toLowerCase() === "presencial";

  if(!isPres){
    return { tablesCount:"", hasMainStage:"FALSE", mainStageFrom:"", mainStageRandomPct:"" };
  }

  return {
    tablesCount: document.getElementById("tTablesCount")?.value?.trim() || "",
    hasMainStage: document.getElementById("tHasMainStage")?.checked ? "TRUE" : "FALSE",
    mainStageFrom: document.getElementById("tMainStageFrom")?.value || "semis",
    mainStageRandomPct: document.getElementById("tMainStageRandomPct")?.value?.trim() || "100"
  };
}

// listeners (se atan 1 sola vez)
document.addEventListener("DOMContentLoaded", () => {
  const modeEl = document.getElementById("tMode");
  const chkEl  = document.getElementById("tHasMainStage");

  if(modeEl) modeEl.addEventListener("change", syncVenueUI_);
  if(chkEl)  chkEl.addEventListener("change", syncVenueUI_);

  syncVenueUI_();
});


function clearTorneoForm(){
  // campos principales
  const tTitle = document.getElementById("tTitle");
  const tDateTime = document.getElementById("tDateTime");
  const tFormat = document.getElementById("tFormat");
  const tLeaguePlan = document.getElementById("tLeaguePlan");
  const tMode = document.getElementById("tMode");
  const tBestOf = document.getElementById("tBestOf");
  const tSuggested = document.getElementById("tSuggested");
    // ✅ Premios + estado
  const tStatus = document.getElementById("tStatus");
  const tPrizesJson = document.getElementById("tPrizesJson");
  if(tStatus) tStatus.value = "active";
  if(tPrizesJson) tPrizesJson.value = "[]";
  renderPrizesUI([]);

  // ✅ MULTI-LIGA reset (para que no queden reglas de otro torneo)
if(typeof LRJ_STORE !== "undefined") LRJ_STORE = null;
if(typeof LRJ_ACTIVE_LEAGUE !== "undefined") LRJ_ACTIVE_LEAGUE = "";
if(typeof LRJ_ENABLED !== "undefined") LRJ_ENABLED = false;

if(typeof lrjSyncJsonHidden_ === "function") lrjSyncJsonHidden_();
if(typeof lrjShowEditorBar_ === "function") lrjShowEditorBar_(false);

const lrjHidden = document.getElementById("tLeagueRulesJson");
if(lrjHidden) lrjHidden.value = "";


  const tAllowTypes = document.getElementById("tAllowTypes");
const tAllowCategories = document.getElementById("tAllowCategories");
if(tAllowTypes) tAllowTypes.value = "";
if(tAllowCategories) tAllowCategories.value = "";
if(typeof selectedAllowTypes !== "undefined") selectedAllowTypes.clear();
if(typeof selectedAllowCategories !== "undefined") selectedAllowCategories.clear();


  if(tTitle) tTitle.value = "";
  if(tDateTime) tDateTime.value = ""; // vacío para que elijas nueva fecha

    // ===== limpia ataques (fast/charged) =====
  const fastHidden = document.getElementById("tBanFast");
  const chargedHidden = document.getElementById("tBanCharged");
  const fastSearch = document.getElementById("tBanFastSearch");
  const chargedSearch = document.getElementById("tBanChargedSearch");
  const fastDrop = document.getElementById("tBanFastDrop");
  const chargedDrop = document.getElementById("tBanChargedDrop");

  if(fastHidden) fastHidden.value = "";
  if(chargedHidden) chargedHidden.value = "";
  if(fastSearch) fastSearch.value = "";
  if(chargedSearch) chargedSearch.value = "";

  if(fastDrop){ fastDrop.innerHTML = ""; fastDrop.style.display = "none"; }
  if(chargedDrop){ chargedDrop.innerHTML = ""; chargedDrop.style.display = "none"; }

  if(typeof selectedFast !== "undefined" && selectedFast?.clear) selectedFast.clear();
  if(typeof selectedCharged !== "undefined" && selectedCharged?.clear) selectedCharged.clear();

  if(typeof renderMoveChips === "function"){
    renderMoveChips("fast");
    renderMoveChips("charged");
  }


  // defaults (ajusta si quieres)
  if(tFormat) tFormat.value = "single";
  if(tLeaguePlan) tLeaguePlan.value = "super1500";
  if(typeof setLeaguePlanFromValue === "function") setLeaguePlanFromValue("super1500");
 if(tMode) tMode.value = "presencial";

// ✅ Presencial: default mesas / escenario
const tTablesCount = document.getElementById("tTablesCount");
const tHasMainStage = document.getElementById("tHasMainStage");
const tMainStageFrom = document.getElementById("tMainStageFrom");
const tMainStageRandomPct = document.getElementById("tMainStageRandomPct");

if(tTablesCount) tTablesCount.value = "8";
if(tHasMainStage) tHasMainStage.checked = false;
if(tMainStageFrom) tMainStageFrom.value = "semis";
if(tMainStageRandomPct) tMainStageRandomPct.value = "100";


syncVenueUI_();

  if(tBestOf) tBestOf.value = "3";
    // ✅ BO por fase: default ON (1/3/5)
  if(typeof writeBoPhaseToInputs_ === "function"){
    writeBoPhaseToInputs_({ enabled:true, groups:1, playoffs:3, final:5 });
  }

  if(tSuggested) tSuggested.value = ""; // que se auto-sugiera cuando cambies formato

  // reglas
  const tBanFast = document.getElementById("tBanFast");
  const tBanCharged = document.getElementById("tBanCharged");
  const tBanPokemon = document.getElementById("tBanPokemon"); // hidden
  const tBanTypes = document.getElementById("tBanTypes");
  const tBanCategories = document.getElementById("tBanCategories");
  const tAllowedPokemon = document.getElementById("tAllowedPokemon");

  if(tBanFast) tBanFast.value = "";
  if(tBanCharged) tBanCharged.value = "";
  if(tBanPokemon) tBanPokemon.value = "";
  if(tBanTypes) tBanTypes.value = "";
  if(tBanCategories) tBanCategories.value = "";
  if(tAllowedPokemon) tAllowedPokemon.value = "";

  // limpia buscador y dropdown
  const search = document.getElementById("tBanPokemonSearch");
  const drop = document.getElementById("tBanPokemonDrop");
  if(search) search.value = "";
  if(drop){
    drop.innerHTML = "";
    drop.style.display = "none";
  }

  // ✅ limpia chips (tu mapa global)
  if(typeof selectedBans !== "undefined" && selectedBans?.clear){
    selectedBans.clear();
  }
  if(typeof renderBanChips === "function"){
    renderBanChips();
  }
  if(typeof selectedAllowed !== "undefined" && selectedAllowed?.clear){
    selectedAllowed.clear();
    renderAllowedChips();
  }
  if(typeof selectedTypes !== "undefined") selectedTypes.clear();
  if(typeof selectedCategories !== "undefined") selectedCategories.clear();
  if(typeof bindTypeCategoryChips === "function") bindTypeCategoryChips();
}


function modalOpen(mode){
  const modal = document.getElementById("torneoModal");
  if(!modal) return;

  TORNEO_MODAL_MODE = mode;

  const t = document.getElementById("torneoModalTitle");
  const sub = document.getElementById("torneoModalSub");
  const btnCrear = document.getElementById("btnTorneoCrear");
  const btnSave = document.getElementById("btnTorneoGuardarCambios");

  if(mode === "create"){
    if(t) t.textContent = "Crear torneo";
    if(sub) sub.textContent = "Completa los datos y crea el torneo";
    if(btnCrear) btnCrear.style.display = "";
    if(btnSave) btnSave.style.display = "none";
  }else{
    if(t) t.textContent = "Editar torneo";
    if(sub) sub.textContent = "Actualiza datos del torneo seleccionado";
    if(btnCrear) btnCrear.style.display = "none";
    if(btnSave) btnSave.style.display = "";
  }

  modal.style.display = "block";
  document.body.classList.add("modal-open");
}


function modalClose(){
  const modal = document.getElementById("torneoModal");
  if(modal) modal.style.display = "none";
  document.body.classList.remove("modal-open");
}

// cerrar modal click backdrop / x / cancelar
document.addEventListener("click", (e) => {
  if(e.target && e.target.getAttribute && e.target.getAttribute("data-close") === "1"){
    modalClose();
  }
});

// botones de abrir modal
document.addEventListener("DOMContentLoaded", () => {
  const bCreate = document.getElementById("btnOpenCreateModal");
  const bEdit = document.getElementById("btnOpenEditModal");

if(bCreate) bCreate.onclick = () => {

  clearTorneoForm();
  modalOpen("create");
};


 let openingEdit = false;

if(bEdit) bEdit.onclick = async () => {

  if(openingEdit) return;
  openingEdit = true;

  const torneoId = getSelectedTorneoId();
  if(!torneoId){
    openingEdit = false;
    return toast("⚠ Selecciona un torneo", "error");
  }

  // ✅ abre al instante
  modalOpen("edit");
// ¡Carga al instante desde la memoria RAM!
  const lista = window.PARTICIPANTES_CACHE || [];

  try{
    // ✅ 1) usa cache si ya se cargó antes
    let c = null;

    if(LAST_TORNEO_CFG && LAST_TORNEO_ID === torneoId){
      c = LAST_TORNEO_CFG;
    }else{
      // ✅ 2) si no hay cache, recién pide al servidor
      const cfg = await torneoGET("torneo_config", { torneoId });
      if(!cfg.ok) throw new Error("No se pudo cargar torneo");
      c = cfg.config || {};
      LAST_TORNEO_CFG = c;
      LAST_TORNEO_ID  = torneoId;
    }

    // llena inputs
    document.getElementById("tTitle").value = safe(c.title);

    const dt = safe(c.dateTime).replace(" ", "T").slice(0,16);
    document.getElementById("tDateTime").value = dt;

    document.getElementById("tFormat").value = safe(c.format) || "single";
    const leaguePlanVal = safe(c.leaguePlan) || "super1500";
document.getElementById("tLeaguePlan").value = leaguePlanVal;

// ✅ detecta si es multi-liga (2+ ligas principales)
const lpParsed = (typeof parseLeaguePlanValue === "function") ? parseLeaguePlanValue(leaguePlanVal) : { mains:new Set(), tie:null };
const isMultiLeague = (lpParsed && lpParsed.mains && Array.from(lpParsed.mains).length >= 2);

// ✅ carga leagueRulesJson ANTES de pintar chips
const lrjStr = safe(c.leagueRulesJson);
const lrjHidden = document.getElementById("tLeagueRulesJson");
if(lrjHidden) lrjHidden.value = lrjStr;

// resetea estado multi-liga en memoria (por si venías de otro torneo)
if(typeof LRJ_STORE !== "undefined") LRJ_STORE = null;
if(typeof LRJ_ACTIVE_LEAGUE !== "undefined") LRJ_ACTIVE_LEAGUE = "";
if(typeof LRJ_ENABLED !== "undefined") LRJ_ENABLED = false;

let lrjOk = false;
if(isMultiLeague && lrjStr && typeof lrjLoadFromString_ === "function"){
  lrjOk = lrjLoadFromString_(lrjStr);
}
if(isMultiLeague && !lrjOk){
  if(typeof lrjInitStore_ === "function") lrjInitStore_();
  if(typeof toast === "function") toast("⚠ Torneo multi-liga sin leagueRulesJson válido. Define reglas por liga y guarda.", "error");
}

// ✅ pinta chips según lo guardado en el torneo

// (1) Campos generales
document.getElementById("tMode").value = safe(c.mode) || "presencial";
document.getElementById("tBestOf").value = safe(c.bestOf) || "3";
// ✅ Presencial: cargar Mesas/Escenario desde el torneo al modal Editar
const tTablesCount = document.getElementById("tTablesCount");
const tHasMainStage = document.getElementById("tHasMainStage");
const tMainStageFrom = document.getElementById("tMainStageFrom");
const tMainStageRandomPct = document.getElementById("tMainStageRandomPct");

if(tTablesCount) tTablesCount.value = safe(c.tablesCount) || "8";
if(tHasMainStage) tHasMainStage.checked = isTrue(c.hasMainStage);
if(tMainStageFrom) tMainStageFrom.value = safe(c.mainStageFrom) || "semis";
if(tMainStageRandomPct) tMainStageRandomPct.value = safe(c.mainStageRandomPct) || "100";

// ✅ refresca visibilidad del card + opciones avanzadas
if(typeof syncVenueUI_ === "function") syncVenueUI_();

// ✅ BO por fase: cargar si existe (si no, default 1/3/5)
try{
  const rawBo = safe(c.boPhasesJson || c.boRulesJson || "");
  const parsed = (typeof parseBoPhasesJson_ === "function") ? parseBoPhasesJson_(rawBo) : null;

  if(parsed && parsed.enabled){
    writeBoPhaseToInputs_({ enabled:true, groups:parsed.groups, playoffs:parsed.playoffs, final:parsed.final });
  }else{
    writeBoPhaseToInputs_({ enabled:true, groups:1, playoffs:3, final:5 });
  }
}catch(_){
  // si algo falla, dejamos el default
  if(typeof writeBoPhaseToInputs_ === "function"){
    writeBoPhaseToInputs_({ enabled:true, groups:1, playoffs:3, final:5 });
  }
}

document.getElementById("tSuggested").value = safe(c.suggestedSize);

// (2) Reglas:
// - Si NO es multi-liga => usar columnas globales (como siempre)
// - Si ES multi-liga pero leagueRulesJson está vacío/dañado (lrjOk=false) => usar columnas globales como base
if(!isMultiLeague || !lrjOk){
  document.getElementById("tBanFast").value = safe(c.bannedFastMoves);
  document.getElementById("tBanCharged").value = safe(c.bannedChargedMoves);
  document.getElementById("tBanPokemon").value = safe(c.bannedPokemon);
  document.getElementById("tBanTypes").value = safe(c.bannedTypes);
  document.getElementById("tBanCategories").value = safe(c.bannedCategories);

  document.getElementById("tAllowedPokemon").value = safe(c.allowedPokemon);
  document.getElementById("tAllowTypes").value = safe(c.allowedTypes);
  document.getElementById("tAllowCategories").value = safe(c.allowedCategories);

  if(typeof bindTypeCategoryChips === "function") bindTypeCategoryChips();
  if(typeof setAllowedFromValue === "function") setAllowedFromValue(document.getElementById("tAllowedPokemon").value || "");
  if(typeof setBansFromValue === "function") setBansFromValue(document.getElementById("tBanPokemon").value || "");

  if(typeof setMovesFromValue === "function"){
    setMovesFromValue("fast", document.getElementById("tBanFast").value || "");
    setMovesFromValue("charged", document.getElementById("tBanCharged").value || "");
  }
}

// ✅ estado + premios
const stEl = document.getElementById("tStatus");
if(stEl) stEl.value = normStatus(c.status || "active");

setPrizesFromJson(safe(c.prizesJson || "[]"));

// (3) Finalmente: render de ligas (esto también activa el editor multi-liga
// y carga reglas desde leagueRulesJson si lrjOk=true)
if(typeof setLeaguePlanFromValue === "function"){
  setLeaguePlanFromValue(leaguePlanVal);
}


  }catch(e){
    toast("⚠ " + (e?.message || "Error cargando torneo"), "error");
    modalClose();
  }finally{
    setModalLoading(false);
    openingEdit = false;
  }
};

});



document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnExportJson");
  if (!btn) return; 

  btn.addEventListener("click", async () => {
    // 1. Obtener ID seleccionado
    // Nota: Si getSelectedTorneoId no existe en tu contexto global, usa la variable que tengas.
    // Si usas un selector <select id="torneoSelector">, sería document.getElementById('torneoSelector').value
    const torneoId = (typeof getSelectedTorneoId === 'function') 
                     ? getSelectedTorneoId() 
                     : document.querySelector('#torneoSelector')?.value;

    if (!torneoId) return toast("⚠ Selecciona un torneo", "error");

    await runWithBtn(btn, "Descargando…", async () => {
      // 2. Pedir los datos al servidor (Google Sheets)
      const data = await torneoGET("torneo_export_json", { torneoId });
      
      if (!data || !data.ok) return toast("⚠ " + (data?.error || "Error al obtener datos"), "error");

      // =====================================================
      // 🔧 PARCHE: AGREGAR LO QUE FALTA PARA LA WEB
      // =====================================================
      
      // A. Asegurar Tabla de Posiciones (Standings)
      // Si el servidor no mandó standings (o es fase inscripción), los creamos aquí con 0 puntos.
      if (!data.standings || data.standings.length === 0) {
         const playersList = data.players || [];
         data.standings = playersList.map(p => ({
            rank: 0,
            playerId: p.playerId || p.id,
            name: p.nick || p.nombre || "Jugador",
            team: p.team || [],
            points: 0, wins: 0, losses: 0, ties: 0, buchholz: 0
         }));
      }

      // B. Corregir nombres para que el JS de la web no falle
      if (data.torneo) {
         // La web espera "league", pero el sheet suele tener "leaguePlan"
         data.torneo.league = data.torneo.leaguePlan || data.torneo.league || "great1500";
         // Aseguramos que existan fechas para detección de fase
         if (!data.torneo.prepEndsAt) data.torneo.prepEndsAt = "";
      }

      // =====================================================
      // FIN DEL PARCHE
      // =====================================================

      // 3. Generar y descargar el archivo
      const pretty = JSON.stringify(data, null, 2);
      const blob = new Blob([pretty], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      // Usamos el ID del torneo como nombre de archivo
      a.download = `${torneoId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      
      if(typeof toast === 'function') toast("✅ JSON descargado y optimizado");
    });
  });
});


// ===============================
// ✅ PARTICIPANTES (MODAL ADMIN)
// ===============================
let P_ROWS = [];
let P_TORNEO_ID = "";
let P_GENERATED = false;

function _isOpenModal_(){
  return Array.from(document.querySelectorAll(".modal"))
    .some(m => (m.style.display || "") === "block");
}
function _syncBodyModalLock_(){
  if(_isOpenModal_()) document.body.classList.add("modal-open");
  else document.body.classList.remove("modal-open");
}

function pModalOpen_(){
  const m = document.getElementById("participantsModal");
  if(!m) return;
  m.style.display = "block";
  _syncBodyModalLock_();
}
function pModalClose_(){
  const m = document.getElementById("participantsModal");
  if(m) m.style.display = "none";
  _syncBodyModalLock_();
}

function peModalOpen_(){
  const m = document.getElementById("participantEditModal");
  if(!m) return;
  m.style.display = "block";
  _syncBodyModalLock_();
}
function peModalClose_(){
  const m = document.getElementById("participantEditModal");
  if(m) m.style.display = "none";
  _syncBodyModalLock_();
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if(!t || !t.getAttribute) return;

  if(t.getAttribute("data-pclose") === "1") pModalClose_();
  if(t.getAttribute("data-peclose") === "1") peModalClose_();
});

function _pNorm_(s){ return pNormalizeText(String(s||"")); }

function _partyFromRow_(r){
  const out = [];
  for(let i=1;i<=6;i++){
    const v = String(r["P"+i] || "").trim();
    out.push(v);
  }
  return out;
}

function _iconTitle_(iconId){
  const e = POKEMON_VARIANT_BY_ID.get(String(iconId||""));
  return e ? e.text : String(iconId||"");
}

function _isBaja_(row){
  const st = String(row.Estado || "").toLowerCase();
  return st.includes("baja") || st.includes("rechaz");
}

function _isAsistencia_(row){
  const v = String(row.Asistencia ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "si" || v === "sí" || v === "ok" || v === "x";
}

function _setStats_(counts){
  const cT = document.getElementById("pCountTotal");
  const cA = document.getElementById("pCountActivos");
  const cB = document.getElementById("pCountBaja");
  if(cT) cT.textContent = String(counts?.total ?? 0);
  if(cA) cA.textContent = String(counts?.active ?? 0);
  if(cB) cB.textContent = String(counts?.baja ?? 0);
}

function _renderHelp_(){
  const box = document.getElementById("pHelpBox");
  if(!box) return;

  if(P_GENERATED){
    box.innerHTML = `🏆 <b>Bracket ya generado</b>: no se recomienda borrar. Usa <b>Reemplazar</b> para mantener PlayerId y no romper llaves.`;
  }else{
    box.innerHTML = `🧩 <b>Bracket aún NO generado</b>: puedes <b>Eliminar</b> filas sin problemas.`;
  }
}
function _renderParticipants_(rows, counts) {
  const tbody = document.getElementById("pTbody");
  if (!tbody) return;

  _setStats_(counts || {});
  _renderHelp_();

  tbody.innerHTML = "";

  rows.forEach(row => {
    const playerId = String(row.PlayerId || "").trim();
    const nombre   = String(row.NombrePokemonGO || row.Nombre || "").trim();
    const nick     = String(row.Nick || "").trim();
    const codigo   = String(row.Codigo || "").trim();
    const campfire = String(row.Campfire || "").trim();
    const estado   = String(row.Estado || "").trim();

    const party = _partyFromRow_(row);
    const partyHtml = `
      <div class="p-party">
        ${party.map(id => id
          ? `<img src="${iconUrl(id)}" title="${escapeHtml(_iconTitle_(id))}" alt="${escapeHtml(_iconTitle_(id))}">`
          : `<span class="tiny muted">—</span>`
        ).join("")}
      </div>
    `;

    const baja = _isBaja_(row);
    const asis = _isAsistencia_(row);

    const tr = document.createElement("tr");
    
    // ✅ CORRECCIÓN: Aplicar clase si hay asistencia usando 'asis' (que ya lo calculaste arriba)
    if (asis || estado === "Presente") {
      tr.classList.add("tr-asistencia-marcada");
    }

    tr.innerHTML = `
      <td>
        <input type="checkbox"
               data-pasist="1"
               data-pid="${escapeHtml(playerId)}"
               ${asis ? "checked" : ""}/>
      </td>
      <td><span class="tiny">${escapeHtml(playerId)}</span></td>
      <td>${escapeHtml(nombre)}</td>
      <td>${escapeHtml(nick)}</td>
      <td>${escapeHtml(codigo)}</td>
      <td>${escapeHtml(campfire)}</td>
      <td>${partyHtml}</td>
      <td>${escapeHtml(estado)}</td>
      <td>
        <div class="p-actions">
          <button class="btn-mini" data-pact="edit" data-pid="${escapeHtml(playerId)}">✏️ Editar</button>
          ${P_GENERATED
            ? `<button class="btn-mini good" data-pact="replace" data-pid="${escapeHtml(playerId)}">🔁 Reemplazar</button>`
            : `<button class="btn-mini danger" data-pact="delete" data-pid="${escapeHtml(playerId)}">🗑️ Eliminar</button>`
          }
        </div>
      </td>
    `;

    if (baja) tr.style.opacity = "0.55";
    tbody.appendChild(tr);
  });
}
function _applyParticipantsFilter_(){
  const q = _pNorm_(document.getElementById("pSearch")?.value || "");
  const f = String(document.getElementById("pFilter")?.value || "activos");

  let rows = Array.isArray(P_ROWS) ? P_ROWS.slice() : [];

  if(f === "activos"){
    rows = rows.filter(r => !_isBaja_(r));
  }else if(f === "baja"){
    rows = rows.filter(r => _isBaja_(r));
  }

  if(q){
    rows = rows.filter(r => {
      const s = _pNorm_(
        `${r.PlayerId||""} ${r.NombrePokemonGO||r.Nombre||""} ${r.Nick||""} ${r.Codigo||""} ${r.Campfire||""} ${r.Estado||""}`
      );
      return s.includes(q);
    });
  }

  _renderParticipants_(rows, {
    total: P_ROWS.length,
    active: P_ROWS.filter(r => !_isBaja_(r)).length,
    baja: P_ROWS.filter(r => _isBaja_(r)).length
  });
}

async function _loadParticipants_(torneoId){
  P_TORNEO_ID = String(torneoId||"").trim();
  if(!P_TORNEO_ID) return;

  // refresca config (para saber si ya generó bracket)
  try{
    const rc = await torneoGET("torneo_config", { torneoId: P_TORNEO_ID });
    const cfg = rc?.config || rc?.torneo || rc?.data || rc?.result || rc?.cfg || rc?.t || rc;
    P_GENERATED = isTrue(cfg?.generated);
  }catch(_){
    P_GENERATED = false;
  }

  const sub = document.getElementById("pModalSub");
  if(sub) sub.textContent = `Torneo ${P_TORNEO_ID} · Cargando…`;

  const r = await torneoGET("torneo_admin_list_inscritos", {
    user: CURRENT_USER,
    pin: ADMIN_PIN,
    torneoId: P_TORNEO_ID
  });

  if(!r?.ok){
    toast("⚠ " + (r?.error || "Error cargando participantes"), "error");
    P_ROWS = [];
    _renderParticipants_([], {total:0, active:0, baja:0});
    if(sub) sub.textContent = `Torneo ${P_TORNEO_ID} · Error`;
    return;
  }

  P_ROWS = Array.isArray(r.inscritos) ? r.inscritos : [];
  if(sub) sub.textContent = `Torneo ${P_TORNEO_ID} · ${P_GENERATED ? "Bracket generado" : "Bracket NO generado"}`;

  _applyParticipantsFilter_();
}

async function openParticipantsModal_(){
  const tid = getSelectedTorneoId();
  if(!tid) return toast("Selecciona un torneo", "error");

  pModalOpen_();
  
  // ¡Carga al instante desde la memoria RAM!
  const lista = window.PARTICIPANTES_CACHE || [];
  
  P_TORNEO_ID = tid;
  P_ROWS = lista;
  
  if(typeof LAST_TORNEO_CFG !== "undefined" && LAST_TORNEO_CFG) {
    P_GENERATED = isTrue(LAST_TORNEO_CFG.generated);
  }

  // ✅ CORRECCIÓN: Calcular contadores para que no salga 0
  const counts = {
    total: P_ROWS.length,
    active: P_ROWS.filter(r => !_isBaja_(r)).length,
    baja: P_ROWS.filter(r => _isBaja_(r)).length
  };

  // Pasamos los datos y los contadores
  _renderParticipants_(P_ROWS, counts);
}
function _findRowByPlayerId_(playerId){
  return (P_ROWS || []).find(r => String(r.PlayerId||"").trim() === String(playerId||"").trim()) || null;
}

// ---------- Picker single (para P1..P6) ----------
function bindPokemonSingleAutocomplete_(inputId, dropId){
  const input = document.getElementById(inputId);
  const drop  = document.getElementById(dropId);
  if(!input || !drop) return;

  const render = (items) => {
    drop.innerHTML = "";
    items.forEach(e => {
      const div = document.createElement("div");
      div.className = "poke-option";
      
      // ✅ CORRECCIÓN 2: Se quitó la etiqueta <img> para que solo salga texto
      div.innerHTML = `
        <div class="poke-opt-txt">
          <div class="poke-opt-title">${escapeHtml(e.text)}</div>
          <div class="poke-opt-sub tiny muted">${escapeHtml(e.id)}</div>
        </div>
      `;
      div.onclick = () => {
        input.value = e.text;
        input.dataset.iconId = e.id;
        drop.style.display = "none";
      };
      drop.appendChild(div);
    });
    drop.style.display = items.length ? "block" : "none";
  };

  input.addEventListener("input", () => {
    const q = _pNorm_(input.value);
    if(!q){
      drop.style.display = "none";
      delete input.dataset.iconId;
      return;
    }

    // ✅ CORRECCIÓN 3: Obtener baneos explícitos del torneo actual
    let bannedIds = [];
    if (typeof LAST_TORNEO_CFG !== "undefined" && LAST_TORNEO_CFG) {
      bannedIds = String(LAST_TORNEO_CFG.bannedPokemon || "").split(",").map(id => id.trim());
    }

    const items = (POKEMON_VARIANT_LIST || [])
      .filter(x => {
         // Filtro de búsqueda por texto
         if (!x.search.includes(q)) return false;
         
         // Filtro de Reglas: Si el ID está en la lista de baneados, lo ocultamos
         if (bannedIds.includes(String(x.id))) return false;
         
         return true;
      })
      .slice(0, 14);

    render(items);
  });

  document.addEventListener("click", (e) => {
    if(!drop.contains(e.target) && e.target !== input) drop.style.display = "none";
  });
}

function _setPokemonInput_(inputId, iconId){
  const input = document.getElementById(inputId);
  if(!input) return;

  const id = String(iconId||"").trim();
  if(!id){
    input.value = "";
    delete input.dataset.iconId;
    return;
  }

  const e = POKEMON_VARIANT_BY_ID.get(id);
  input.value = e ? e.text : id;
  input.dataset.iconId = id;
}

function _getPokemonInputIconId_(inputId){
  const input = document.getElementById(inputId);
  if(!input) return "";

  const ds = String(input.dataset.iconId || "").trim();
  if(ds) return ds;

  // si pegó el id directo
  const v = String(input.value || "").trim();
  if(POKEMON_VARIANT_BY_ID.has(v)) return v;

  // intentar match exacto por texto
  const norm = _pNorm_(v);
  const hit = (POKEMON_VARIANT_LIST || []).find(x => x.search === norm || _pNorm_(x.text) === norm);
  return hit ? hit.id : "";
}

function openParticipantEditor_(mode, playerId){
  const m = document.getElementById("participantEditModal");
  if(!m) return;

  const row = _findRowByPlayerId_(playerId);
  if(!row) return toast("⚠ Participante no encontrado", "error");

  const titulo = document.getElementById("peTitle");
  const sub = document.getElementById("peSub");
  const warn = document.getElementById("peWarn");
  if(warn){ warn.style.display="none"; warn.textContent=""; }

  m.dataset.mode = String(mode||"edit");
  m.dataset.torneoId = P_TORNEO_ID;
  m.dataset.playerId = String(playerId||"").trim();

  const isReplace = (m.dataset.mode === "replace");

  if(titulo) titulo.textContent = isReplace ? "Reemplazar participante (mantiene PlayerId)" : "Editar participante";
  if(sub) sub.textContent = `Torneo ${P_TORNEO_ID} · PlayerId ${playerId}`;

  const pidInfo = document.getElementById("pePlayerIdInfo");
  if(pidInfo) pidInfo.textContent = `PlayerId: ${playerId}`;

  // Prefill
  if(isReplace){
    document.getElementById("peNombre").value = "";
    document.getElementById("peNick").value = "";
    document.getElementById("peCodigo").value = "";
    document.getElementById("peCampfire").value = "";
    for(let i=1;i<=6;i++) _setPokemonInput_("peP"+i, "");
  }else{
    document.getElementById("peNombre").value = String(row.NombrePokemonGO || row.Nombre || "").trim();
    document.getElementById("peNick").value = String(row.Nick || "").trim();
    document.getElementById("peCodigo").value = String(row.Codigo || "").trim();
    document.getElementById("peCampfire").value = String(row.Campfire || "").trim();
    for(let i=1;i<=6;i++) _setPokemonInput_("peP"+i, String(row["P"+i]||"").trim());
  }

  document.getElementById("peResetAsistencia").checked = isReplace; // por defecto en reemplazo, resetea

  peModalOpen_();
}

async function _saveParticipant_(){
  const m = document.getElementById("participantEditModal");
  if(!m) return;

  const torneoId = String(m.dataset.torneoId||"").trim();
  const playerId = String(m.dataset.playerId||"").trim();
  const mode = String(m.dataset.mode||"edit");
  const isReplace = (mode === "replace");

  const nombre = String(document.getElementById("peNombre").value||"").trim();
  const nick   = String(document.getElementById("peNick").value||"").trim();
  const codigo = String(document.getElementById("peCodigo").value||"").trim();
  const campfire = String(document.getElementById("peCampfire").value||"").trim();

  const warn = document.getElementById("peWarn");
  const setWarn = (msg) => {
    if(!warn) return;
    warn.textContent = msg;
    warn.style.display = msg ? "block" : "none";
  };

  if(!torneoId || !playerId) return toast("⚠ Falta torneoId / playerId", "error");
  if(!nombre || !nick || !codigo) return setWarn("Nombre, Nick y Código son obligatorios.");

  const party = [];
  for(let i=1;i<=6;i++){
    const id = _getPokemonInputIconId_("peP"+i);
    party.push(id);
  }

  if(party.some(x => !x)) return setWarn("Debes seleccionar los 6 Pokémon.");
  const dup = party.filter((x,i,a)=> a.indexOf(x)!==i);
  if(dup.length) return setWarn("No puedes repetir Pokémon (detecté duplicados).");

  setWarn("");

  const resetAsis = document.getElementById("peResetAsistencia").checked;

  const payload = {
    accion: "torneo_admin_update_inscrito",
    user: CURRENT_USER,
    pin: ADMIN_PIN,
    torneoId,
    playerId,
    nombre, nick, codigo, campfire,
    party,
    // 🔁 en reemplazo forzamos estado "Inscrito"
    ...(isReplace ? { estado:"Inscrito" } : {}),
    ...(resetAsis ? { resetAsistencia:true } : {})
  };

  const btn = document.getElementById("btnPeSave");
  setBtnLoading(btn, true, "Guardando…");

  try{
    const r = await torneoPOST(payload);
    if(!r?.ok){
      setBtnLoading(btn, false);
      return toast("⚠ " + (r?.error || "Error guardando"), "error");
    }

    toast("✅ Participante actualizado");
    peModalClose_();

    await _loadParticipants_(torneoId);
    await torneoActualizar(); // para refrescar status/matches si lo usas
  }catch(e){
    console.error(e);
    toast("⚠ Error guardando", "error");
  }finally{
    setBtnLoading(btn, false);
  }
}

async function _deleteParticipant_(playerId){
  if(P_GENERATED){
    return toast("⚠ Bracket ya generado: usa Reemplazar", "error");
  }

  const torneoId = getSelectedTorneoId();
  if(!torneoId) return toast("⚠ Selecciona un torneo", "error");

  const row = _findRowByPlayerId_(playerId);
  const name = row ? (row.NombrePokemonGO || row.Nombre || row.Nick || playerId) : playerId;

  if(!confirm(`¿Eliminar a ${name}?\n\nEsto BORRA la fila (solo si el bracket NO está generado).`)) return;

  const r = await torneoPOST({
    accion: "torneo_admin_delete_inscrito",
    user: CURRENT_USER,
    pin: ADMIN_PIN,
    torneoId,
    playerId
  });

  if(!r?.ok) return toast("⚠ " + (r?.error || "Error eliminando"), "error");

  toast("🗑️ Eliminado");
  await _loadParticipants_(torneoId);
  await torneoActualizar();
}

// Delegación eventos: acciones + asistencia
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnTorneoParticipantes");
  if(btn) btn.onclick = () => openParticipantsModal_();

  const btnRef = document.getElementById("pBtnRefresh");
  if(btnRef) btnRef.onclick = async () => {
    if(!P_TORNEO_ID) return;
    await _loadParticipants_(P_TORNEO_ID);
  };

  const s = document.getElementById("pSearch");
  if(s) s.addEventListener("input", _applyParticipantsFilter_);

  const f = document.getElementById("pFilter");
  if(f) f.addEventListener("change", _applyParticipantsFilter_);

  const tbody = document.getElementById("pTbody");
  if(tbody){
    tbody.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-pact]");
      if(!b) return;

      const act = b.getAttribute("data-pact");
      const pid = b.getAttribute("data-pid");

      if(act === "edit") return openParticipantEditor_("edit", pid);
      if(act === "replace") return openParticipantEditor_("replace", pid);
      if(act === "delete") return _deleteParticipant_(pid);
    });

    tbody.addEventListener("change", async (e) => {
      const cb = e.target.closest("input[data-pasist]");
      if(!cb) return;

      const pid = cb.getAttribute("data-pid");
      const torneoId = getSelectedTorneoId();
      if(!torneoId) return;

      const r = await torneoPOST({
        accion: "torneo_admin_set_asistencia",
        user: CURRENT_USER,
        pin: ADMIN_PIN,
        torneoId,
        playerId: pid,
        asistencia: cb.checked
      });

      if(!r?.ok){
        cb.checked = !cb.checked; // revertir
        return toast("⚠ " + (r?.error || "Error asistencia"), "error");
      }

      // refresca cache local
      const row = _findRowByPlayerId_(pid);
      if(row) row.Asistencia = cb.checked ? "SI" : "";
      toast(cb.checked ? "✅ Asistencia marcada" : "↩ Asistencia quitada");
      // 👇 AÑADE ESTAS LÍNEAS PARA PINTARLO DE VERDE 👇
    const tr = btn.closest("tr"); // Busca la fila de la tabla
    if (tr) {
      tr.classList.add("tr-asistencia-marcada"); // Pinta el fondo verde
    }
    btn.classList.add("btn-asistencia-ok"); // Pinta el botón de verde
    btn.textContent = "✔ Presente";
    });
  }

  const btnSave = document.getElementById("btnPeSave");
  if(btnSave) btnSave.onclick = _saveParticipant_;

  // binders P1..P6
  for(let i=1;i<=6;i++){
    bindPokemonSingleAutocomplete_("peP"+i, "peP"+i+"Drop");
  }
});


/* ✅ inicia todo al cargar la página */
document.addEventListener("DOMContentLoaded", async () => {
  await loadPokemonJson();
  await loadMovesJson();

  bindPokemonBanAutocomplete();
  bindAllowedPokemonAutocomplete();
  bindTypeCategoryChips();
  bindLeaguePlanUI();

  // ✅ Autocomplete de ataques
  bindMovesAutocomplete("fast");
  bindMovesAutocomplete("charged");

  // ✅ Premios: botón + init
  const btnAddPrize = document.getElementById("btnAddPrize");
  if(btnAddPrize) btnAddPrize.onclick = () => addEmptyPrizeRow();

  // si está vacío, inicializa UI
  setPrizesFromJson(document.getElementById("tPrizesJson")?.value || "[]");
});




async function descargarBracketExcel() {
  const torneoId = SELECTED_TORNEO_ID;
  if (!torneoId) return toast("Selecciona un torneo primero", "error");

  toast("⏳ Conectando y analizando datos...");

  try {
    // 1. Obtener datos
    const r = await torneoGET("torneo_export_json", { torneoId });
    if (!r || !r.ok) throw new Error("Error de conexión o datos vacíos.");

    // 2. Localizar Matches y Players
    const matches = r.matches || r.playoffs || r.torneo?.matches || [];
    const participants = r.players || r.participants || r.torneo?.participants || [];

    if (matches.length === 0) return toast("⚠ No hay enfrentamientos generados.", "warn");

    console.log("🔍 DEBUG DATA:", { 
      matches: matches.length, 
      matchExample: matches[0], 
      playerExample: participants[0] 
    });

    // 3. HERRAMIENTA INTELIGENTE: Busca el valor sin importar mayúsculas/minúsculas
    const getVal = (obj, ...keys) => {
      if (!obj) return "";
      // Busca la primera llave que exista
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== "") return obj[k];
      }
      // Si no encuentra, busca insensible a mayúsculas (más lento pero seguro)
      const objKeys = Object.keys(obj);
      for (const k of keys) {
        const foundKey = objKeys.find(ok => ok.toLowerCase() === k.toLowerCase());
        if (foundKey && obj[foundKey] !== undefined) return obj[foundKey];
      }
      return "";
    };

    // 4. Mapa de Jugadores (Indexamos para búsqueda rápida y limpia)
    const playerMap = new Map();
    participants.forEach(p => {
      // Buscamos ID y Nombre con todas las variantes posibles
      const pid = String(getVal(p, "PlayerId", "id", "playerId", "ID")).trim();
      const pnick = getVal(p, "Nick", "NombrePokemonGO", "nick", "name", "Nombre") || "Sin Nombre";
      if (pid) playerMap.set(pid, pnick);
    });

    // 5. Generar CSV
    const SEP = ";";
    let csv = "sep=;\n";
    // Encabezados
    csv += ["Ronda", "MatchId", "ID J1", "Jugador 1", "Score J1", "Score J2", "Jugador 2", "ID J2", "Ganador", "Estado"].join(SEP) + "\n";

    matches.forEach(m => {
      // Obtener IDs de los enfrentamientos (limpiando espacios)
      const idA = String(getVal(m, "PlayerAId", "playerAId", "player1Id", "p1")).trim();
      const idB = String(getVal(m, "PlayerBId", "playerBId", "player2Id", "p2")).trim();
      const idWin = String(getVal(m, "WinnerId", "winnerId", "winner")).trim();

      // Obtener Datos (Ronda puede estar en Round o SwissRound)
      const ronda = getVal(m, "Round", "round", "SwissRound", "swissRound") || 0;
      const mid = getVal(m, "MatchId", "matchId", "id");
      const scoreA = getVal(m, "ScoreA", "scoreA", "score1") || 0;
      const scoreB = getVal(m, "ScoreB", "scoreB", "score2") || 0;
      const status = getVal(m, "Status", "status", "state") || "scheduled";

      // Buscar nombres en el mapa
      const nickA = playerMap.get(idA) || (idA === "BYE" ? "— LIBRE —" : "Desconocido");
      const nickB = playerMap.get(idB) || (idB === "BYE" ? "— LIBRE —" : "Desconocido");
      const nickWin = playerMap.get(idWin) || (idWin ? "Desconocido" : "Pendiente");

      const fila = [
        ronda,
        mid,
        idA,
        nickA,
        scoreA,
        scoreB,
        nickB,
        idB,
        nickWin,
        status
      ];
      
      csv += fila.map(v => String(v).replace(/;/g, ',')).join(SEP) + "\n";
    });

    // 6. Descargar
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Bracket_Torneo_${torneoId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast("✅ Reporte generado correctamente");

  } catch (err) {
    console.error("ERROR:", err);
    alert("Error: " + err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btnDownloadBracket = document.getElementById("btnDownloadBracket");
  if (btnDownloadBracket) {
    btnDownloadBracket.addEventListener("click", descargarBracketExcel);
  }
});

// Dentro de document.addEventListener("DOMContentLoaded", ...
const btnExportarExcel = document.getElementById("btnTorneoExportarExcel"); // Asegúrate que el ID coincida con tu HTML

// ✅ BOTÓN EXPORTAR EXCEL (CON TRADUCCIÓN DE NOMBRES Y COLUMNA PARTICIPANTE)
if ($("btnTorneoExportarExcel")) {
  $("btnTorneoExportarExcel").onclick = async () => {
    const torneoId = getSelectedTorneoId();
    if (!torneoId) return toast("⚠ Selecciona un torneo", "error");

    const btn = $("btnTorneoExportarExcel");
    // Cambiamos el mensaje a "Preparando nombres..." para que el admin sepa que se está procesando el JSON
    await runWithBtn(btn, "Preparando nombres...", async () => {
      
      let dict = {};
      try {
        // Intentamos cargar pokemon.json de tu servidor para traducir
        const response = await fetch('pokemon.json'); 
        const pokes = await response.json();
        pokes.forEach(p => {
          if (p.dex && p.name) {
            // Guardamos la referencia para el servidor
            dict[String(p.dex)] = p.name.es_419 || p.name.en;
          }
        });
      } catch (e) {
        console.error("Error cargando diccionario para el Excel", e);
      }

      const r = await torneoPOST({
        accion: "torneo_admin_export_participantes_csv",
        user: CURRENT_USER,
        pin: ADMIN_PIN,
        torneoId,
        pokeMap: dict // Enviamos el mapa al servidor
      });

      if (!r.ok) return toast("⚠ " + (r.error || "Error al exportar"), "error");

      // ✅ BOM para que Excel lea bien las tildes (Esencial para nombres en español)
      const BOM = "\uFEFF"; 
      const blob = new Blob([BOM + r.csv], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      
      // Usamos el nombre de archivo que viene del servidor o uno por defecto
      link.download = r.fileName || `Participantes_${torneoId}.csv`;
      
      document.body.appendChild(link);
      link.click();
      
      // Limpieza del DOM
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 0);
      
      toast("✅ Excel generado como 'Participante'");
    });
  };
}

// ---------- Utils ----------
function show_(el, on){
  if(!el) return;
  el.style.display = on ? "block" : "none";
}

async function copyText_(txt){
  try{
    await navigator.clipboard.writeText(String(txt||""));
  }catch(_){
    const ta = document.createElement("textarea");
    ta.value = String(txt||"");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

// ======================================================
// 🔎 MODLOG WATCHERS (DEBUG)
// ======================================================
(function(){
  const L = window.MODLOG;
  if(!L) return;

  const wrap = (name) => {
    const fn = window[name];
    if(typeof fn !== "function") return;
    if(fn.__modlogWrapped) return;

    function wrapped(...args){
      L.call(name, args);
      return fn.apply(this, args);
    }
    wrapped.__modlogWrapped = true;
    window[name] = wrapped;
  };

  // 1) Envuelve opens/closes importantes
  [
    "modalOpen",
    "modalClose",
    "pModalOpen_",
    "pModalClose_",
    "peModalOpen_",
    "peModalClose_",
    "_syncBodyModalLock_",
    "openParticipantsModal_"
  ].forEach(wrap);

  // 2) Log de clicks relevantes (CAPTURE)
  document.addEventListener("click", (ev) => {
    if(!L.enabled) return;
    const t = ev.target;

    const which =
      t?.closest?.("#btnOpenCreateModal") ? "CLICK #btnOpenCreateModal" :
      t?.closest?.("#btnTorneoParticipantes") ? "CLICK #btnTorneoParticipantes" :
      t?.closest?.("[data-close='1']") ? "CLICK [data-close=1]" :
      t?.closest?.("[data-pclose='1']") ? "CLICK [data-pclose=1]" :
      t?.closest?.("[data-peclose='1']") ? "CLICK [data-peclose=1]" :
      "";

    if(which) L.log(which, L.snap());
  }, true);

  // 3) Observa cambios en body.class (scroll lock)
  if(document.body){
    const ob = new MutationObserver((muts) => {
      for(const m of muts){
        if(m.attributeName === "class"){
          L.log("BODY class mutation", L.snap());
          break;
        }
      }
    });
    ob.observe(document.body, { attributes:true, attributeFilter:["class"] });
  }

  // 4) Observa cambios en los modales (display/z-index)
  const mods = Array.from(document.querySelectorAll(".modal"));
  const om = new MutationObserver((muts) => {
    muts.forEach(m => {
      const el = m.target;
      if(!(el instanceof HTMLElement)) return;
      if(!el.classList.contains("modal")) return;

      const cs = getComputedStyle(el);
      L.log(`MODAL ${el.id || "(sin id)"} style/class mutation`, {
        display: cs.display,
        zIndex: cs.zIndex,
        opacity: cs.opacity,
        pointerEvents: cs.pointerEvents,
        snap: L.snap()
      });
    });
  });

  mods.forEach(el => om.observe(el, { attributes:true, attributeFilter:["style","class"] }));

  // init
  L.log("✅ MODLOG listo", L.snap());
})();
