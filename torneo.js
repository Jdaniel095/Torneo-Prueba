// torneo.js - Funcionalidades JavaScript para la página del torneo

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    console.log('Página de torneo cargada correctamente');
    
    // Inicializar funciones
    initResponsiveChecks();
    initImageLoading();
    initInteractiveElements();
});

/**
 * Verificar el tipo de dispositivo y ajustar comportamiento
 */
function initResponsiveChecks() {
    // Detectar ancho de pantalla
    const screenWidth = window.innerWidth;
    
    // Detectar si es dispositivo táctil
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Agregar clase al body según el tipo de dispositivo
    if (screenWidth < 768) {
        document.body.classList.add('mobile-device');
    } else if (screenWidth < 1024) {
        document.body.classList.add('tablet-device');
    } else {
        document.body.classList.add('desktop-device');
    }
    
    if (isTouchDevice) {
        document.body.classList.add('touch-device');
    }
    
    console.log(`Dispositivo detectado: ${screenWidth}px, Táctil: ${isTouchDevice}`);
    
    // Actualizar al cambiar el tamaño de la ventana
    window.addEventListener('resize', debounce(function() {
        updateDeviceClass();
    }, 250));
}

/**
 * Actualizar clase del dispositivo al redimensionar
 */
function updateDeviceClass() {
    const screenWidth = window.innerWidth;
    
    // Remover clases previas
    document.body.classList.remove('mobile-device', 'tablet-device', 'desktop-device');
    
    // Agregar clase correspondiente
    if (screenWidth < 768) {
        document.body.classList.add('mobile-device');
    } else if (screenWidth < 1024) {
        document.body.classList.add('tablet-device');
    } else {
        document.body.classList.add('desktop-device');
    }
    
    console.log(`Tamaño actualizado: ${screenWidth}px`);
}

/**
 * Manejar carga de imágenes
 */
function initImageLoading() {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
        // Mostrar mensaje mientras carga
        img.addEventListener('load', function() {
            console.log(`Imagen cargada: ${img.alt}`);
            img.classList.add('loaded');
        });
        
        // Manejar errores de carga
        img.addEventListener('error', function() {
            console.error(`Error al cargar imagen: ${img.src}`);
        });
    });
}

/**
 * Agregar interactividad a elementos
 */
function initInteractiveElements() {
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
        // Efecto de click en móviles
        card.addEventListener('click', function() {
            console.log('Card clickeada');
        });
        
        // Efecto hover mejorado
        card.addEventListener('mouseenter', function() {
            this.style.transition = 'all 0.3s ease';
        });
    });
}

/**
 * Función debounce para optimizar eventos de resize
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Smooth scroll para navegación interna (si agregas enlaces)
 */
function smoothScroll(target) {
    const element = document.querySelector(target);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

/**
 * Detectar orientación del dispositivo
 */
window.addEventListener('orientationchange', function() {
    const orientation = window.orientation;
    console.log(`Orientación cambiada: ${orientation === 0 ? 'Vertical' : 'Horizontal'}`);
    
    // Agregar lógica específica para cambios de orientación
    setTimeout(updateDeviceClass, 100);
});

/**
 * Función para crear notificaciones o mensajes
 */
function showNotification(message, type = 'info') {
    console.log(`Notificación [${type}]: ${message}`);
}

/**
 * Verificar conexión a internet
 */
window.addEventListener('online', function() {
    showNotification('Conexión restaurada', 'success');
});

window.addEventListener('offline', function() {
    showNotification('Sin conexión a internet', 'warning');
});

/**
 * Prevenir zoom accidental en iOS al hacer doble tap
 */
let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

/**
 * Función de utilidad para obtener información del dispositivo
 */
function getDeviceInfo() {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        isTablet: /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768,
        isDesktop: window.innerWidth >= 1024
    };
}

// Exportar funciones útiles (opcional)
window.TorneoApp = {
    smoothScroll,
    showNotification,
    getDeviceInfo,
    updateDeviceClass
};

// Log de información inicial
console.log('Información del dispositivo:', getDeviceInfo());

const API = "https://script.google.com/macros/s/AKfycbzEpIAkxL3tWHsl80XUp6DfHp3n8pspK7mG_JZtI5snfM8yU5wKkBVnBTTbe1BxNZXwJQ/exec";
const $ = (id) => document.getElementById(id);

let TORNEOS = [];
let SELECTED_ID = "";
let LOADALL_PROMISE = null;
let LAST_LOADALL_TS = 0;
const LOADALL_MIN_MS = 4000; // throttle para que no recargue a cada rato
let CURRENT_ALLOWED_DEX_SET = null;
let CURRENT_ALLOWED_OPTION_SET = new Set(); // strings exactos "6 - Charizard"
let CURRENT_ALLOWED_ID_SET = new Set();     // ids exactos: "6", "6_s", "302_b1", etc
let POKE_OPTION_LABEL_BY_ID = new Map();    // id(lower) -> label exacto del datalist
let POKE_OPT_BY_LABEL = new Map();          // label exacto -> {id,dex,label,variantKey}
let DEFAULT_LABEL_BY_DEX = new Map();       // dex -> label normal permitido (para cuando escriben a mano)
let CURRENT_ALLOWED_OPTIONS_ALL = [];       // ✅ opciones completas (ordenadas) para filtrar el datalist por slot
let CURRENT_ALLOWED_OPTIONS_SORTED = [];    // ✅ para el dropdown custom del modal

// ===============================
// ✅ MODO PÚBLICO: mostrar solo torneo activo (si no quieres, luego activas ?all=1)
// ===============================
const URL_PARAMS = new URLSearchParams(window.location.search);
const SHOW_ALL_TOURNEOS = ["1","true","si","sí"].includes(String(URL_PARAMS.get("all") || "").toLowerCase());

// ===============================
// ✅ UI: reset completo cuando NO hay torneo
// ===============================
function renderNoTournamentState_(msg){
  // limpia estado en memoria
  TORNEOS = [];
  SELECTED_ID = "";

  // título grande
  const titleEl = $("torneoTitle");
  if(titleEl) titleEl.textContent = "NO HAY TORNEO";

  // oculta meta y botón registro
  const meta = $("torneoMeta");
  if(meta) meta.style.display = "none";

  const btn = $("openModalBtn");
  if(btn) btn.style.display = "none";

  // info
  const info = $("torneoInfo");
  if(info){
    info.textContent = msg || "No hay torneos disponibles.";
    info.style.display = "block";
  }

  // helpers
  const hide = (id) => { const el = $(id); if(el) el.style.display = "none"; };
  const clear = (id) => { const el = $(id); if(el) el.innerHTML = ""; };

  // oculta secciones
  hide("eventTabs");
  hide("rulesCard");
  hide("prepCountdownBar");
  hide("battlePhase");
  hide("groupsSection");
  hide("resultPhase");
  hide("bracketSection");
  hide("liveTablesWrap");
  hide("nextQueueWrap");

  // limpia contenido dinámico
  clear("eventSummary");
  clear("bracket");
  clear("matchNow");
  clear("matchNext1");
  clear("matchNext2");
  clear("groupsGrid");
  clear("liveTablesGrid");
  clear("nextQueueList");

  // si el modal quedó abierto, lo cerramos
  const modal = $("formModal");
  if(modal && modal.style.display !== "none"){
    modal.style.display = "none";
    if(typeof restaurarScrollBody === "function") restaurarScrollBody();
  }
}

// ===============================
// ✅ PREP TIMER (fase de preparación)
// ===============================
let PREP_TIMER = null;
let PREP_TARGET_END_MS = 0;

function parseGmt5StampToMs(stamp){
  const s = String(stamp || "").trim();
  if(!s) return 0;

  // Si ya viene como ISO con timezone (ej. 2026-02-06T15:30:00-05:00)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : 0;
  }

  // Formato GAS: "yyyy-MM-dd HH:mm:ss"  -> lo tratamos como -05:00 fijo
  const m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if(m){
    const iso = `${m[1]}T${m[2]}-05:00`;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : 0;
  }

  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : 0;
}

// ✅ Fase de preparación activa
function isPrepActive(t){
  const endMs = parseGmt5StampToMs(t?.prepEndsAt);
  return (!t?.open && !!endMs && Date.now() < endMs);
}

function isGroupFormat_(t){
  const fmt = String(t?.format ?? t?.Formato ?? t?.mode ?? t?.Mode ?? "").trim().toLowerCase();
  if(fmt.includes("grupo") || fmt.includes("groups") || fmt.includes("group")) return true;

  const matches = Array.isArray(t?.matches) ? t.matches : [];
  return matches.some(m => {
    const gid = String(m?.GroupId ?? m?.groupId ?? "").trim();
    const st  = String(m?.Stage ?? m?.stage ?? "").trim().toLowerCase();
    return !!gid || st.includes("group") || st.includes("grupo");
  });
}

// ===============================
// ✅ FASE DE ENFRENTAMIENTOS (bracket en curso)
// ===============================
function isBattlePhase(t){
  const raw = (t?.status ?? t?.estado ?? t?.state ?? t?.phase ?? t?.fase ?? "");
  const st = String(raw || "").trim().toLowerCase();

  if(st){
    if(st.includes("enfrent") || st.includes("battle") || st.includes("ongoing") || st.includes("running") || st.includes("en_curso") || st.includes("curso")){
      return true;
    }
  }

  if(!t?.open && !isPrepActive(t) && isTrue(t?.generated)) return true;

  const matches = Array.isArray(t?.matches) ? t.matches : [];
  const hasPairs = matches.some(m => {
    const a = String(m?.PlayerAId ?? m?.playerAId ?? m?.AId ?? m?.aId ?? "").trim();
    const b = String(m?.PlayerBId ?? m?.playerBId ?? m?.BId ?? m?.bId ?? "").trim();
    return !!a && !!b;
  });

  if(!t?.open && !isPrepActive(t) && hasPairs) return true;

  return false;
}

function setHeaderBattleMode(isBattle){
  const lbl1 = $("metaDateLabel");
  const lbl2 = $("metaTimeLabel");
  const d = $("torneoDateOnly");
  const h = $("torneoTimeOnly");

   if(isBattle){
    lbl1.innerHTML =
      'FASE DE ENFRENTAMIENTO' +
      '<span class="phase-sep"> / </span>' +
      'TORNEO: <span class="phase-status">EN CURSO</span>';

    lbl1.classList.add("battle-phase-line");

    d.style.display = "none";
    lbl2.style.display = "none";
    h.style.display = "none";
  }else{
    lbl1.classList.remove("battle-phase-line");
    lbl1.textContent = "FECHA:";
    lbl2.textContent = "HORA:";

    d.style.display = "";
    lbl2.style.display = "";
    h.style.display = "";
  }
}

// ===============================
// ✅ Scores / estado match (robusto con fallback)
// ===============================
function numOr0_(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getScoreA_(m){
  return numOr0_(m?.ScoreA ?? m?.scoreA ?? m?.aScore ?? m?.AScore ?? m?.A_score ?? m?.score1 ?? 0);
}
function getScoreB_(m){
  return numOr0_(m?.ScoreB ?? m?.scoreB ?? m?.bScore ?? m?.BScore ?? m?.B_score ?? m?.score2 ?? 0);
}

function isMatchDone_(m){
  const st = String(m?.Status ?? m?.status ?? "").trim().toLowerCase();
  if(st === "done" || st === "finished" || st === "final" || st === "closed") return true;
  if(isTrue(m?.Done ?? m?.done ?? m?.Locked ?? m?.locked ?? m?.Closed ?? m?.closed)) return true;
  const w = String(m?.WinnerId ?? m?.winnerId ?? "").trim();
  const l = String(m?.LoserId ?? m?.loserId ?? "").trim();
  if(w || l) return true;
  return false;
}

function isMatchDoneByScore_(t, m){
  const bo = Number(m?.bestOf ?? m?.BestOf ?? t?.bestOf ?? 3) || 3;
  const need = needWinsFromBestOf(bo);
  return getScoreA_(m) >= need || getScoreB_(m) >= need;
}

function isMatchClosed_(t, m){
  return isMatchDone_(m) || isMatchDoneByScore_(t, m);
}

function matchSortKey_(m){
  const r = Number(m?.Round ?? m?.round ?? 1);
  const s = Number(m?.Slot ?? m?.slot ?? 0);
  return [r, s];
}

function sortMatches_(arr){
  return (arr || []).slice().sort((a,b)=>{
    const [ar,as] = matchSortKey_(a);
    const [br,bs] = matchSortKey_(b);
    return (ar-br) || (as-bs);
  });
}

function getMatchId_(m){
  return String(m?.MatchId ?? m?.matchId ?? m?.id ?? "").trim();
}

function getMatchGroupId_(m){
  const raw = (m?.GroupId ?? m?.groupId ?? m?.Group ?? m?.group ?? "");
  return normalizeGroupId_(raw);
}

function getMatchPlayerId_(m, side){
  if(side === "A"){
    return String(m?.PlayerAId ?? m?.playerAId ?? m?.AId ?? m?.aId ?? m?.playerA ?? "").trim();
  }
  return String(m?.PlayerBId ?? m?.playerBId ?? m?.BId ?? m?.bId ?? m?.playerB ?? "").trim();
}

function getMatchPlayerName_(m, side){
  if(side === "A"){
    return String(m?.PlayerAName ?? m?.playerAName ?? m?.NombreA ?? m?.NickA ?? "").trim();
  }
  return String(m?.PlayerBName ?? m?.playerBName ?? m?.NombreB ?? m?.NickB ?? "").trim();
}

function splitTeamTokens_(v){
  if(!v) return [];
  if(Array.isArray(v)) return v.map(x => String(x||"").trim()).filter(Boolean);
  const s = String(v||"").trim();
  if(!s) return [];
  return s.split(/[,;|\n\r]+/g).map(x=>x.trim()).filter(Boolean);
}

function extractTeamFromMatch_(m, side){
  const pick = (side === "A")
    ? (m?.TeamA ?? m?.teamA ?? m?.PokemonsA ?? m?.pokemonsA ?? m?.PokemonA ?? m?.pokemonA ?? "")
    : (m?.TeamB ?? m?.teamB ?? m?.PokemonsB ?? m?.pokemonsB ?? m?.PokemonB ?? m?.pokemonB ?? "");

  const a = splitTeamTokens_(pick);
  if(a.length) return a.slice(0,6);

  const out = [];
  const pref = side;
  for(let i=1;i<=6;i++){
    const v = m?.[`${pref}${i}`] ?? m?.[`${pref.toLowerCase()}${i}`] ?? "";
    if(v) out.push(String(v).trim());
  }
  return out.slice(0,6);
}

function getBattlePlayer_(t, m, side){
  const pid = getMatchPlayerId_(m, side);
  const byId = t?.byId || {};
  const meta = pid ? (byId[pid] || {}) : {};

  const name = meta?.name || getMatchPlayerName_(m, side) || (pid || "TBD");
  const team = (Array.isArray(meta?.team) && meta.team.length)
    ? meta.team
    : extractTeamFromMatch_(m, side);

  return { id: pid, name, team };
}

function normalizeIconId_(token){
  const s = String(token || "").trim();
  if(!s) return "";
  const m = s.match(/^(\d{1,4}(?:_[a-z0-9]+)?)\b/i);
  return m ? m[1] : s;
}

function monImgUrl_(token){
  const id = normalizeIconId_(token);
  if(/^\d{1,4}(?:_[a-z0-9]+)?$/i.test(id)){
    return iconUrl(id);
  }
  return spriteUrl(token);
}

function renderBattleTeam_(team){
  const arr = Array.isArray(team) ? team.slice(0,6) : [];
  const filled = (arr.length ? arr : new Array(6).fill(""));
  return filled.map(tok => {
    const safeTitle = iconLabelFor(tok) || String(tok||"").trim() || "?";
    const url = monImgUrl_(tok);
    return `
      <div class="battle-mon" title="${escapeHtml(safeTitle)}">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(safeTitle)}"
             onerror="this.style.display='none'; this.parentElement.innerHTML='<span>?</span>'">
      </div>
    `;
  }).join("");
}

function renderBattleTeamUnknown_(count = 6){
  const n = Math.max(1, Number(count || 6));
  return new Array(n).fill(0).map(() => `
    <div class="battle-mon" title="?"><span>?</span></div>
  `).join("");
}

function renderBattleFinalPlaceholderCard(t){
  const bo = Number(t?.bestOf ?? 3) || 3;
  const meta = `Final · BO${bo}`;

  return `
    <div class="battle-card battle-card--next">
      <div class="battle-head">
        <div class="battle-title">Próximo enfrentamiento 2</div>
        <div class="battle-meta">${meta}</div>
      </div>

      <div class="battle-body--next">
        <div class="battle-player">
          <div class="battle-name">Finalista 1</div>
          <div class="battle-team">${renderBattleTeamUnknown_(6)}</div>
        </div>

        <div class="battle-next-vs" aria-hidden="true">VS</div>

        <div class="battle-player">
          <div class="battle-name">Finalista 2</div>
          <div class="battle-team">${renderBattleTeamUnknown_(6)}</div>
        </div>
      </div>
    </div>
  `;
}

function fmtMMSS(totalSec){
  const sec = Math.max(0, Math.floor(Number(totalSec || 0)));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function stopPrepTimer(){
  if(PREP_TIMER){
    clearInterval(PREP_TIMER);
    PREP_TIMER = null;
  }
  PREP_TARGET_END_MS = 0;
}

function startPrepTimer(prepEndsAtStamp){
  stopPrepTimer();

  const endMs = parseGmt5StampToMs(prepEndsAtStamp);
  if(!endMs) return;

  PREP_TARGET_END_MS = endMs;

  const tick = () => {
    const now = Date.now();
    const remainMs = Math.max(0, endMs - now);
    const remainSec = Math.ceil(remainMs / 1000);

    const el = $("torneoTimeOnly");
    if(el) el.textContent = fmtMMSS(remainSec);
        const bar = $("prepCountdown");
    if(bar) bar.textContent = fmtMMSS(remainSec);

    if(remainMs <= 0){
      stopPrepTimer();
      showToast("⏳ Preparación finalizada");
      loadAll(true).catch(()=>{});
    }
  };

  tick();
  PREP_TIMER = setInterval(tick, 1000);
}

function setHeaderPrepMode(isPrep){
  const lbl1 = $("metaDateLabel");
  const lbl2 = $("metaTimeLabel");
  if(!lbl1 || !lbl2) return;

  if(isPrep){
    lbl1.textContent = "FASE DE PREPARACIÓN";
    lbl2.textContent = "TERMINA EN:";
  }else{
    lbl1.textContent = "FECHA:";
    lbl2.textContent = "HORA:";
  }
}

// ===============================
// POKÉDEX (para filtrar el modal)
// ===============================
let POKEMON_DB = [];
let POKE_BY_DEX = new Map();
let POKE_BY_NAME = new Map(); 
let ICON_META_BY_ID = new Map(); 

// ===============================
// MOVES (para mostrar reglas)
// ===============================
let MOVES_FAST = [];
let MOVES_CHARGED = [];
let MOVE_BY_ID = new Map();
let MOVE_BY_NORMNAME = new Map();
const UI_LANG = "es_419"; 

function normName(s){
  return String(s||"")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
}

async function loadPokemonDB(){
  if (POKEMON_DB.length) return;
  // ✅ evita el típico bug de GitHub Pages por mayúsculas/minúsculas
  let r = await fetch("pokemon.json");
  if (!r.ok) r = await fetch("Pokemon.json");
  if (!r.ok) throw new Error("No se pudo cargar pokemon.json (revisa el nombre exacto del archivo en tu repo)");

  POKEMON_DB = await r.json();

  POKE_BY_DEX.clear();
  POKE_BY_NAME.clear();
  ICON_META_BY_ID.clear();

  const inferVariantTag = (iconIdLower) => {
    if(/_s$/.test(iconIdLower)) return "Shiny";
    if(/_a1(\b|_)/.test(iconIdLower)) return "Shadow";
    if(/_a2(\b|_)/.test(iconIdLower)) return "Purificado";
    if(/_g(\b|\d|_)/.test(iconIdLower)) return "Gigamax";
    if(/_d(\b|\d|_)/.test(iconIdLower)) return "Dynamax";
    if(/_m\d+$/.test(iconIdLower) || /_m$/.test(iconIdLower)) return "Mega";
    return "";
  };

  POKEMON_DB.forEach(p => {
    const dex = Number(p.dex);
    if (!dex) return;

    POKE_BY_DEX.set(dex, p);

    const nES = p?.name?.es_419 || p?.name?.es_ES || p?.name?.en || "";
    const nEN = p?.name?.en || "";
    POKE_BY_NAME.set(normName(nES), dex);
    if (nEN) POKE_BY_NAME.set(normName(nEN), dex);

    const name = nES || nEN || `#${dex}`;
    ICON_META_BY_ID.set(String(dex), { dex, name, label: name });

    const rel = Array.isArray(p?.uicons?.relevantIconIds) ? p.uicons.relevantIconIds : [];
    rel.forEach(iconId => {
      const idLower = String(iconId).toLowerCase();
      if(!idLower) return;
      const tag = inferVariantTag(idLower);
      const label = tag ? `${name} — ${tag}` : name;
      if(!ICON_META_BY_ID.has(idLower)){
        ICON_META_BY_ID.set(idLower, { dex, name, label });
      }
    });
  });
}

async function loadMovesDB(){
  if (MOVE_BY_ID.size) return;
  const candidates = [
    "moves.i18n.latam.withId.json",
    "Moves.i18n.latam.withId.json"
  ];

  let r = null;
  for (const f of candidates){
    const rr = await fetch(f);
    if (rr.ok){ r = rr; break; }
  }

  if(!r) throw new Error("No se pudo cargar moves.i18n.latam.withId.json");

  const data = await r.json();
  MOVES_FAST = Array.isArray(data?.fast) ? data.fast : [];
  MOVES_CHARGED = Array.isArray(data?.charged) ? data.charged : [];

  MOVE_BY_ID.clear();
  MOVE_BY_NORMNAME.clear();

  const put = (m) => {
    const id = String(m?.id || "").trim();
    if(!id) return;
    MOVE_BY_ID.set(id, m);
    MOVE_BY_ID.set(id.toLowerCase(), m);

    const name = String(m?.[UI_LANG] || m?.es_419 || m?.es_ES || m?.en || "").trim();
    if(name) MOVE_BY_NORMNAME.set(normName(name), m);
  };

  MOVES_FAST.forEach(put);
  MOVES_CHARGED.forEach(put);
}

function splitListLower(v){
  if(Array.isArray(v)){
    return v.map(x => String(x||"").trim().toLowerCase()).filter(Boolean);
  }
  return String(v||"")
    .split(",")
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
}

function splitDexList(str){
  return String(str||"")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => Number(x))
    .filter(n => Number.isFinite(n) && n > 0);
}

function splitTokens(v){
  if(Array.isArray(v)){
    return v.map(x => String(x||"").trim()).filter(Boolean);
  }
  return String(v||"")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function splitDexAndIds(str){
  const dex = new Set();
  const ids = new Set();
  splitTokens(str).forEach(tok => {
    if (/^\d+$/.test(tok)) dex.add(Number(tok));
    else ids.add(String(tok).toLowerCase());
  });
  return { dex, ids };
}

// ===============================
// NORMALIZADORES (categorías / etiquetas)
// ===============================
function normToken(s){
  return String(s||"").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,""); 
}

function normCategoryToken(tok){
  const t = normToken(tok);
  const map = {
    "oscuro":"shadow","shadow":"shadow",
    "purificado":"purified","purified":"purified",
    "shiny":"shiny","brillante":"shiny",
    "dinamax":"dynamax","dynamax":"dynamax",
    "gigamax":"gigamax","gigantamax":"gigamax",
    "mega":"mega",
    "normal":"normal",
    "bebe":"baby","baby":"baby",
    "legendario":"legendary","legendary":"legendary",
    "mitico":"mythical","mythical":"mythical"
  };
  return map[t] || t;
}

function splitCategorySet(str){
  return new Set(
    splitTokens(str).map(normCategoryToken).filter(Boolean)
  );
}

function variantLabel(key, megaIndex){
  switch(key){
    case "shadow": return "Shadow";
    case "purified": return "Purificado";
    case "shiny": return "Shiny";
    case "dynamax": return "Dynamax";
    case "gigamax": return "Gigamax";
    case "mega": return megaIndex ? `Mega ${megaIndex}` : "Mega";
    default: return key || "";
  }
}

function makeLabel(name, tag){
  return tag ? `${name} — ${tag}` : `${name}`;
}

function baseNameFromInput(raw){
  let s = String(raw||"").trim();
  if(!s) return "";
  s = s.replace(/^(\d{1,4})\s*-\s*/,"");
  s = s.replace(/\s*\([^)]*\)\s*$/,"").trim();
  s = s.split(/\s[-—]\s/)[0].trim();
  return s;
}

function pokeDisplayName(p){
  return p?.name?.es_419 || p?.name?.es_ES || p?.name?.en || `#${p?.dex || ""}`;
}

function firstRelMatch(p, re){
  const rel = Array.isArray(p?.uicons?.relevantIconIds) ? p.uicons.relevantIconIds.map(String) : [];
  const hit = rel.find(x => re.test(String(x)));
  return hit ? String(hit) : null;
}

function buildVariantOptionsForPokemon(p){
  const dex = Number(p.dex);
  if(!dex) return [];

  const name = pokeDisplayName(p);
  const rec  = p?.uicons?.recommended || {};
  const options = [];

  // ---------- BASE (forma principal) ----------
  const normalId = String(rec.normal || dex);
  options.push({ id: normalId, dex, label: makeLabel(name, ""), variantKey: "" });

  const shadowId   = String(rec.shadow   || firstRelMatch(p, new RegExp(`^${dex}_a1\\b`)) || "");
  const purifiedId = String(rec.purified || firstRelMatch(p, new RegExp(`^${dex}_a2\\b`)) || "");

  if(shadowId && shadowId !== "undefined" && shadowId !== "null"){
    options.push({ id: shadowId, dex, label: makeLabel(name, variantLabel("shadow")), variantKey: "shadow" });
  }
  if(purifiedId && purifiedId !== "undefined" && purifiedId !== "null"){
    options.push({ id: purifiedId, dex, label: makeLabel(name, variantLabel("purified")), variantKey: "purified" });
  }

  const shinyId =
    (rec.shiny ? String(rec.shiny) : "") ||
    firstRelMatch(p, new RegExp(`^${dex}_s$`)) ||
    firstRelMatch(p, new RegExp(`^${dex}_.+_s$`)) ||
    "";

  if(shinyId && shinyId !== "undefined" && shinyId !== "null"){
    options.push({ id: String(shinyId), dex, label: makeLabel(name, variantLabel("shiny")), variantKey: "shiny" });
  }

  const dmaxId = String(rec.dynamax || firstRelMatch(p, new RegExp(`^${dex}_b1\\b`)) || "");
  if(dmaxId && dmaxId !== "undefined" && dmaxId !== "null"){
    options.push({ id: dmaxId, dex, label: makeLabel(name, variantLabel("dynamax")), variantKey: "dynamax" });
  }

  const gmaxId = String(rec.gigamax || "");
  if(gmaxId && gmaxId !== "undefined" && gmaxId !== "null"){
    options.push({ id: gmaxId, dex, label: makeLabel(name, variantLabel("gigamax")), variantKey: "gigamax" });
  }

  const megaArr = Array.isArray(rec.mega) ? rec.mega : [];
  megaArr.forEach((mid, idx) => {
    if(!mid) return;
    const id = String(mid);
    const n = idx + 1;
    options.push({ id, dex, label: makeLabel(name, variantLabel("mega", n)), variantKey: "mega" });
  });

  // ---------- FORMAS REGIONALES (Alola, Galar, Hisui, Paldea...) ----------
  const forms = Array.isArray(p.forms) ? p.forms : [];
  forms.forEach(f => {
    if(!f) return;

    const region = String(f.region || "").trim();
    const fRec = f.recommended || {};

    const baseName = region ? `${name} · ${region}` : name;
    const formTag = region || "regional";

    const fNormal = String(fRec.normal || f.uicon || "");
    if(fNormal && fNormal !== "undefined" && fNormal !== "null"){
      options.push({ id: fNormal, dex, label: makeLabel(baseName, ""), variantKey: "", formRegion: formTag });
    }

    const fShadow = String(fRec.shadow || "");
    if(fShadow && fShadow !== "undefined" && fShadow !== "null"){
      options.push({ id: fShadow, dex, label: makeLabel(baseName, variantLabel("shadow")), variantKey: "shadow", formRegion: formTag });
    }

    const fPurified = String(fRec.purified || "");
    if(fPurified && fPurified !== "undefined" && fPurified !== "null"){
      options.push({ id: fPurified, dex, label: makeLabel(baseName, variantLabel("purified")), variantKey: "purified", formRegion: formTag });
    }

    const fShiny = String(fRec.shiny || "");
    if(fShiny && fShiny !== "undefined" && fShiny !== "null"){
      options.push({ id: fShiny, dex, label: makeLabel(baseName, variantLabel("shiny")), variantKey: "shiny", formRegion: formTag });
    }

    const fDmax = String(fRec.dynamax || "");
    if(fDmax && fDmax !== "undefined" && fDmax !== "null"){
      options.push({ id: fDmax, dex, label: makeLabel(baseName, variantLabel("dynamax")), variantKey: "dynamax", formRegion: formTag });
    }

    const fGmax = String(fRec.gigamax || "");
    if(fGmax && fGmax !== "undefined" && fGmax !== "null"){
      options.push({ id: fGmax, dex, label: makeLabel(baseName, variantLabel("gigamax")), variantKey: "gigamax", formRegion: formTag });
    }

    const fMegaArr = Array.isArray(fRec.mega) ? fRec.mega : [];
    fMegaArr.forEach((mid, idx) => {
      if(!mid) return;
      const id = String(mid);
      const n = idx + 1;
      options.push({ id, dex, label: makeLabel(baseName, variantLabel("mega", n)), variantKey: "mega", formRegion: formTag });
    });
  });

  // quitar duplicados por id
  const seen = new Set();
  return options.filter(o => {
    const k = String(o.id).toLowerCase();
    if(seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildAllowedOptions(t){
  const bannedTypes = new Set(splitListLower(t.bannedTypes));
  const bannedCats  = splitCategorySet(t.bannedCategories);

  const banned = splitDexAndIds(t.bannedPokemon);
  const allow  = splitDexAndIds(t.allowedPokemon);

  const out = [];
  const allowedDexSet = new Set();

  for (const p of POKEMON_DB){
    const dex = Number(p.dex);
    if(!dex) continue;

    const cat = normCategoryToken(p.category);
    const types = Array.isArray(p.types) ? p.types.map(x => String(x).toLowerCase()) : [];

    const baseCatBanned = (cat && bannedCats.has(cat));
    const typeBanned = types.some(tp => bannedTypes.has(tp));
    const dexBanned = banned.dex.has(dex);

    const options = buildVariantOptionsForPokemon(p);

    for(const o of options){
      const idLower = String(o.id).toLowerCase();
      const allowedByDexNormal = allow.dex.has(dex) && (o.variantKey === "");
      const allowedById = allow.ids.has(idLower);

      if(allowedByDexNormal || allowedById){
        out.push(o);
        allowedDexSet.add(dex);
        continue;
      }

      if(dexBanned) continue;
      if(banned.ids.has(idLower)) continue;
      if(baseCatBanned) continue;
      if(o.variantKey && bannedCats.has(normCategoryToken(o.variantKey))) continue;
      if(typeBanned) continue;

      out.push(o);
      allowedDexSet.add(dex);
    }
  }

  allow.dex.forEach(dx => allowedDexSet.add(dx));
  return { options: out, allowedDexSet };
}

function fillPokemonDatalist(options){
  const dl = document.getElementById("pokemonList");
  if (!dl) return;

  const order = { "":0, shadow:1, purified:2, shiny:3, dynamax:4, gigamax:5, mega:6 };

  const opts = (Array.isArray(options) ? options : []).slice();
  CURRENT_ALLOWED_OPTIONS_SORTED = opts;

  opts.sort((a,b) => {
    const d = Number(a.dex) - Number(b.dex);
    if(d !== 0) return d;
    return (order[a.variantKey || ""] ?? 99) - (order[b.variantKey || ""] ?? 99);
  });

  CURRENT_ALLOWED_OPTIONS_ALL = opts.slice();

  CURRENT_ALLOWED_OPTION_SET = new Set();
  CURRENT_ALLOWED_ID_SET = new Set();
  POKE_OPTION_LABEL_BY_ID = new Map();
  POKE_OPT_BY_LABEL = new Map();
  DEFAULT_LABEL_BY_DEX = new Map();

  dl.innerHTML = opts.map(o => {
    const labelRaw = String(o.label || "");
    const labelEsc = labelRaw.replace(/"/g,"&quot;");
    const idLower = String(o.id || "").toLowerCase();

    CURRENT_ALLOWED_OPTION_SET.add(labelRaw);
    CURRENT_ALLOWED_ID_SET.add(idLower);

    POKE_OPTION_LABEL_BY_ID.set(idLower, labelRaw);
    POKE_OPT_BY_LABEL.set(labelRaw, { ...o });

    if((o.variantKey || "") === "" && !DEFAULT_LABEL_BY_DEX.has(Number(o.dex))){
      DEFAULT_LABEL_BY_DEX.set(Number(o.dex), labelRaw);
    }

    return `<option value="${labelEsc}"></option>`;
  }).join("");
}

// ===============================
// ✅ Dropdown custom Pokémon (bonito)
// ===============================
function pokeLabelParts_(labelRaw){
  let s = String(labelRaw || "").trim();
  s = s.replace(/^(\d{1,4})\s*-\s*/, "");
  if (s.includes("—")) {
    const [a,b] = s.split("—");
    return { name: (a||"").trim(), tag: (b||"").trim() };
  }
  const m = s.match(/^(.*)\s-\s(Shadow|Purificado|Shiny|Dynamax|Gigamax|Mega.*)$/i);
  if(m) return { name: (m[1]||"").trim(), tag: (m[2]||"").trim() };
  return { name: s.trim(), tag: "" };
}

function getDropElForInput_(inputEl){
  const id = inputEl?.dataset?.drop;
  return id ? document.getElementById(id) : null;
}

function hidePokeDropdown_(inputEl){
  const d = getDropElForInput_(inputEl);
  if(!d) return;
  d.style.display = "none";
  d.innerHTML = "";
  delete d.dataset.activeIndex;
}

function hideAllPokeDropdowns_(){
  document.querySelectorAll(".poke-dropdown").forEach(d => {
    d.style.display = "none";
    d.innerHTML = "";
    delete d.dataset.activeIndex;
  });
}

function setActivePokeItem_(dropEl, idx){
  const items = dropEl.querySelectorAll(".poke-item");
  const max = items.length;
  if(!max) return;

  let i = Number(idx);
  if(!Number.isFinite(i)) i = 0;
  if(i < 0) i = 0;
  if(i > max - 1) i = max - 1;

  items.forEach(x => x.classList.remove("is-active"));
  const it = items[i];
  if(it){
    it.classList.add("is-active");
    it.scrollIntoView({ block: "nearest" });
  }
  dropEl.dataset.activeIndex = String(i);
}

function renderPokeDropdown_(inputEl){
  const dropEl = getDropElForInput_(inputEl);
  if(!dropEl) return;

  const q0 = String(inputEl.value || "").trim();
  const q = normName(q0.replace(/^(\d{1,4})\s*-\s*/, "")).trim();

  const src = Array.isArray(CURRENT_ALLOWED_OPTIONS_SORTED) ? CURRENT_ALLOWED_OPTIONS_SORTED : [];
  const list = [];

  const activeId = String(inputEl?.id || "");
  const chosen = getChosenDexSetExcept_(activeId);

  for(const o of src){
    const dx = Number(o?.dex);
    if(dx && chosen.has(dx)) continue;

    const label = String(o?.label || "").trim();
    if(!label) continue;

    const { name, tag } = pokeLabelParts_(label);
    const hay = normName(`${name} ${tag}`).trim();

    if(!q || hay.includes(q)) {
      list.push({ label, name, tag });
      if(list.length >= 60) break;
    }
  }

  if(!list.length){
    hidePokeDropdown_(inputEl);
    return;
  }

  dropEl.innerHTML = list.map((it, idx) => {
    const enc = encodeURIComponent(it.label);
    return `
      <div class="poke-item" data-label="${enc}" data-idx="${idx}">
        <span class="poke-name">${escapeHtml(it.name)}</span>
        <span class="poke-muted">${escapeHtml(it.tag)}</span>
      </div>
    `;
  }).join("");

  dropEl.style.display = "block";
  setActivePokeItem_(dropEl, 0);
}

function pickActivePokeItem_(inputEl){
  const dropEl = getDropElForInput_(inputEl);
  if(!dropEl || dropEl.style.display === "none") return false;

  const idx = Number(dropEl.dataset.activeIndex || 0);
  const it = dropEl.querySelector(`.poke-item[data-idx="${idx}"]`) || dropEl.querySelector(".poke-item");
  if(!it) return false;

  const label = decodeURIComponent(it.dataset.label || "");
  if(!label) return false;

  inputEl.value = label; 
  hidePokeDropdown_(inputEl);
  inputEl.dispatchEvent(new Event("change"));
  return true;
}

function resetModalForm(){
  ["nombre","nick","codigo","campfire","p1","p2","p3","p4","p5","p6"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      delete el.dataset.dex;
      delete el.dataset.pid;
      if(typeof modalClearMultiLeagueState_ === "function") modalClearMultiLeagueState_();
    }
  });

  ["p1","p2","p3","p4","p5","p6"].forEach(id => {
    const img = document.getElementById(id + "img");
    if (img) {
      img.removeAttribute("src");
      img.alt = "";
      img.style.visibility = "hidden";
    }
  });

  const btn = document.getElementById("btnRegister");
  if (btn){
    btn.dataset.sending = "0";
    btn.disabled = false;
    btn.textContent = "Enviar registro";
  }
}

function parseDexFromInput(v){
  const s = String(v||"").trim();
  if(!s) return null;
  const m = s.match(/^(\d{1,4})\b/);
  if(m) return Number(m[1]);
  const base = baseNameFromInput(s);
  const dx = POKE_BY_NAME.get(normName(base));
  return dx ? Number(dx) : null;
}

function getChosenDexSetExcept_(exceptId){
  const set = new Set();
  ["p1","p2","p3","p4","p5","p6"].forEach(id => {
    if(id === exceptId) return;
    const el = document.getElementById(id);
    if(!el) return;
    const dx = Number(el.dataset.dex) || parseDexFromInput(el.value);
    if(dx) set.add(Number(dx));
  });
  return set;
}

function renderPokemonDatalistView_(optsView){
  const dl = document.getElementById("pokemonList");
  if(!dl) return;
  dl.innerHTML = (Array.isArray(optsView) ? optsView : []).map(o => {
    const labelRaw = String(o?.label || "");
    const labelEsc = labelRaw.replace(/"/g,"&quot;");
    return `<option value="${labelEsc}"></option>`;
  }).join("");
}

function refreshPokemonDatalistForSlot_(activeId){
  if(!Array.isArray(CURRENT_ALLOWED_OPTIONS_ALL) || !CURRENT_ALLOWED_OPTIONS_ALL.length) return;
  const chosen = getChosenDexSetExcept_(activeId);
  const view = CURRENT_ALLOWED_OPTIONS_ALL.filter(o => !chosen.has(Number(o.dex)));
  renderPokemonDatalistView_(view);
}

function lockInputsToAllowed(allowedDexSet){
  CURRENT_ALLOWED_DEX_SET = allowedDexSet;
  hideAllPokeDropdowns_();

  const ids = ["p1","p2","p3","p4","p5","p6"];

  const clearField = (id) => {
    const el = document.getElementById(id);
    const img = document.getElementById(id + "img");
    if (!el) return;
    el.value = "";
    delete el.dataset.dex;
    delete el.dataset.pid;
    if (img) {
      img.removeAttribute("src");
      img.alt = "";
      img.style.visibility = "hidden";
    }
  };

  const applyOption = (id, opt) => {
    const el = document.getElementById(id);
    const img = document.getElementById(id + "img");
    if(!el) return false;

    const dex = Number(opt.dex);
    const optId = String(opt.id || "");

    if(!dex || !CURRENT_ALLOWED_DEX_SET?.has(dex) || !optId) return false;

    const chosen = new Set();
    ids.forEach(x => {
      if(x === id) return;
      const other = document.getElementById(x);
      const dx = Number(other?.dataset?.dex);
      if(dx) chosen.add(dx);
    });
    if(chosen.has(dex)){
      showToast("⚠ No puedes repetir el mismo Pokémon");
      clearField(id);
      return false;
    }

    el.value = opt.label;
    el.dataset.dex = String(dex);
    el.dataset.pid = optId;
    hideAllPokeDropdowns_();

    if(img){
      img.onerror = () => {
        img.removeAttribute("src");
        img.style.visibility = "hidden";
      };
      img.src = iconUrl(optId);
      img.alt = pokeDisplayName(POKE_BY_DEX.get(dex));
      img.style.visibility = "visible";
    }
    return true;
  };

  ids.forEach(pid => {
    const el = document.getElementById(pid);
    const img = document.getElementById(pid + "img");
    if (!el) return;

    el.setAttribute("autocomplete","off");
    el.setAttribute("autocorrect","off");
    el.setAttribute("autocapitalize","none");
    el.setAttribute("spellcheck","false");
    el.setAttribute("name", `poke_${pid}_${SELECTED_ID || "t"}`);

    const v = (el.value || "").trim();
    const opt = POKE_OPT_BY_LABEL.get(v);

    if(opt){
      applyOption(pid, opt);
      return;
    }

    const dex = parseDexFromInput(v);
    if(dex && CURRENT_ALLOWED_DEX_SET?.has(dex)){
      const defLabel = DEFAULT_LABEL_BY_DEX.get(dex);
      const defOpt = defLabel ? POKE_OPT_BY_LABEL.get(defLabel) : null;
      if(defOpt){
        applyOption(pid, defOpt);
        return;
      }
    }

    if(img){
      img.removeAttribute("src");
      img.alt = "";
      img.style.visibility = "hidden";
    }
    delete el.dataset.dex;
    delete el.dataset.pid;
  });

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (el.dataset.boundPoke === "1") return;
    el.dataset.boundPoke = "1";
    el.addEventListener("focus", () => {
      refreshPokemonDatalistForSlot_(id);
    });

    const dropEl = getDropElForInput_(el);
    if(dropEl && dropEl.dataset.boundDrop !== "1"){
      dropEl.dataset.boundDrop = "1";
      dropEl.addEventListener("mousedown", (ev) => {
        const item = ev.target.closest(".poke-item");
        if(!item) return;
        ev.preventDefault();
        const label = decodeURIComponent(item.dataset.label || "");
        if(!label) return;
        el.value = label;
        hidePokeDropdown_(el);
        el.dispatchEvent(new Event("change"));
      });
    }

    el.addEventListener("focus", () => {
      hideAllPokeDropdowns_();
      renderPokeDropdown_(el);
    });

    el.addEventListener("keydown", (ev) => {
      const drop = getDropElForInput_(el);
      const open = drop && drop.style.display !== "none";

      if(ev.key === "Escape"){
        hidePokeDropdown_(el);
        return;
      }

      if(ev.key === "ArrowDown" || ev.key === "ArrowUp"){
        ev.preventDefault();
        if(!open) renderPokeDropdown_(el);
        const d = getDropElForInput_(el);
        if(!d) return;
        const items = d.querySelectorAll(".poke-item");
        if(!items.length) return;
        const cur = Number(d.dataset.activeIndex || 0);
        const next = (ev.key === "ArrowDown") ? cur + 1 : cur - 1;
        setActivePokeItem_(d, next);
        return;
      }

      if(ev.key === "Enter"){
        if(open){
          ev.preventDefault();
          pickActivePokeItem_(el);
        }
      }
    });

    el.addEventListener("input", () => {
      const v = el.value.trim();
      if (!v) clearField(id);
      if (el.dataset.dex || el.dataset.pid) {
        delete el.dataset.dex;
        delete el.dataset.pid;
        const img = document.getElementById(id + "img");
        if (img) {
          img.removeAttribute("src");
          img.alt = "";
          img.style.visibility = "hidden";
        }
      }
      if(v){
        renderPokeDropdown_(el);
      }else{
        hidePokeDropdown_(el);
      }
    });

    el.addEventListener("change", () => {
      const v = el.value.trim();
      if (!v) { clearField(id); return; }

      if (CURRENT_ALLOWED_OPTION_SET.has(v)) {
        const opt = POKE_OPT_BY_LABEL.get(v);
        if(opt) return applyOption(id, opt);
      }

      const dex = parseDexFromInput(v);
      if(dex && !CURRENT_ALLOWED_DEX_SET?.has(dex)){
        showToast("⚠ Ese Pokémon no está permitido en este torneo");
        clearField(id);
        return;
      }

      if(dex && CURRENT_ALLOWED_DEX_SET?.has(dex)){
        const defLabel = DEFAULT_LABEL_BY_DEX.get(dex);
        const defOpt = defLabel ? POKE_OPT_BY_LABEL.get(defLabel) : null;
        if(defOpt) return applyOption(id, defOpt);
      }

      showToast("⚠ Elige el Pokémon desde la lista");
      clearField(id);
    });

    el.addEventListener("blur", () => {
      const v = el.value.trim();
      if (!v) return;
      if (!el.dataset.dex) {
        el.dispatchEvent(new Event("change"));
      }
    });
    setTimeout(() => hidePokeDropdown_(el), 120);
  });
}

// ===============================
// ✅ MULTI-LIGA EN MODAL (leagueRulesJson)
// ===============================
let MODAL_RULES_OBJ = null;              
let MODAL_LEAGUE_KEYS = [];              
let MODAL_ACTIVE_LEAGUE_KEY = "";        
let MODAL_MULTI_TORNEO_ID = "";          
const MODAL_PICKS_BY_LEAGUE = new Map(); 
let RULES_ACTIVE_LEAGUE_KEY = "";   
let RULES_MULTI_TORNEO_ID = "";      
let RULES_PREP_TORNEO_ID = "";
let RULES_PREP_WAS_ACTIVE = false;
let MODAL_JUST_OPENED = false;           
const MODAL_LEAGUE_CACHE = new Map(); 

function setPokemonInputsDisabled_(disabled){
  ["p1","p2","p3","p4","p5","p6"].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.disabled = !!disabled;
  });
}

function safeJsonParse_(raw){
  if(!raw) return null;
  try{
    if(typeof raw === "object") return raw;
    return JSON.parse(String(raw));
  }catch(_){
    return null;
  }
}

function getPerLeagueRules_(t){
  const obj = safeJsonParse_(t?.leagueRulesJson);
  if(!obj || typeof obj !== "object") return null;
  if(String(obj.mode||"").toLowerCase() !== "perleague") return null;
  const leagues = obj.leagues;
  if(!leagues || typeof leagues !== "object") return null;
  const keys = Object.keys(leagues);
  if(!keys.length) return null;
  return obj;
}

function leagueCpFromLeagueKey_(leagueKey){
  const s = String(leagueKey||"").toLowerCase();
  if(s.includes("master") || s === "ml" || s.includes("masterleague")) return "9000";
  const m = s.match(/(500|1500|2500|9000)/);
  if(m) return m[1];
  const m2 = s.match(/(\d{3,5})/);
  return m2 ? m2[1] : "";
}

function resetPokemonPickFieldsOnly_(){
  ["p1","p2","p3","p4","p5","p6"].forEach(id => {
    const el = document.getElementById(id);
    const img = document.getElementById(id + "img");
    if(el){
      el.value = "";
      delete el.dataset.dex;
      delete el.dataset.pid;
      refreshPokemonDatalistForSlot_(document.activeElement?.id || id);
    }
    if(img){
      img.removeAttribute("src");
      img.alt = "";
      img.style.visibility = "hidden";
    }
  });
}

function modalGetPidFromInputId_(id){
  const el = document.getElementById(id);
  if(!el) return "";
  const pid = String(el.dataset.pid || "").trim();
  if(pid) return pid;
  const opt = POKE_OPT_BY_LABEL.get(String(el.value||"").trim());
  if(opt?.id) return String(opt.id);
  const dx = parseDexFromInput(el.value);
  return dx ? String(dx) : "";
}

function modalSaveCurrentLeaguePicks_(){
  if(!MODAL_ACTIVE_LEAGUE_KEY) return;
  ["p1","p2","p3","p4","p5","p6"].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    const v = String(el.value || "").trim();
    if(v && !el.dataset.pid && !el.dataset.dex){
      el.dispatchEvent(new Event("change"));
    }
  });
  const pids = ["p1","p2","p3","p4","p5","p6"].map(id => modalGetPidFromInputId_(id));
  MODAL_PICKS_BY_LEAGUE.set(MODAL_ACTIVE_LEAGUE_KEY, pids);
}

function modalSetLeagueHint_(leagueKey){
  const hint = document.getElementById("modalLeagueHint");
  if(!hint) return;
  const cp = leagueCpFromLeagueKey_(leagueKey); 
  if(!cp){
    hint.textContent = "Selecciona tus 6 Pokémon para la liga";
    return;
  }
  const badgeText = (cp === "9000") ? "LIGA MASTER" : `LIGA ${cp}`;
  hint.innerHTML = `Selecciona tus 6 Pokémon para la <span class="league-hint-badge league-hint-badge--${cp}">${badgeText}</span>`;
}

function modalRenderLeagueButtons_(){
  const wrap = document.getElementById("modalLeagueSwitch");
  const box  = document.getElementById("modalLeagueBtns");
  if(!wrap || !box) return;

  if(!MODAL_RULES_OBJ || !MODAL_LEAGUE_KEYS.length){
    wrap.style.display = "none";
    box.innerHTML = "";
    return;
  }

  wrap.style.display = "block";

  box.innerHTML = MODAL_LEAGUE_KEYS.map(k => {
    const cp = leagueCpFromLeagueKey_(k);
    const active = (k === MODAL_ACTIVE_LEAGUE_KEY) ? " is-active" : "";
    const label = cp ? (cp === "9000" ? "Liga Master" : `Liga ${cp}`) : k;
    const local = cp ? `${LEAGUE_ICON_LOCAL}${cp}.png` : "";
    const remote = cp ? `${LEAGUE_ICON_REMOTE}${cp}.png` : "";
    const img = cp
      ? `<img class="league-switch-logo" src="${escapeHtml(local)}" alt=""
           onerror="this.onerror=null;this.src='${escapeHtml(remote)}'">`
      : "";

    return `<button type="button" class="league-switch-btn${active}" data-league="${escapeHtml(k)}">
      ${img}
      <span class="league-switch-text">${escapeHtml(label)}</span>
    </button>`;
  }).join("");

  box.querySelectorAll("button[data-league]").forEach(btn => {
    btn.onclick = () => {
      const key = btn.getAttribute("data-league");
      if(!key || key === MODAL_ACTIVE_LEAGUE_KEY) return;
      modalSaveCurrentLeaguePicks_();
      MODAL_ACTIVE_LEAGUE_KEY = key;
      modalRenderLeagueButtons_();
      modalSetLeagueHint_(key);
      const t = TORNEOS.find(x => x.torneoId === SELECTED_ID) || TORNEOS[0];
      if(!t) return;
      modalApplyLeagueRules_(t, MODAL_RULES_OBJ, key);
    };
  });
  modalSetLeagueHint_(MODAL_ACTIVE_LEAGUE_KEY);
}

function buildAllowedOptionsFromRules(rule){
  const bannedTypes  = new Set(splitListLower(rule?.bannedTypes));
  const allowedTypes = new Set(splitListLower(rule?.allowedTypes));
  const bannedCats   = splitCategorySet(rule?.bannedCategories);
  const allowedCats  = splitCategorySet(rule?.allowedCategories);
  const banned = splitDexAndIds(rule?.bannedPokemon);
  const allow  = splitDexAndIds(rule?.allowedPokemon);

  const out = [];
  const allowedDexSet = new Set();

  for (const p of POKEMON_DB){
    const dex = Number(p.dex);
    if(!dex) continue;

    const baseCat = normCategoryToken(p.category);
    const types = Array.isArray(p.types) ? p.types.map(x => String(x).toLowerCase()) : [];
    const baseCatBanned = (baseCat && bannedCats.has(baseCat));
    const baseCatAllowed = (allowedCats.size === 0) ? true : (baseCat ? allowedCats.has(baseCat) : true);
    const typeHasAllowed = (allowedTypes.size === 0) ? true : types.some(tp => allowedTypes.has(tp));
    const typeBanned = (bannedTypes.size === 0) ? false : types.some(tp => bannedTypes.has(tp));
    const dexBanned = banned.dex.has(dex);

    const options = buildVariantOptionsForPokemon(p);

    for(const o of options){
      const idLower = String(o.id).toLowerCase();
      const allowedByDexNormal = allow.dex.has(dex) && (o.variantKey === "");
      const allowedById = allow.ids.has(idLower);

      if(allowedByDexNormal || allowedById){
        out.push(o);
        allowedDexSet.add(dex);
        continue;
      }

      if(dexBanned) continue;
      if(banned.ids.has(idLower)) continue;
      if(baseCatBanned) continue;
      const vTok = normCategoryToken(o.variantKey);
      if(o.variantKey && bannedCats.has(vTok)) continue;
      if(!baseCatAllowed) continue;
      if(o.variantKey && allowedCats.size && !allowedCats.has(vTok)) continue;
      if(!typeHasAllowed) continue;
      if(typeBanned) continue;

      out.push(o);
      allowedDexSet.add(dex);
    }
  }
  allow.dex.forEach(dx => allowedDexSet.add(dx));
  return { options: out, allowedDexSet };
}

function modalApplyLeagueRules_(t, rulesObj, leagueKey, preserveInputs=false){
  const rule = (rulesObj?.leagues && rulesObj.leagues[leagueKey]) ? rulesObj.leagues[leagueKey] : {};
  let cached = MODAL_LEAGUE_CACHE.get(leagueKey);

  if(!cached){
    setPokemonInputsDisabled_(true);
    cached = buildAllowedOptionsFromRules(rule);
    MODAL_LEAGUE_CACHE.set(leagueKey, cached);
    setPokemonInputsDisabled_(false);
  }

  fillPokemonDatalist(cached.options);
  lockInputsToAllowed(cached.allowedDexSet);

  if(preserveInputs) return;

  resetPokemonPickFieldsOnly_();
  const saved = MODAL_PICKS_BY_LEAGUE.get(leagueKey);
  if(Array.isArray(saved) && saved.length === 6){
    saved.forEach((pid, i) => {
      const cleanPid = String(pid||"").trim();
      if(!cleanPid) return;
      const label = POKE_OPTION_LABEL_BY_ID.get(cleanPid.toLowerCase()) || cleanPid;
      const el = document.getElementById(`p${i+1}`);
      if(!el) return;
      el.value = label;
      el.dispatchEvent(new Event("change"));
    });
  }
}

function modalClearMultiLeagueState_(){
  MODAL_RULES_OBJ = null;
  MODAL_LEAGUE_KEYS = [];
  MODAL_ACTIVE_LEAGUE_KEY = "";
  MODAL_MULTI_TORNEO_ID = "";
  MODAL_PICKS_BY_LEAGUE.clear();
  MODAL_LEAGUE_CACHE.clear(); 

  const wrap = document.getElementById("modalLeagueSwitch");
  const box  = document.getElementById("modalLeagueBtns");
  const hint = document.getElementById("modalLeagueHint");

  if(wrap) wrap.style.display = "none";
  if(box) box.innerHTML = "";
  if(hint) hint.textContent = "";
}

async function setupModalPokemonFilterForSelectedTournament(){
  await loadPokemonDB();
  const t = TORNEOS.find(x => x.torneoId === SELECTED_ID) || TORNEOS[0];
  if (!t) return;

  const rules = getPerLeagueRules_(t);
  const keys = rules ? Object.keys(rules.leagues || {}) : [];
  const isMulti = !!rules && keys.length > 1;

  if(isMulti){
    MODAL_RULES_OBJ = rules;
    if(MODAL_MULTI_TORNEO_ID !== t.torneoId){
      MODAL_MULTI_TORNEO_ID = t.torneoId;
      MODAL_PICKS_BY_LEAGUE.clear();
      MODAL_LEAGUE_KEYS = keys;
      MODAL_ACTIVE_LEAGUE_KEY = keys[0] || "";
    }else{
      MODAL_LEAGUE_KEYS = keys;
      if(!MODAL_ACTIVE_LEAGUE_KEY || !rules.leagues[MODAL_ACTIVE_LEAGUE_KEY]){
        MODAL_ACTIVE_LEAGUE_KEY = keys[0] || "";
      }
    }
    modalRenderLeagueButtons_();
    const preserve = isModalOpen() && (MODAL_MULTI_TORNEO_ID === t.torneoId) && !MODAL_JUST_OPENED;
    modalApplyLeagueRules_(t, rules, MODAL_ACTIVE_LEAGUE_KEY, preserve);
    MODAL_JUST_OPENED = false;
    return;
  }

  MODAL_JUST_OPENED = false;
  modalClearMultiLeagueState_();
  const { options, allowedDexSet } = buildAllowedOptions(t);
  fillPokemonDatalist(options);
  lockInputsToAllowed(allowedDexSet);
}

/* Toast */
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function isTrue(v){
  const s = String(v||"").trim().toLowerCase();
  return s === "true" || s === "verdadero" || s === "1" || s === "si" || s === "sí" || s === "TRUE".toLowerCase();
}

function isPresencialMode_(t){
  const m = String(t?.mode ?? t?.Mode ?? "").trim().toLowerCase();
  return m === "presencial";
}
function getTablesCount_(t){
  const raw = (t?.tablesCount ?? t?.TablesCount ?? t?.mesas ?? t?.Mesas ?? 0);
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}
function hasMainStage_(t){
  return String(t?.hasMainStage ?? t?.HasMainStage ?? t?.mainStage ?? t?.MainStage ?? "").trim().toUpperCase() === "TRUE";
}
function getSimulCapacity_(t){
  const tables = getTablesCount_(t);
  return tables + (hasMainStage_(t) ? 1 : 0);
}

function getMatchOpStatus_(m){
  return String(m?.MatchStatus ?? m?.matchStatus ?? "").trim().toLowerCase();
}
function getMatchLocationType_(m){
  return String(m?.LocationType ?? m?.locationType ?? "").trim().toLowerCase();
}
function getMatchLocationText_(m){
  const raw = (m?.Location ?? m?.location ?? "");
  const type = getMatchLocationType_(m);
  let text = "";
  if(raw && typeof raw === "object"){
    text = String(raw.name || raw.label || "").trim();
  }else{
    text = String(raw || "").trim();
  }
  if(!text && type === "main") text = "Escenario Principal";
  return text;
}

function isMainLocation_(m){
  const type = String(getMatchLocationType_(m) || "").toLowerCase();
  const text = String(getMatchLocationText_(m) || "");
  return (type === "main") || /escenario|main|stage/i.test(text);
}

function renderMesaChip_(m){
  const text = getMatchLocationText_(m);
  if(!text) return "";
  let type = getMatchLocationType_(m);
  if(!type){
    if(/escenario|main|stage/i.test(text)) type = "main";
  }
  const isMain = (type === "main");
  const icon = isMain ? "🎤" : "🪑";
  const cls  = isMain ? "battle-mesa-chip battle-mesa-chip--main" : "battle-mesa-chip";
  return `<span class="${cls}">${icon} ${escapeHtml(text)}</span>`;
}

function parseMesaNumber_(txt){
  const s = String(txt || "");
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 9999;
}
function locationSortKey_(m){
  const text = getMatchLocationText_(m);
  const type = getMatchLocationType_(m);
  const isMain = (type === "main") || /escenario|main|stage/i.test(text);
  const num = parseMesaNumber_(text);
  return [isMain ? 0 : 1, num, String(text || "").toLowerCase()];
}
function sortByLocation_(a,b){
  const ak = locationSortKey_(a);
  const bk = locationSortKey_(b);
  return (ak[0]-bk[0]) || (ak[1]-bk[1]) || ak[2].localeCompare(bk[2]);
}
function getOrderedLocations_(matches){
  const map = new Map();
  (matches || []).forEach(m=>{
    const text = getMatchLocationText_(m);
    if(!text) return;
    if(!map.has(text)){
      map.set(text, { text, type: getMatchLocationType_(m) });
    }
  });
  return Array.from(map.values()).sort((a,b)=>{
    const am = (String(a.type).toLowerCase() === "main" || /escenario|main|stage/i.test(a.text)) ? 0 : 1;
    const bm = (String(b.type).toLowerCase() === "main" || /escenario|main|stage/i.test(b.text)) ? 0 : 1;
    const an = parseMesaNumber_(a.text);
    const bn = parseMesaNumber_(b.text);
    return (am-bm) || (an-bn) || String(a.text).localeCompare(String(b.text));
  });
}

function fmtDateTimeHuman(dt){
  if(!dt) return "-";
  let d = null;
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(dt)) d = new Date(dt.replace(" ", "T"));
  else d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleString("es-PE", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function fmtDateParts(dt){
  if(!dt) return { date: "-", time: "-", raw: "-" };
  let d = null;
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(dt)) d = new Date(dt.replace(" ", "T"));
  else d = new Date(dt);
  if (isNaN(d.getTime())) return { date: String(dt), time: "", raw: String(dt) };
  const date = d.toLocaleDateString("es-PE", { year:"numeric", month:"2-digit", day:"2-digit" });
  const time = d.toLocaleTimeString("es-PE", { hour:"2-digit", minute:"2-digit", hour12:true });
  return { date, time, raw: `${date} ${time}` };
}

const TYPE_META = {
  normal:{ es:"Normal", emo:"⚪" }, fire:{ es:"Fuego", emo:"🔥" }, water:{ es:"Agua", emo:"💧" },
  electric:{ es:"Eléctrico", emo:"⚡" }, grass:{ es:"Planta", emo:"🌿" }, ice:{ es:"Hielo", emo:"❄️" },
  fighting:{ es:"Lucha", emo:"🥊" }, poison:{ es:"Veneno", emo:"☠️" }, ground:{ es:"Tierra", emo:"🟤" },
  flying:{ es:"Volador", emo:"🪽" }, psychic:{ es:"Psíquico", emo:"🔮" }, bug:{ es:"Bicho", emo:"🐛" },
  rock:{ es:"Roca", emo:"🪨" }, ghost:{ es:"Fantasma", emo:"👻" }, dragon:{ es:"Dragón", emo:"🐉" },
  dark:{ es:"Siniestro", emo:"🌑" }, steel:{ es:"Acero", emo:"⚙️" }, fairy:{ es:"Hada", emo:"✨" }
};

function typeBadgeHtml(typeRaw){
  const type = String(typeRaw||"").trim().toLowerCase();
  const meta = TYPE_META[type] || { es: (type || "Tipo"), emo: "🏷️" };
  return `<span class="type-badge" title="${escapeHtml(meta.es)}">
    ${typeIconHtml(type)} ${escapeHtml(meta.es)}
  </span>`;
}

function categoryNice(token){
  const t = normCategoryToken(token);
  const map = {
    normal:"Normal", baby:"Bebé", legendary:"Legendario", mythical:"Mítico",
    shadow:"Shadow", purified:"Purificado", shiny:"Shiny",
    dynamax:"Dynamax", gigamax:"Gigamax", mega:"Mega"
  };
  return map[t] || (String(token||"").trim() || "-");
}

function leagueLogoText(league){
  const s = String(league||"");
  const m = s.match(/(\d{3,5})/);
  return m ? m[1] : "GO";
}

async function apiGET(actionName, params = {}) {
  const u = new URL(API);
  u.searchParams.set("accion", actionName);
  u.searchParams.set("_ts", Date.now().toString());
  Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v ?? ""));
  const r = await fetch(u.toString(), { cache: "no-store" });
  return r.json();
}

async function torneoRegisterGET(payload = {}) {
  const params = { ...payload };
  delete params.accion;
  delete params.action; 
  return apiGET("torneo_register", params);
}

/* Modal */
let scrollPos = 0;

function bloquearScrollBody() {
  if (document.body.classList.contains("modal-open")) return; // evita doble lock
  scrollPos = window.scrollY || 0;

  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
  document.body.style.top = `-${scrollPos}px`;
}

function restaurarScrollBody() {
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
  document.body.style.top = "";
  window.scrollTo(0, scrollPos);
}


$("openModalBtn").onclick = async () => {
  MODAL_JUST_OPENED = true;
  $("formModal").style.display = "flex";
  bloquearScrollBody();
  const btnReg = $("btnRegister");
  if (btnReg) btnReg.disabled = true;
  try {
    if (!TORNEOS.length) await loadAll(true);
    await setupModalPokemonFilterForSelectedTournament();
  } catch (e) {
    showToast("⚠ " + (e?.message || e));
  } finally {
    if (btnReg) btnReg.disabled = false;
  }
};

$("closeModalBtn").onclick = () => {
  $("formModal").style.display = "none";
  restaurarScrollBody();
};
window.addEventListener("click", (e) => {
  if (e.target === $("formModal")) {
    $("formModal").style.display = "none";
    restaurarScrollBody();
  }
});

const ICON_BASE = "https://raw.githubusercontent.com/nileplumb/PkmnShuffleMap/master/UICONS/pokemon/";
function iconUrl(iconId){
  return `${ICON_BASE}${iconId}.png`;
}

// ===============================
// ASSETS LOCALES (tu repo)
// ===============================
const TYPE_ICON_LOCAL = "tipo/";     
const LEAGUE_ICON_LOCAL = "Ligas/";  

// ===============================
// FALLBACK REMOTO (nileplumb)
// ===============================
const TYPE_ICON_REMOTE = "https://raw.githubusercontent.com/nileplumb/PkmnShuffleMap/master/UICONS/type/";
const LEAGUE_ICON_REMOTE = "https://raw.githubusercontent.com/nileplumb/PkmnShuffleMap/master/UICONS/misc/";

const TYPE_ID_BY_NAME = {
  normal:1, fighting:2, flying:3, poison:4, ground:5, rock:6,
  bug:7, ghost:8, steel:9, fire:10, water:11, grass:12,
  electric:13, psychic:14, ice:15, dragon:16, dark:17, fairy:18
};

function typeIdFromName(typeRaw){
  const k = String(typeRaw||"").trim().toLowerCase();
  return TYPE_ID_BY_NAME[k] || 0;
}

function typeIconHtml(typeRaw){
  const id = typeIdFromName(typeRaw);
  if(!id) return "";
  const local = `${TYPE_ICON_LOCAL}${id}.png`;
  const remote = `${TYPE_ICON_REMOTE}${id}.png`;
  return `<img class="type-icon" src="${escapeHtml(local)}" alt="tipo" title="${escapeHtml(typeRaw||'')}"
    onerror="this.onerror=null;this.src='${remote}'">`;
}


function wireTypeIconFallbacks(){
  // Evita el error "wireTypeIconFallbacks is not defined"
  // y además fuerza fallback remoto si fallan íconos locales.

  // Tipos (img.type-icon)
  document.querySelectorAll("img.type-icon").forEach(img => {
    if(img.dataset.fallbackBound === "1") return;
    img.dataset.fallbackBound = "1";

    img.addEventListener("error", () => {
      const src = img.getAttribute("src") || "";
      if(src.includes(TYPE_ICON_REMOTE)) return;

      const m = src.match(/(\d+)\.png$/);
      if(!m) return;

      img.src = `${TYPE_ICON_REMOTE}${m[1]}.png`;
    });
  });

  // Ligas (img.league-logo-img)
  document.querySelectorAll("img.league-logo-img").forEach(img => {
    if(img.dataset.fallbackBound === "1") return;
    img.dataset.fallbackBound = "1";

    img.addEventListener("error", () => {
      const src = img.getAttribute("src") || "";
      if(src.includes(LEAGUE_ICON_REMOTE)) return;

      const m = src.match(/(500|1500|2500|9000)\.png$/);
      if(!m) return;

      img.src = `${LEAGUE_ICON_REMOTE}${m[1]}.png`;
    });
  });
}


function leagueCpFromString(league){
  const s = String(league||"");
  const m = s.match(/(500|1500|2500|9000)/);
  return m ? m[1] : "";
}

function leagueLogoUrls(league){
  const cp = leagueCpFromString(league);
  if(!cp) return { local:"", remote:"" };
  return {
    local: `${LEAGUE_ICON_LOCAL}${cp}.png`,
    remote: `${LEAGUE_ICON_REMOTE}${cp}.png`
  };
}

function isModalOpen(){
  const fm = $("formModal");
  return fm && fm.style.display === "flex";
}

/* ===============================
   ✅ BRACKET SIN 'FLASH' (patch)
=============================== */
const BRACKET_MEM = new Map(); 

function bracketDomId_(m, idx){
  const id = getMatchId_(m);
  if(id) return id;
  const r = Number(m?.Round ?? m?.round ?? 1) || 1;
  const slotRaw = (m?.Slot ?? m?.slot);
  const slot = Number(slotRaw);
  if(Number.isFinite(slot)) return `r${r}s${slot}`;
  return `r${r}i${Number(idx)||0}`;
}

function bracketSig_(matches){
  const ms = sortMatches_(Array.isArray(matches) ? matches : []);
  return ms.map((m,i)=>{
    const r = Number(m?.Round ?? m?.round ?? 1) || 1;
    const slot = Number(m?.Slot ?? m?.slot ?? i);
    const mid = getMatchId_(m) || "";
    return `${r}:${slot}:${mid}`;
  }).join("|");
}

function bracketComputeCurrent_(t, matches){
  const real = matches.filter(m => getMatchPlayerId_(m,"A") && getMatchPlayerId_(m,"B"));
  const pending = real.filter(m => !isMatchClosed_(t, m));
  return pending[0] || null;
}

function bracketComputeVisibility_(t, matches, maxRound){
  const current = bracketComputeCurrent_(t, matches);
  const activeRound = current ? Number(current?.Round ?? current?.round ?? 1) : maxRound;
  const minRoundToShow = Math.max(1, activeRound - 1);
  const visibleSideRounds = [];
  for(let r=1; r<maxRound; r++){
    if(r >= minRoundToShow) visibleSideRounds.push(r);
  }
  return { activeRound, minRoundToShow, visibleSideRounds, current };
}

function bracketApplyVisibilityToDom_(minRoundToShow, maxRound){
  const scroll = document.getElementById("bracketScroll");
  if(!scroll) return;
  scroll.querySelectorAll(".round-col[data-round]").forEach(col=>{
    const r = Number(col.getAttribute("data-round") || 0);
    col.classList.toggle("is-hidden", r > 0 && r < minRoundToShow);
  });
  const visibleSideRounds = [];
  for(let r=1;r<maxRound;r++){
    if(r >= minRoundToShow) visibleSideRounds.push(r);
  }
  scroll.dataset.visibleRounds = JSON.stringify(visibleSideRounds);
}

function bracketPatchNodes_(t, matches, currentMatch){
  const scroll = document.getElementById("bracketScroll");
  if(!scroll) return;
  if(!window.__BRACKET_DRAW_FN){
    window.__BRACKET_DRAW_FN = () => requestAnimationFrame(drawBracketLinesStatic_);
  }
  const ms = sortMatches_(matches);
  const map = new Map();
  ms.forEach((m, idx)=>{
    const domId = bracketDomId_(m, (typeof m.__brIdx === "number" ? m.__brIdx : idx));
    map.set(domId, m);
  });
  const curId = currentMatch ? bracketDomId_(currentMatch, (typeof currentMatch.__brIdx === "number" ? currentMatch.__brIdx : 0)) : "";
  scroll.querySelectorAll(".match-node.is-current").forEach(n => n.classList.remove("is-current"));
  scroll.querySelectorAll(".match-node[data-matchid]").forEach(node=>{
    const id = node.getAttribute("data-matchid") || "";
    const m = map.get(id);
    if(!m) return;
    const aId = getMatchPlayerId_(m, "A");
    const bId = getMatchPlayerId_(m, "B");
    const aName = (t.byId?.[aId]?.name) || getMatchPlayerName_(m,"A") || aId || "TBD";
    const bName = (t.byId?.[bId]?.name) || getMatchPlayerName_(m,"B") || bId || "TBD";
    const aScore = getScoreA_(m);
    const bScore = getScoreB_(m);
    const bo = Number(m?.bestOf ?? m?.BestOf ?? t?.bestOf ?? 3) || 3;
    const need = needWinsFromBestOf(bo);
    const finished = isMatchDone_(m) || (aScore >= need) || (bScore >= need);
    const rows = node.querySelectorAll(".player-row");
    if(rows[0]){
      rows[0].classList.toggle("win",  finished && aScore > bScore);
      rows[0].classList.toggle("lose", finished && bScore > aScore);
      const nm = rows[0].querySelector(".player-name");
      const bd = rows[0].querySelector(".player-badge");
      if(nm) nm.textContent = aName;
      if(bd) bd.textContent = String(aScore);
    }
    if(rows[1]){
      rows[1].classList.toggle("win",  finished && bScore > aScore);
      rows[1].classList.toggle("lose", finished && aScore > bScore);
      const nm = rows[1].querySelector(".player-name");
      const bd = rows[1].querySelector(".player-badge");
      if(nm) nm.textContent = bName;
      if(bd) bd.textContent = String(bScore);
    }
    if(curId && id === curId){
      node.classList.add("is-current");
    }
  });
  scroll.classList.add("no-anim");
  requestAnimationFrame(()=> scroll.classList.remove("no-anim"));
  window.__BRACKET_DRAW_FN();
}

function drawBracketLinesStatic_(){
  const scroll = document.getElementById("bracketScroll");
  const svg = document.getElementById("bracketLines");
  if(!scroll || !svg) return;
  const w = scroll.scrollWidth;
  const h = scroll.scrollHeight;
  svg.style.width = w + "px";
  svg.style.height = h + "px";
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.innerHTML = "";
  const cs = getComputedStyle(scroll);
  const scale = parseFloat(cs.getPropertyValue("--bracketScale")) || 1;
  const rootRect = scroll.getBoundingClientRect();
  const borderL = parseFloat(cs.borderLeftWidth) || 0;
  const borderT = parseFloat(cs.borderTopWidth) || 0;
  const rootLeft = rootRect.left + borderL;
  const rootTop  = rootRect.top  + borderT;
  const sx = scroll.scrollLeft;
  const sy = scroll.scrollTop;
  const ptRight = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: ((r.right - rootLeft) / scale) + sx,
      y: ((r.top - rootTop) / scale) + sy + ((r.height / 2) / scale)
    };
  };
  const ptLeft = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: ((r.left - rootLeft) / scale) + sx,
      y: ((r.top - rootTop) / scale) + sy + ((r.height / 2) / scale)
    };
  };
  const path = (p1, p2) => {
    const dx = Math.max(40, Math.abs(p2.x - p1.x) * 0.45);
    const c1 = { x: p1.x + (p2.x > p1.x ? dx : -dx), y: p1.y };
    const c2 = { x: p2.x - (p2.x > p1.x ? dx : -dx), y: p2.y };
    return `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  };
  const add = (d) => {
    const p = document.createElementNS("http://www.w3.org/2000/svg","path");
    p.setAttribute("d", d);
    p.setAttribute("fill","none");
    p.setAttribute("stroke","rgba(255,220,140,0.45)");
    p.setAttribute("stroke-width","2");
    p.setAttribute("stroke-linecap","round");
    svg.appendChild(p);
  };
  let visibleRounds = [];
  try{
    visibleRounds = JSON.parse(scroll.dataset.visibleRounds || "[]").map(Number).filter(Number.isFinite);
  }catch(_){ visibleRounds = []; }
  const connectSide = (side, roundsArr) => {
    for(let k=0;k<roundsArr.length-1;k++){
      const r = roundsArr[k];
      const r2 = roundsArr[k+1];
      const childNodes = [...scroll.querySelectorAll(`.match-node[data-side="${side}"][data-round="${r}"]`)];
      const parentNodes = [...scroll.querySelectorAll(`.match-node[data-side="${side}"][data-round="${r2}"]`)];
      childNodes.forEach((child, i) => {
        const parent = parentNodes[Math.floor(i/2)];
        if(!parent) return;
        if(side === "left") add(path(ptRight(child), ptLeft(parent)));
        else add(path(ptLeft(child), ptRight(parent)));
      });
    }
  };
  connectSide("left", visibleRounds);
  connectSide("right", visibleRounds);
  const maxRound = Number(scroll.dataset.maxRound || 0) || 0;
  if(maxRound > 1){
    const semiRound = maxRound - 1;
    const leftSemi = scroll.querySelector(`.match-node[data-side="left"][data-round="${semiRound}"][data-index="0"]`);
    const rightSemi = scroll.querySelector(`.match-node[data-side="right"][data-round="${semiRound}"][data-index="0"]`);
    const center = scroll.querySelector(`.match-node[data-side="center"][data-round="${maxRound}"]`);
    if(center && leftSemi) add(path(ptRight(leftSemi), ptLeft(center)));
    if(center && rightSemi) add(path(ptLeft(rightSemi), ptRight(center)));
  }
}

function roundLabel(r, maxRound){
  r = Number(r||1);
  maxRound = Number(maxRound||r);
  if (maxRound <= 1) return "Final";
  if (r === maxRound) return "Final";
  if (r === maxRound - 1) return "Semifinal";
  if (r === maxRound - 2) return "Cuartos";
  return `Ronda ${r}`;
}

function slugPokemon(name){
  return String(name||"")
    .trim().toLowerCase()
    .replace(/\./g,"")
    .replace(/♀/g,"-f")
    .replace(/♂/g,"-m")
    .replace(/['"]/g,"")
    .replace(/\s+/g,"-");
}
function spriteUrl(pokemonName){
  const s = slugPokemon(pokemonName);
  if(!s) return "";
  return `https://img.pokemondb.net/sprites/home/normal/${encodeURIComponent(s)}.png`;
}

function stripLeaguePrefixPid_(tok){
  const s = String(tok||"").trim();
  if(!s) return "";
  const i = s.indexOf(".");
  return (i > 0) ? s.slice(i+1).trim() : s;
}

function firstPidFromCell_(cell){
  const s = String(cell||"").trim();
  if(!s) return "";
  const parts = s.split(/[,;|\n\r]+/g).map(x => x.trim()).filter(Boolean);
  if(!parts.length) return "";
  return stripLeaguePrefixPid_(parts[0]);
}

function pidFromCellByLeague_(cell, leagueCp){
  const s = String(cell||"").trim();
  if(!s) return "";
  const parts = s.split(/[,;|\n\r]+/g).map(x => x.trim()).filter(Boolean);
  if(!parts.length) return "";
  const cp = String(leagueCp||"").trim();
  if(cp){
    const pref = `liga${cp}.`.toLowerCase();
    const hit = parts.find(x => String(x||"").toLowerCase().startsWith(pref));
    if(hit) return stripLeaguePrefixPid_(hit);
  }
  return stripLeaguePrefixPid_(parts[0]);
}

function getTeamFromInscrito(ins){
  const t = ["P1","P2","P3","P4","P5","P6"].map(k => ins?.[k] || "");
  const clean = t.map(firstPidFromCell_);
  if(clean.filter(Boolean).length >= 4) return clean;
  const t2 = ["p1","p2","p3","p4","p5","p6"].map(k => ins?.[k] || "");
  return t2.map(firstPidFromCell_);
}

async function loadAll(force = false) {
  if (LOADALL_PROMISE) return LOADALL_PROMISE;
  if (!force && TORNEOS.length && (Date.now() - LAST_LOADALL_TS) < LOADALL_MIN_MS) return;
  LOADALL_PROMISE = _loadAllInner()
    .finally(() => {
      LAST_LOADALL_TS = Date.now();
      LOADALL_PROMISE = null;
    });
  return LOADALL_PROMISE;
}

async function _loadAllInner() {
  const list = await apiGET("torneo_list", SHOW_ALL_TOURNEOS ? {} : { onlyActive: "1" });
  if(!list.ok) throw new Error(list.error || "No se pudo cargar lista");
  const torneos = Array.isArray(list.torneos) ? list.torneos : [];
  torneos.sort((a,b)=> String(a.createdAt||"").localeCompare(String(b.createdAt||"")));

  if(!torneos.length){
    renderNoTournamentState_("No hay torneos disponibles.");
    return;
  }

  const detailed = await Promise.all(torneos.map(async t => {
    const torneoId = String(t.torneoId||"").trim();
    const cfg = await apiGET("torneo_config", { torneoId });
    const c = cfg.config || {};
    const ins = await apiGET("torneo_list_inscritos", { torneoId });
    const inscritos = Array.isArray(ins.inscritos) ? ins.inscritos : [];
    const mat = await apiGET("torneo_list_matches", { torneoId });
    const matches = Array.isArray(mat.matches) ? mat.matches : [];
    const byId = {};
    inscritos.forEach(p => {
      const id = String(p.PlayerId || p.playerId || "").trim();
      if(!id) return;
      byId[id] = {
        name: p.NombrePokemonGO || p.Nick || p.Nombre || id,
        team: getTeamFromInscrito(p)
      };
    });
    matches.sort((a,b)=> (Number(a.Round)-Number(b.Round)) || (Number(a.Slot)-Number(b.Slot)));
    const maxRound = matches.reduce((mx,m)=> Math.max(mx, Number(m.Round||1)), 1);
    const pending = matches.filter(m => String(m.Status||"") !== "done" && m.PlayerAId && m.PlayerBId);
    const current = pending[0] || null;
    const next = pending[1] || null;

    return {
      torneoId,
      title: c.title || t.title || "(sin título)",
      dateTime: c.dateTime || t.dateTime || "",
      format: c.format || t.format || "",
      league: c.leaguePlan || c.league || t.leaguePlan || t.league || "",
      mode: c.mode || "",
      tablesCount: Number(
        c.tablesCount ?? c.TablesCount ?? c.mesas ?? c.Mesas ??
        t.tablesCount ?? t.TablesCount ?? t.mesas ?? t.Mesas ?? 0
      ) || 0,
      hasMainStage: isTrue(
        c.hasMainStage ?? c.HasMainStage ?? c.mainStage ?? c.MainStage ??
        t.hasMainStage ?? t.HasMainStage ?? t.mainStage ?? t.MainStage ?? ""
      ),
      leagueRulesJson: c.leagueRulesJson || t.leagueRulesJson || "",
      bestOf: c.bestOf || "",
      prizesJson: c.prizesJson || c.prizes || t.prizesJson || t.prizes || "",
      open: isTrue(c.inscriptionsOpen ?? t.inscriptionsOpen),
      generated: isTrue(c.generated ?? t.generated),
      prepEndsAt: c.prepEndsAt || "",
      inscritos,
      bannedTypes: c.bannedTypes || "",
      bannedCategories: c.bannedCategories || "",
      allowedTypes: c.allowedTypes || t.allowedTypes || "",
      allowedCategories: c.allowedCategories || t.allowedCategories || "",
      bannedPokemon: c.bannedPokemon || "",
      allowedPokemon: c.allowedPokemon || "",
      bannedFastMoves: c.bannedFastMoves || c.bannedFast || t.bannedFastMoves || t.bannedFast || "",
      bannedChargedMoves: c.bannedChargedMoves || c.bannedCharged || t.bannedChargedMoves || t.bannedCharged || "",
      byId,
      matches,
      maxRound,
      current,
      next
    };
  }));

  TORNEOS = detailed;

  if (!SELECTED_ID) {
    const abiertos = TORNEOS.filter(x => x.open);
    SELECTED_ID = (abiertos.length ? abiertos[abiertos.length - 1] : TORNEOS[TORNEOS.length - 1]).torneoId;
  }

  renderTabs();
  renderSelected();
  if (isModalOpen()) {
    await setupModalPokemonFilterForSelectedTournament();
  }
}

function renderTabs(){
  const box = $("eventTabs");
  if(!box) return;
  if(TORNEOS.length <= 1){
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  box.style.display = "flex";
  box.innerHTML = TORNEOS.map(t => {
    const labelLiga = t.league ? ` - ${t.league}` : "";
    const cls = (t.torneoId === SELECTED_ID) ? "event-tab active" : "event-tab";
    const badge = t.open ? "🟢" : "🔒";
    return `<button class="${cls}" data-id="${escapeHtml(t.torneoId)}">${escapeHtml(t.title)}${escapeHtml(labelLiga)} ${badge}</button>`;
  }).join("");
  box.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = () => {
      SELECTED_ID = btn.getAttribute("data-id");
      renderTabs();
      renderSelected();
      setupModalPokemonFilterForSelectedTournament();
    };
  });
}

function extractLeagueCpAny(v){
  const m = String(v||"").match(/(\d{3,4})/);
  return m ? m[1] : String(v||"").trim();
}

function parseLeaguePlan(raw){
  const s = String(raw||"").trim();
  const out = { main: [], tiebreak: "" };
  if(!s) return out;
  const parts = s.split("|").map(p => p.trim()).filter(Boolean);
  const mainPart = parts[0] || s;
  const mainTokens = mainPart.split("+").map(x => x.trim()).filter(Boolean);
  out.main = mainTokens.map(extractLeagueCpAny).filter(Boolean);
  const tbPart = parts.find(p => /^tiebreak\s*:/i.test(p));
  if(tbPart){
    out.tiebreak = extractLeagueCpAny(tbPart.split(/tiebreak\s*:/i)[1]);
  }
  return out;
}

function isMasterToken_(v){
  const s = String(v||"").trim().toLowerCase();
  return (
    s === "9000" ||
    s === "ml" ||
    s === "master" ||
    s.includes("master")
  );
}

function leagueIconCp_(cp){
  return isMasterToken_(cp) ? "9000" : String(cp||"").trim();
}

function leagueLogoUrlsFromCp(cp){
  const c = leagueIconCp_(cp); 
  if(!c) return { local:"", remote:"" };
  return {
    local: `${LEAGUE_ICON_LOCAL}${c}.png`,
    remote: `${LEAGUE_ICON_REMOTE}${c}.png`
  };
}

function formatNice(fmt){
  const f = String(fmt||"").trim();
  const k = f.toLowerCase();
  if(!k) return "-";
  if(k.includes("grupo") || k.includes("group")) return "Fase de grupos";
  if(k.includes("double")) return "Doble eliminación";
  if(k.includes("elim") || k.includes("single") || k.includes("direct")) return "ELIMINACION DIRECTA";
  return f;
}

function needWinsFromBestOf(bestOf){
  const bo = Number(bestOf || 3);
  return Math.floor(bo / 2) + 1;
}

function parseJsonArray_(raw){
  if(!raw) return [];
  if(Array.isArray(raw)) return raw;
  const s = String(raw || "").trim();
  if(!s) return [];
  try{
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  }catch(_){
    return [];
  }
}

function modeNice_(raw){
  const s = String(raw || "").trim();
  if(!s) return "";
  const k = s.toLowerCase();
  const hasV = k.includes("virtual");
  const hasP = k.includes("presen");
  if(hasV && hasP) return "VIRTUAL / PRESENCIAL";
  if(hasV) return "VIRTUAL";
  if(hasP) return "PRESENCIAL";
  return s.toUpperCase();
}

function buildBestOfExplanation(t){
  const bo = Number(t?.bestOf || 0);
  if(!bo) return "";
  const plan = parseLeaguePlan(t?.league);
  const __isBattle = isBattlePhase(t);
  const __leagueRow = document.getElementById("metaLeagueRow");
  if(__leagueRow) __leagueRow.style.display = __isBattle ? "none" : "";
  const mains = (plan.main || []).filter(Boolean);
  const tb = String(plan.tiebreak || "").trim();
  const needWins = needWinsFromBestOf(bo);
  const liga = (cp) => cp ? `Liga ${cp}` : "liga";

  if(bo === 3){
    if(mains.length >= 2 && tb){
      return `Al mejor de 3: gana quien consiga ${needWins} victorias. Partida 1 en ${liga(mains[0])}, Partida 2 en ${liga(mains[1])}; si quedan 1-1, el desempate (Partida 3) es en ${liga(tb)}.`;
    }
    if(mains.length >= 2 && !tb){
      return `Al mejor de 3: gana quien consiga ${needWins} victorias. Partida 1 en ${liga(mains[0])}, Partida 2 en ${liga(mains[1])}; si quedan 1-1, la Partida 3 se juega nuevamente en ${liga(mains[0])}.`;
    }
    if(mains.length === 1 && tb && tb !== mains[0]){
      return `Al mejor de 3: gana quien consiga ${needWins} victorias. Partidas en ${liga(mains[0])}; si quedan 1-1, el desempate (Partida 3) es en ${liga(tb)}.`;
    }
    if(mains.length === 1){
      return `Al mejor de 3: gana quien consiga ${needWins} victorias. Todas las partidas se juegan en ${liga(mains[0])}.`;
    }
    return `Al mejor de 3: gana quien consiga ${needWins} victorias.`;
  }

  if(bo === 5){
    if(mains.length >= 2 && tb){
      return `Al mejor de 5: gana quien consiga ${needWins} victorias. Partidas 1-4 alternan Liga ${mains[0]} / Liga ${mains[1]}; si quedan 2-2, el desempate (Partida 5) es en ${liga(tb)}.`;
    }
    if(mains.length >= 2 && !tb){
      return `Al mejor de 5: gana quien consiga ${needWins} victorias. Partidas 1-5 alternan Liga ${mains[0]} / Liga ${mains[1]} (la 5 vuelve a ${liga(mains[0])} si quedan 2-2).`;
    }
    if(mains.length === 1 && tb && tb !== mains[0]){
      return `Al mejor de 5: gana quien consiga ${needWins} victorias. Partidas en ${liga(mains[0])}; si quedan 2-2, el desempate (Partida 5) es en ${liga(tb)}.`;
    }
    if(mains.length === 1){
      return `Al mejor de 5: gana quien consiga ${needWins} victorias. Todas las partidas se juegan en ${liga(mains[0])}.`;
    }
    return `Al mejor de 5: gana quien consiga ${needWins} victorias.`;
  }
  return `BO${bo}: gana quien consiga ${needWins} victorias.`;
}

function leaguePartHtml(cp, size="md"){
  const raw = String(cp||"").trim();
  if(!raw) return "";
  const isMaster = isMasterToken_(raw);
  const label = isMaster ? "MASTER" : raw;
  const { local, remote } = leagueLogoUrlsFromCp(raw);
  const src = local || remote || "";
  const onerr = remote ? `this.onerror=null;this.src='${escapeHtml(remote)}'` : "";
  return `
    <span class="league-part">
      ${src ? `<img class="league-logo-img" src="${escapeHtml(src)}" alt="Liga ${escapeHtml(label)}" onerror="${onerr}">` : ""}
      <span class="league-cp">${escapeHtml(label)}</span>
    </span>
  `;
}

function setTournamentHeaderUI(t){
  const titleEl = $("torneoTitle");
  if(titleEl) titleEl.textContent = String(t?.title || "TORNEO").toUpperCase();
  const meta = $("torneoMeta");
  if(meta) meta.style.display = "grid";
  const plan = parseLeaguePlan(t?.league);
  const mainParts = (plan.main || []).filter(Boolean);
  const leagueText = $("torneoLeagueText");
  const img = $("leagueLogoImg");
  if(img){
    img.style.display = "none";
    img.removeAttribute("src");
  }
  if(leagueText){
    if(mainParts.length){
      leagueText.innerHTML = mainParts.map(cp => leaguePartHtml(cp)).join(`<span class="league-sep">/</span>`);
    }else{
      leagueText.textContent = String(t?.league || "-").toUpperCase();
    }
  }
  const tbBadge = $("torneoTiebreakBadge");
  const tbText = $("torneoTiebreakText");
  const tbImg = $("tiebreakLogoImg");
  const tbCp = String(plan.tiebreak || "").trim();
  if(tbBadge){
    if(tbCp){
      tbBadge.style.display = "inline-flex";
      if(tbText) tbText.textContent = isMasterToken_(tbCp) ? "MASTER" : tbCp;
      if(tbImg){
        const { local, remote } = leagueLogoUrlsFromCp(tbCp);
        const src = local || remote || "";
        tbImg.style.display = src ? "inline-block" : "none";
        if(src){
          tbImg.src = src;
          tbImg.onerror = () => { tbImg.onerror = null; if(remote) tbImg.src = remote; };
        }else{
          tbImg.removeAttribute("src");
        }
      }
    }else{
      tbBadge.style.display = "none";
      if(tbText) tbText.textContent = "";
      if(tbImg){
        tbImg.style.display = "none";
        tbImg.removeAttribute("src");
      }
    }
  }

  const isBattle = isBattlePhase(t);
  setHeaderBattleMode(isBattle);
  const dtRow = $("metaDateTimeRow");
  const prepBar = $("prepCountdownBar");
  const prepTimeEl = $("prepCountdown");

  if(isBattle){
    if(dtRow) dtRow.style.display = "flex";   
    if(prepBar) prepBar.style.display = "none";
    stopPrepTimer();
  }else{
    const isPrep = isPrepActive(t);
    const dateOnlyEl = $("torneoDateOnly");
    const timeOnlyEl = $("torneoTimeOnly");
    if(isPrep){
      setHeaderPrepMode(true);
      if(dtRow) dtRow.style.display = "none";
      if(prepBar) prepBar.style.display = "block";
      if(prepTimeEl) prepTimeEl.textContent = "30:00"; 
      if(dateOnlyEl) dateOnlyEl.textContent = "";
      if(timeOnlyEl) timeOnlyEl.textContent = "30:00"; 
      startPrepTimer(t.prepEndsAt);
    }else{
      setHeaderPrepMode(false);
      if(dtRow) dtRow.style.display = "flex";
      if(prepBar) prepBar.style.display = "none";
      stopPrepTimer();
      const { date, time } = fmtDateParts(t?.dateTime);
      if(dateOnlyEl) dateOnlyEl.textContent = date || "-";
      if(timeOnlyEl) timeOnlyEl.textContent = time || "-";
    }
  }

  const fmtNice = formatNice(t?.format);
  const boNum = Number(t?.bestOf || 0);
  const boLabel = boNum ? `BO${boNum}` : "-";
  const boDesc = buildBestOfExplanation(t);
  const fmtEl = $("torneoFormatText");
  if(fmtEl) fmtEl.textContent = fmtNice || "-";
  const boEl = $("torneoBoText");
  if(boEl) boEl.textContent = boLabel;
  const wrap = document.getElementById("boHelpWrap");
  const tip  = document.getElementById("boTooltip");
  if(wrap && tip){
    if(boDesc){
      wrap.style.display = "inline-flex";
      tip.textContent = boDesc;
    }else{
      wrap.style.display = "none";
      tip.textContent = "";
    }
  }

  const modeRow = $("metaModeRow");
  const modeTextEl = $("torneoModeText");
  const modeWrap = document.getElementById("modeHelpWrap");
  const modeTip  = document.getElementById("modeTooltip");
  const modeLabel = modeNice_(t?.mode);
  if(modeRow){
    if(!isBattle && modeLabel){
      modeRow.style.display = "flex";
      if(modeTextEl) modeTextEl.textContent = modeLabel;
      const showInfo = /virtual|presen/i.test(modeLabel);
      if(modeWrap && modeTip){
        if(showInfo){
          modeWrap.style.display = "inline-flex";
          modeTip.textContent = "Necesario estar en el grupo de WhatsApp de la comunidad para más detalles.";
        }else{
          modeWrap.style.display = "none";
          modeTip.textContent = "";
        }
      }
    }else{
      modeRow.style.display = "none";
      if(modeTextEl) modeTextEl.textContent = "";
      if(modeWrap) modeWrap.style.display = "none";
      if(modeTip) modeTip.textContent = "";
    }
  }

  const prizesRow = $("metaPrizesRow");
  const prizesBox = $("torneoPrizes");
  const prizes = parseJsonArray_(t?.prizesJson);
  if(prizesRow){
    if(prizes.length){
      prizesRow.style.display = "flex";
      if(prizesBox){
        prizesBox.innerHTML = prizes.map((p, idx) => {
          const rank = `${idx + 1}º Puesto`;
          const name = String(p?.name || "").trim() || "Premio";
          const icon = String(p?.icon || "").trim();
          const iconHtml = icon
            ? `<span class="prize-icon-box"><img src="${escapeHtml(icon)}" alt="${escapeHtml(name)}" onerror="this.style.display='none'"></span>`
            : `<span class="prize-icon-box"></span>`;
          return `<span class="prize-item">
            ${iconHtml}
            <span class="prize-text">
              <span class="prize-rank">${escapeHtml(rank)}</span>
              <span class="prize-name">${escapeHtml(name)}</span>
            </span>
          </span>`;
        }).join("");
      }
    }else{
      prizesRow.style.display = "none";
      if(prizesBox) prizesBox.innerHTML = "";
    }
  }

  wireModeTooltipOnce();
  const oldRow = $("torneoBoDescRow");
  if(oldRow) oldRow.style.display = "none";
  wireBoTooltipOnce();
}

function iconLabelFor(token){
  const key = String(token||"").trim().toLowerCase();
  if(!key) return "";
  const meta = ICON_META_BY_ID.get(key) || ICON_META_BY_ID.get(String(key).replace(/^0+/,""));
  return meta?.label || meta?.name || String(token);
}

function renderPokemonFaces(tokens, mode){
  const arr = Array.isArray(tokens) ? tokens : [];
  if(!arr.length) return "<div class=\"rule-empty\">—</div>";
  const withDex = arr.map(tok => {
    const m = String(tok||"").match(/^(\d{1,4})/);
    return { tok, dex: m ? Number(m[1]) : 999999 };
  }).sort((a,b)=> (a.dex-b.dex) || String(a.tok).localeCompare(String(b.tok)));
  return `<div class="poke-face-grid">${withDex.map(x => {
    const id = String(x.tok).trim();
    const title = iconLabelFor(id);
    const cls = (mode === "allow")
      ? "poke-face-mini poke-face-mini--allow"
      : "poke-face-mini poke-face-mini--ban";
    return `<img class="${cls}" src="${escapeHtml(iconUrl(id))}"
      title="${escapeHtml(title)}" alt="${escapeHtml(title)}"
      onerror="this.style.display='none'">`;
  }).join("")}</div>`;
}

function findMoveMeta(token){
  const t = String(token||"").trim();
  if(!t) return null;
  return MOVE_BY_ID.get(t) || MOVE_BY_ID.get(t.toLowerCase()) || MOVE_BY_NORMNAME.get(normName(t)) || null;
}

function renderMoveChips(tokens){
  const arr = Array.isArray(tokens) ? tokens : [];
  if(!arr.length) return "<div class=\"rule-empty\">—</div>";
  const chips = arr.map(tok => {
    const m = findMoveMeta(tok);
    const name = (m ? (m?.[UI_LANG] || m?.es_419 || m?.es_ES || m?.en) : null) || String(tok);
    const type = m?.type || "";
    return `<span class="move-chip" title="${escapeHtml(type||'')}">
      ${escapeHtml(name)} ${typeIconHtml(type)}
    </span>`;
  });
  return `<div class="rule-chips">${chips.join("")}</div>`;
}

function renderTypeChips(bannedTypes){
  const arr = Array.isArray(bannedTypes) ? bannedTypes : [];
  if(!arr.length) return "<div class=\"rule-empty\">—</div>";
  return `<div class="rule-chips">${
    arr.map(tp => {
      const k = String(tp).toLowerCase();
      const meta = TYPE_META[k] || { es: tp, emo:"🏷️" };
      return `<span class="chip chip-type">
        ${typeIconHtml(k)} ${escapeHtml(meta.es)}
      </span>`;
    }).join("")
  }</div>`;
}

function renderCatsAllowed(allowedCats){
  if(!allowedCats || !allowedCats.length) return "<div class=\"rule-empty\">—</div>";
  return `<div class="rule-chips">${allowedCats.map(c => `<span class="chip">${escapeHtml(categoryNice(c))}</span>`).join("")}</div>`;
}

function sectionHtml(title, inner, mode){
  const cls = mode === "allow" ? "rule-section rule-section--allow" : "rule-section rule-section--ban";
  const tcls = mode === "allow" ? "sec-title-allow" : "sec-title-ban";
  return `<div class="${cls}"><h4 class="${tcls}">${escapeHtml(title)}</h4>${inner}</div>`;
}

function setRulesCollapsed_(collapsed){
  const card = $("rulesCard");
  if(!card) return;
  if(collapsed) card.classList.add("is-collapsed");
  else card.classList.remove("is-collapsed");
  const btn = $("rulesToggleBtn");
  if(btn){
    btn.textContent = collapsed ? "Mostrar" : "Ocultar";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
}

function wireRulesToggleOnce_(){
  const btn = $("rulesToggleBtn");
  if(!btn) return;
  if(btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => {
    const card = $("rulesCard");
    if(!card) return;
    setRulesCollapsed_(!card.classList.contains("is-collapsed"));
  });
}

function renderRulesCard(t){
  const box = $("rulesCard");
  if(!box) return;
  if(isBattlePhase(t)){
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  const rulesObj = getPerLeagueRules_(t);
  const rawKeys = rulesObj ? Object.keys(rulesObj.leagues || {}) : [];
  const isMultiLeague = !!rulesObj && rawKeys.length > 1;
  let activeKey = "";
  let orderedKeys = rawKeys.slice();
  let tiebreakKey = "";

  if(isMultiLeague){
    const plan = parseLeaguePlan(t?.league);
    const mains = (plan.main || []).filter(Boolean);
    const tb = String(plan.tiebreak || "").trim();
    const keyByCp = (cpTok) => {
      const target = leagueIconCp_(cpTok); 
      return rawKeys.find(k => leagueIconCp_(leagueCpFromLeagueKey_(k)) === target) || "";
    };
    if(tb) tiebreakKey = keyByCp(tb);
    const used = new Set();
    orderedKeys = [];
    mains.forEach(cp => {
      const k = keyByCp(cp);
      if(k && !used.has(k)){
        used.add(k);
        orderedKeys.push(k);
      }
    });
    rawKeys.forEach(k => {
      if(k === tiebreakKey) return;
      if(!used.has(k)){
        used.add(k);
        orderedKeys.push(k);
      }
    });
    if(tiebreakKey && !used.has(tiebreakKey)){
      used.add(tiebreakKey);
      orderedKeys.push(tiebreakKey);
    }
    if(RULES_MULTI_TORNEO_ID !== t?.torneoId){
      RULES_MULTI_TORNEO_ID = t?.torneoId || "";
      RULES_ACTIVE_LEAGUE_KEY = (orderedKeys[0] || rawKeys[0] || "");
    }else{
      if(!RULES_ACTIVE_LEAGUE_KEY || !rulesObj.leagues[RULES_ACTIVE_LEAGUE_KEY]){
        RULES_ACTIVE_LEAGUE_KEY = (orderedKeys[0] || rawKeys[0] || "");
      }
    }
    activeKey = RULES_ACTIVE_LEAGUE_KEY;
  }

  const src = isMultiLeague ? (rulesObj.leagues[activeKey] || {}) : (t || {});
  const bannedTypes  = splitListLower(src?.bannedTypes);
  const allowedTypes = splitListLower(src?.allowedTypes);
  const bannedCats  = splitTokens(src?.bannedCategories).map(normCategoryToken).filter(Boolean);
  const allowedCats = splitTokens(src?.allowedCategories).map(normCategoryToken).filter(Boolean);
  const bannedPokes  = splitTokens(src?.bannedPokemon);
  const allowedPokes = splitTokens(src?.allowedPokemon);
  const banFast      = splitTokens(src?.bannedFastMoves);
  const banCharged   = splitTokens(src?.bannedChargedMoves);

  const renderCatChips = (cats) => {
    if(!cats || !cats.length) return "<div class=\"rule-empty\">—</div>";
    const uniq = [...new Set(cats)];
    return `<div class="rule-chips">${
      uniq.map(c => `<span class="chip">${escapeHtml(categoryNice(c))}</span>`).join("")
    }</div>`;
  };

  const sections = [];
  if(bannedPokes.length)  sections.push(sectionHtml("Pokémon prohibidos", renderPokemonFaces(bannedPokes, "ban"), "ban"));
  if(allowedPokes.length) sections.push(sectionHtml("Excepciones permitidas", renderPokemonFaces(allowedPokes, "allow"), "allow"));
  if(banCharged.length) sections.push(sectionHtml("Ataques cargados prohibidos", renderMoveChips(banCharged), "ban"));
  if(banFast.length)    sections.push(sectionHtml("Ataques rápidos prohibidos", renderMoveChips(banFast), "ban"));
  if(bannedTypes.length)  sections.push(sectionHtml("Tipos prohibidos",  renderTypeChips(bannedTypes), "ban"));
  if(allowedTypes.length) sections.push(sectionHtml("Tipos permitidos",  renderTypeChips(allowedTypes), "allow"));
  if(bannedCats.length)  sections.push(sectionHtml("Tipo de Pokemones Prohibidos", renderCatChips(bannedCats), "ban"));
  if(allowedCats.length) sections.push(sectionHtml("Tipo de Pokemones Permitidos", renderCatChips(allowedCats), "allow"));

  if(!sections.length && !isMultiLeague){
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const wasCollapsed = box.classList.contains("is-collapsed");
  const firstRender = (box.dataset.rulesInit !== "1");
  box.style.display = "block";
  const tidNow = String(t?.torneoId || "");
  if(RULES_PREP_TORNEO_ID !== tidNow){
    RULES_PREP_TORNEO_ID = tidNow;
    RULES_PREP_WAS_ACTIVE = false;
  }
  const isPrepPhase = isPrepActive(t);
  const enteringPrep = (isPrepPhase && !RULES_PREP_WAS_ACTIVE);
  const showToggle = isPrepPhase; 

  let switchHtml = "";
  if(isMultiLeague){
    const btns = orderedKeys.map(k => {
      const cp = leagueCpFromLeagueKey_(k);
      const label = cp ? (cp === "9000" ? "Liga Master" : `Liga ${cp}`) : k;
      const { local, remote } = cp ? leagueLogoUrlsFromCp(cp) : { local:"", remote:"" };
      const srcImg = local || remote || "";
      const img = srcImg
        ? `<img class="league-switch-logo" src="${escapeHtml(srcImg)}" alt=""
             onerror="this.onerror=null;${remote ? `this.src='${escapeHtml(remote)}'` : "this.style.display='none'"}">`
        : "";
      const active = (k === activeKey) ? " is-active" : "";
      const pill = (k === tiebreakKey) ? `<span class="league-switch-pill">Desempate</span>` : "";
      return `<button type="button" class="league-switch-btn${active}" data-rleague="${escapeHtml(k)}">
        ${img}
        <span class="league-switch-text">${escapeHtml(label)}</span>
        ${pill}
      </button>`;
    }).join("");
    switchHtml = `
      <div id="rulesLeagueSwitch" class="rules-league-switch">
        <div id="rulesLeagueBtns" class="rules-league-switch__buttons">${btns}</div>
      </div>
    `;
  }

  const gridHtml = sections.length
    ? `<div class="rules-grid">${sections.join("")}</div>`
    : `<div class="rules-empty">No hay reglas definidas para esta liga.</div>`;

  box.innerHTML = `
    <div class="rules-head">
      <div class="rules-title">Reglas del torneo</div>
      ${showToggle ? `<button id="rulesToggleBtn" class="rules-toggle" type="button" aria-expanded="false">Mostrar</button>` : ``}
    </div>
    ${switchHtml}
    ${gridHtml}
  `;

  if(isMultiLeague){
    box.querySelectorAll("button[data-rleague]").forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute("data-rleague");
        if(!key || key === RULES_ACTIVE_LEAGUE_KEY) return;
        RULES_ACTIVE_LEAGUE_KEY = key;
        renderRulesCard(t);
        wireTypeIconFallbacks();
      };
    });
  }

  if(showToggle){
    if(enteringPrep) setRulesCollapsed_(true);
    else if(firstRender) setRulesCollapsed_(true); 
    else setRulesCollapsed_(wasCollapsed);          
    wireRulesToggleOnce_();
  }else{
    setRulesCollapsed_(false);                      
  }
  RULES_PREP_WAS_ACTIVE = isPrepPhase;
  box.dataset.rulesInit = "1";
}

function wireBoTooltipOnce(){
  const wrap = document.getElementById("boHelpWrap");
  const btn  = document.getElementById("boHelpBtn");
  if(!wrap || !btn) return;
  if(wrap.dataset.bound === "1") return;
  wrap.dataset.bound = "1";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.classList.toggle("open");
  });
  document.addEventListener("click", () => wrap.classList.remove("open"));
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") wrap.classList.remove("open");
  });
}

function wireModeTooltipOnce(){
  const wrap = document.getElementById("modeHelpWrap");
  const btn  = document.getElementById("modeHelpBtn");
  if(!wrap || !btn) return;
  if(wrap.dataset.bound === "1") return;
  wrap.dataset.bound = "1";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.classList.toggle("open");
  });
  document.addEventListener("click", () => wrap.classList.remove("open"));
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") wrap.classList.remove("open");
  });
}

function renderSelected(){
  const t = TORNEOS.find(x => x.torneoId === SELECTED_ID) || TORNEOS[0];
  setTournamentHeaderUI(t);
  renderRulesCard(t);
  wireTypeIconFallbacks();

  const battleBox = $("battlePhase");
  if(battleBox) battleBox.style.display = "none";
  const groupsSection = $("groupsSection");
  const groupsGrid = $("groupsGrid");
  if(groupsSection) groupsSection.style.display = "none";
  if(groupsGrid) groupsGrid.innerHTML = "";

  const estado = t.open ? "Inscripciones Abiertas" : "Inscripciones Cerradas";
  $("torneoInfo").textContent = "";
  $("torneoInfo").style.display = "none";

  if (t.open) {
    $("openModalBtn").style.display = ""; 
    $("eventSummary").style.display = "none";
    $("eventSummary").innerHTML = "";
    if(battleBox) battleBox.style.display = "none";
    const bracketSection = $("bracketSection");
    if (bracketSection) bracketSection.style.display = "none";
    $("bracket").innerHTML = "";
    return;
  }

  $("openModalBtn").style.display = "none";

  if(isPrepActive(t)){
    if(battleBox) battleBox.style.display = "none";
    $("eventSummary").style.display = "none";
    $("eventSummary").innerHTML = "";
    renderPrepParticipants(t);
    const bracketSection = $("bracketSection");
    if (bracketSection) bracketSection.style.display = "none";
    $("bracket").innerHTML = "";
    return;
  }

  if(isBattlePhase(t)){
    $("eventSummary").style.display = "none";
    $("eventSummary").innerHTML = "";
    renderBattlePhase(t);
    const isGroups = isGroupFormat_(t);
    if(isGroups){
      if(typeof renderGroupsSection === "function") renderGroupsSection(t);
      const bracketSection = $("bracketSection");
      if (bracketSection) bracketSection.style.display = "none";
      $("bracket").innerHTML = "";
      return;
    }
    const groupsSection = $("groupsSection");
    const groupsGrid = $("groupsGrid");
    if(groupsSection) groupsSection.style.display = "none";
    if(groupsGrid) groupsGrid.innerHTML = "";
    const bracketSection = $("bracketSection");
    if (bracketSection) bracketSection.style.display = "block";
    renderBracket(t);
    return;
  }

  if(battleBox) battleBox.style.display = "none";
  $("eventSummary").style.display = "block";
  $("eventSummary").innerHTML = `
    <div class="event-kicker">ENFRENTAMIENTOS</div>
    <div class="cards">
      ${renderMatchCard("Enfrentamiento actual", t, t.current)}
      ${renderMatchCard("Próximo enfrentamiento", t, t.next)}
    </div>
  `;

 const bracketSection = $("bracketSection");
const _ms = sortMatches_(Array.isArray(t?.matches) ? t.matches : []);
const _maxRound = _ms.reduce((acc, mm) => {
  const rr = Number(mm?.Round ?? mm?.round ?? 1) || 1;
  return Math.max(acc, rr);
}, 1);
const _real = _ms.filter(mm => getMatchPlayerId_(mm,"A") && getMatchPlayerId_(mm,"B"));
const _pending = _real.filter(mm => !isMatchClosed_(t, mm));
const _curId = String(t?.currentMatchId ?? t?.currentMatchID ?? "").trim();
const _cur = (_curId ? _pending.find(mm => getMatchId_(mm) === _curId) : null) || _pending[0] || _real[_real.length - 1] || null;
const _curRound = Number(_cur?.Round ?? _cur?.round ?? 1) || 1;
const _quartersRound = Math.max(1, _maxRound - 2);
const _hideBracket = isPresencialMode_(t) && getSimulCapacity_(t) >= 2 && (_curRound < _quartersRound);

if(_hideBracket){
  if (bracketSection) bracketSection.style.display = "none";
  $("bracket").innerHTML = "";
  return;
}
if (bracketSection) bracketSection.style.display = "block";
renderBracket(t);
return;
}

function renderBattlePhase(t){
  const box = $("battlePhase");
  if(!box) return;
  box.style.display = "block";
  const nowEl = $("matchNow");
  const n1El  = $("matchNext1");
  const n2El  = $("matchNext2");
  const liveWrap = $("liveTablesWrap");
  const liveGrid = $("liveTablesGrid");
  const queueWrap = $("nextQueueWrap");
  const queueList = $("nextQueueList");
  const matches = sortMatches_(Array.isArray(t?.matches) ? t.matches : []);
  const maxRound = matches.reduce((acc, m) => {
    const r = Number(m?.Round ?? m?.round ?? 1) || 1;
    return Math.max(acc, r);
  }, 1);
  const real = matches.filter(m => getMatchPlayerId_(m,"A") && getMatchPlayerId_(m,"B"));
  const pending = real.filter(m => !isMatchClosed_(t, m));
  const curId = String(t?.currentMatchId ?? t?.currentMatchID ?? "").trim();
  let current = (curId ? pending.find(mm => getMatchId_(mm) === curId) : null) || null;
  if(!current && isPresencialMode_(t) && hasMainStage_(t)){
    current = pending.find(isMainLocation_) || null;
  }
  current = current || pending[0] || real[real.length - 1] || null;
  const currentRound = Number(current?.Round ?? current?.round ?? 1) || 1;
  const isFinalOnly = !!current && (currentRound === maxRound) && (pending.length <= 1);
  box.classList.toggle("is-final-only", isFinalOnly);
  const bracketSection = $("bracketSection");
  if(bracketSection) bracketSection.classList.toggle("is-tight", isFinalOnly);

  if(isFinalOnly){
    if(nowEl) nowEl.innerHTML = renderBattleNowCard(t, current);
    if(n1El){ n1El.innerHTML = ""; n1El.style.display = "none"; }
    if(n2El){ n2El.innerHTML = ""; n2El.style.display = "none"; }
    if(liveWrap) liveWrap.style.display = "none";
    if(queueWrap) queueWrap.style.display = "none";
    if(liveGrid) liveGrid.innerHTML = "";
    if(queueList) queueList.innerHTML = "";
    return;
  }

 const presencial = isPresencialMode_(t);
 const simCapacity = presencial ? getSimulCapacity_(t) : 0;
 const quartersRound = Math.max(1, maxRound - 2);
 const isGroups = isGroupFormat_(t);
 const useTablesLayout = presencial && simCapacity >= 2 && (isGroups || (currentRound < quartersRound));

  box.classList.toggle("is-prequarters", useTablesLayout);

  if(useTablesLayout){
    if(n1El){ n1El.innerHTML = ""; n1El.style.display = "none"; }
    if(n2El){ n2El.innerHTML = ""; n2El.style.display = "none"; }
    if(liveWrap) liveWrap.style.display = "block";
    if(queueWrap) queueWrap.style.display = "block";
    const running = pending.filter(m => getMatchOpStatus_(m) === "running");
    let main = null;
    if(curId) main = pending.find(mm => getMatchId_(mm) === curId) || null;
    if(!main){
      main = running.find(isMainLocation_) ||
             pending.find(isMainLocation_) ||
             pending[0] || null;
    }
    const mainId = main ? getMatchId_(main) : "";
    if(nowEl) nowEl.innerHTML = renderBattleNowCard(t, main);
    const wantTables = Math.max(0, simCapacity - 1);
    const others = [];
    const seen = new Set();
    const pushUnique = (m)=>{
      const id = getMatchId_(m);
      if(!id || id === mainId) return;
      if(seen.has(id)) return;
      seen.add(id);
      others.push(m);
    };
    running.forEach(pushUnique);
    if(others.length < wantTables){
      pending.forEach(m=>{
        if(others.length >= wantTables) return;
        if(getMatchId_(m) === mainId) return;
        if(isMainLocation_(m)) return;
        pushUnique(m);
      });
    }
    const tableLive = others.sort(sortByLocation_).slice(0, wantTables);
    if(liveGrid){
      liveGrid.innerHTML = tableLive.map(m => renderBattleLiveTableCard_(t, m, maxRound)).join("");
    }
    const activeSet = new Set([mainId, ...tableLive.map(getMatchId_)]);
    const scheduled = pending
      .filter(m => !activeSet.has(getMatchId_(m)))
      .filter(m => getMatchOpStatus_(m) !== "running");
    const scheduledSorted = scheduled.slice().sort((a,b)=>{
      const [ar,as] = matchSortKey_(a);
      const [br,bs] = matchSortKey_(b);
      return (ar-br) || (as-bs);
    });
    const byLoc = new Map();
    scheduledSorted.forEach(m=>{
      const loc = getMatchLocationText_(m);
      if(!loc) return;
      if(!byLoc.has(loc)) byLoc.set(loc, m);
    });
    const locOrder = getOrderedLocations_(pending);
    const queue = [];
    const usedIds = new Set();
    for(const loc of locOrder){
      if(queue.length >= simCapacity) break;
      const m = byLoc.get(loc.text);
      if(!m) continue;
      const id = getMatchId_(m);
      if(!id || usedIds.has(id)) continue;
      usedIds.add(id);
      queue.push(m);
    }
    for(const m of scheduledSorted){
      if(queue.length >= simCapacity) break;
      const id = getMatchId_(m);
      if(!id || usedIds.has(id)) continue;
      usedIds.add(id);
      queue.push(m);
    }
    if(queueList){
      queueList.innerHTML = queue.slice(0, simCapacity).map(m => renderBattleQueueCard_(t, m, maxRound)).join("");
    }
    return;
  }

  if(liveWrap) liveWrap.style.display = "none";
  if(queueWrap) queueWrap.style.display = "none";
  if(liveGrid) liveGrid.innerHTML = "";
  if(queueList) queueList.innerHTML = "";
  if(n1El) n1El.style.display = "";
  if(n2El) n2El.style.display = "";
  const _cid = String(t?.currentMatchId ?? t?.currentMatchID ?? "").trim();
  const cur = (_cid ? pending.find(mm => getMatchId_(mm) === _cid) : null) || pending[0] || real[real.length - 1] || null;
  if(nowEl) nowEl.innerHTML = renderBattleNowCard(t, cur);
  const next1 = pending[1] || null;
  const next2 = pending[2] || null;
  if(n1El) n1El.innerHTML = renderBattleNextCard(t, next1, 1);
  const isSemis = (maxRound >= 2) && ((Number(cur?.Round ?? cur?.round ?? 1) || 1) === (maxRound - 1));
  if(isSemis){
    if(n2El) n2El.innerHTML = renderBattleFinalPlaceholderCard(t);
  }else{
    if(n2El) n2El.innerHTML = renderBattleNextCard(t, next2, 2);
  }
}

function renderBattleLiveTableCard_(t, m, maxRound){
  if(!m) return "";
  const a = getBattlePlayer_(t, m, "A");
  const b = getBattlePlayer_(t, m, "B");
  const r = Number(m?.Round ?? m?.round ?? 1) || 1;
  const title = getMatchLocationText_(m) || "Mesa";
  const gid = getMatchGroupId_(m);
  const chip = gid ? `<span class="battle-group-chip">GRUPO <b>${escapeHtml(gid)}</b></span>` : "";
  const metaText = `${roundLabel(r, t?.maxRound || maxRound || r)} · ${t?.bestOf ? `BO${t.bestOf}` : "BO-"}`;
  const meta = `${chip}<span class="battle-meta-text">${escapeHtml(metaText)}</span>`;
  return `
    <div class="battle-card battle-card--next battle-card--live">
      <div class="battle-head">
        <div class="battle-title">${escapeHtml(title)}</div>
        <div class="battle-meta">${meta}</div>
      </div>
      <div class="battle-body--next">
        <div class="battle-player">
          <div class="battle-name">${escapeHtml(a.name)}</div>
          <div class="battle-team">${renderBattleTeam_(a.team)}</div>
        </div>
        <div class="battle-next-vs" aria-hidden="true">VS</div>
        <div class="battle-player">
          <div class="battle-name">${escapeHtml(b.name)}</div>
          <div class="battle-team">${renderBattleTeam_(b.team)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderBattleQueueCard_(t, m, maxRound){
  if(!m){
    return `
      <div class="battle-card battle-card--next">
        <div class="battle-head">
          <div class="battle-title">Próximo enfrentamiento</div>
          <div class="battle-meta">TBD</div>
        </div>
        <div class="battle-vsline">—</div>
      </div>
    `;
  }
  const a = getBattlePlayer_(t, m, "A");
  const b = getBattlePlayer_(t, m, "B");
  const r = Number(m?.Round ?? m?.round ?? 1) || 1;
  const gid = getMatchGroupId_(m);
  const chip = gid ? `<span class="battle-group-chip">GRUPO <b>${escapeHtml(gid)}</b></span>` : "";
  const metaText = `${roundLabel(r, t?.maxRound || maxRound || r)} · ${t?.bestOf ? `BO${t.bestOf}` : "BO-"}`;
  const mesaChip = isPresencialMode_(t) ? renderMesaChip_(m) : "";
  const meta = `${mesaChip}${chip}<span class="battle-meta-text">${escapeHtml(metaText)}</span>`;
  return `
    <div class="battle-card battle-card--next">
      <div class="battle-head">
        <div class="battle-title">Próximo enfrentamiento</div>
        <div class="battle-meta">${meta}</div>
      </div>
      <div class="battle-body--next">
        <div class="battle-player">
          <div class="battle-name">${escapeHtml(a.name)}</div>
          <div class="battle-team">${renderBattleTeam_(a.team)}</div>
        </div>
        <div class="battle-next-vs" aria-hidden="true">VS</div>
        <div class="battle-player">
          <div class="battle-name">${escapeHtml(b.name)}</div>
          <div class="battle-team">${renderBattleTeam_(b.team)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderBattleNowCard(t, m){
  if(!m){
    return `
      <div class="battle-card battle-card--now">
        <div class="battle-head">
          <div class="battle-title">Enfrentamiento actual</div>
          <div class="battle-meta">Aún no hay enfrentamientos</div>
        </div>
        <div class="battle-vsline">TBD</div>
      </div>
    `;
  }
  const a = getBattlePlayer_(t, m, "A");
  const b = getBattlePlayer_(t, m, "B");
  const aScore = getScoreA_(m);
  const bScore = getScoreB_(m);
  const closed = isMatchClosed_(t, m);
  let aCls = "";
  let bCls = "";
  if(closed && aScore !== bScore){
    if(aScore > bScore){ aCls = "is-win"; bCls = "is-lose"; }
    else{ aCls = "is-lose"; bCls = "is-win"; }
  }
  const r = Number(m?.Round ?? m?.round ?? 1);
  const gid = getMatchGroupId_(m);
  const chip = gid
    ? `<span class="battle-group-chip">GRUPO <b>${escapeHtml(gid)}</b></span>`
    : "";
  const metaText = `${roundLabel(r, t?.maxRound || r)} · ${t?.bestOf ? `BO${t.bestOf}` : "BO-"}`;
  const mesaChip = isPresencialMode_(t) ? renderMesaChip_(m) : "";
  const meta = `${mesaChip}${chip}<span class="battle-meta-text">${escapeHtml(metaText)}</span>`;
  return `
    <div class="battle-card battle-card--now">
      <div class="battle-head">
        <div class="battle-title">Enfrentamiento actual</div>
        <div class="battle-meta">${meta}</div>
      </div>
      <div class="battle-body--now">
        <div class="battle-player">
          <div class="battle-name ${aCls}">${escapeHtml(a.name)}</div>
          <div class="battle-team">${renderBattleTeam_(a.team)}</div>
        </div>
        <div class="battle-score" aria-label="score">
          <span class="battle-score-num">${aScore}</span>
          <span class="battle-score-sep">-</span>
          <span class="battle-score-num">${bScore}</span>
        </div>
        <div class="battle-player">
          <div class="battle-name ${bCls}">${escapeHtml(b.name)}</div>
          <div class="battle-team">${renderBattleTeam_(b.team)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderBattleNextCard(t, m, idx){
  const title = `Próximo enfrentamiento`;
  if(!m){
    return `
      <div class="battle-card battle-card--next">
        <div class="battle-head">
          <div class="battle-title">${title}</div>
          <div class="battle-meta">TBD</div>
        </div>
        <div class="battle-vsline">—</div>
      </div>
    `;
  }
  const a = getBattlePlayer_(t, m, "A");
  const b = getBattlePlayer_(t, m, "B");
  const r = Number(m?.Round ?? m?.round ?? 1);
  const gid = getMatchGroupId_(m);
  const chip = gid
    ? `<span class="battle-group-chip">GRUPO <b>${escapeHtml(gid)}</b></span>`
    : "";
  const metaText = `${roundLabel(r, t?.maxRound || r)} · ${t?.bestOf ? `BO${t.bestOf}` : "BO-"}`;
  const mesaChip = isPresencialMode_(t) ? renderMesaChip_(m) : "";
  const meta = `${mesaChip}${chip}<span class="battle-meta-text">${escapeHtml(metaText)}</span>`;
  return `
    <div class="battle-card battle-card--next">
      <div class="battle-head">
        <div class="battle-title">${title}</div>
        <div class="battle-meta">${meta}</div>
      </div>
     <div class="battle-body--next">
  <div class="battle-player">
    <div class="battle-name">${escapeHtml(a.name)}</div>
    <div class="battle-team">${renderBattleTeam_(a.team)}</div>
  </div>
  <div class="battle-next-vs" aria-hidden="true">VS</div>
  <div class="battle-player">
    <div class="battle-name">${escapeHtml(b.name)}</div>
    <div class="battle-team">${renderBattleTeam_(b.team)}</div>
  </div>
</div>
  `;
}

var GROUP_WIN_POINTS = (typeof GROUP_WIN_POINTS !== "undefined") ? GROUP_WIN_POINTS : 1;

let TEAM_MODAL_CACHE = new Map();

function stageIsGroups_(m){
  const st = String(m?.Stage ?? m?.stage ?? "").trim().toLowerCase();
  if(!st) return true;
  return st.includes("group") || st.includes("grupo");
}

function buildGroupsStandings_(t){
  const matches = Array.isArray(t?.matches) ? t.matches : [];
  const byId = t?.byId || {};
  const gmap = new Map(); 
  function ensure_(gid, pid){
    if(!gmap.has(gid)) gmap.set(gid, new Map());
    const mp = gmap.get(gid);
    if(!mp.has(pid)){
      const meta = byId[pid] || {};
      mp.set(pid, {
        id: pid,
        name: meta?.name || pid,
        team: Array.isArray(meta?.team) ? meta.team.slice(0,6) : [],
        pts: 0,
        w: 0,
        l: 0,
        played: 0,
        gw: 0,
        gl: 0
      });
    }
    return mp.get(pid);
  }
  matches.forEach(m => {
    const gid = getMatchGroupId_(m);
    if(!gid) return;
    if(!stageIsGroups_(m)) return;
    const aId = getMatchPlayerId_(m, "A");
    const bId = getMatchPlayerId_(m, "B");
    if(!aId || !bId) return;
    const a = ensure_(gid, aId);
    const b = ensure_(gid, bId);
    if(!isMatchClosed_(t, m)) return;
    const aScore = getScoreA_(m);
    const bScore = getScoreB_(m);
    a.played++; b.played++;
    a.gw += aScore; a.gl += bScore;
    b.gw += bScore; b.gl += aScore;
    if(aScore > bScore){
      a.w++; b.l++;
      a.pts += GROUP_WIN_POINTS;
    }else if(bScore > aScore){
      b.w++; a.l++;
      b.pts += GROUP_WIN_POINTS;
    }
  });
  const out = [...gmap.entries()].map(([gid, mp]) => {
    const players = [...mp.values()];
    players.sort((x,y)=>{
      const dx = x.gw - x.gl;
      const dy = y.gw - y.gl;
      return (y.pts - x.pts)
        || (dy - dx)
        || (y.gw - x.gw)
        || String(x.name).localeCompare(String(y.name), "es", { sensitivity:"base" });
    });
    return { gid, players };
  });
  out.sort((a,b)=> String(a.gid).localeCompare(String(b.gid), "en", { sensitivity:"base", numeric:true }));
  return out;
}

function buildGroupsData_(t){
  return buildGroupsStandings_(t);
}

function cacheGroupsForTeamModal_(groups){
  TEAM_MODAL_CACHE = new Map();
  (groups || []).forEach(g=>{
    const gid = String(g?.gid || "").trim();
    (g.players || []).forEach((p, idx)=>{
      TEAM_MODAL_CACHE.set(String(p.id), { ...p, gid, rank: idx + 1 });
    });
  });
}

function renderGroupCard_(g){
  const gid = String(g?.gid || "").trim();
  const players = Array.isArray(g?.players) ? g.players : [];
  return `
    <div class="group-card" data-group="${escapeHtml(gid)}">
      <div class="group-card-head">
        <div class="group-card-title">GRUPO <b>${escapeHtml(gid)}</b></div>
        <div class="group-card-sub">${players.length} jugadores</div>
      </div>
      <div class="group-list">
        ${players.map((p, idx) => `
          <div class="group-row">
            <div class="group-rank">${idx + 1}</div>
            <div class="group-left">
              <div class="group-name-line">
                <div class="group-name">${escapeHtml(p.name)}</div>
                <button class="team-btn" type="button" data-pid="${escapeHtml(String(p.id))}" title="Ver equipo">
                  <span class="team-btn-ico">👁</span>
                </button>
              </div>
              <div class="group-rec">
                ${numOr0_(p.w)}-${numOr0_(p.l)}
                <span class="group-rec-sub">(${numOr0_(p.gw)}-${numOr0_(p.gl)})</span>
              </div>
            </div>
            <div class="group-pts" title="Puntos">${numOr0_(p.pts)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderGroupsSection(t){
  const sec  = $("groupsSection");
  const grid = $("groupsGrid");
  if(!sec || !grid) return;
  const groups = buildGroupsData_(t);
  if(!groups.length){
    sec.style.display = "none";
    grid.innerHTML = "";
    return;
  }
  cacheGroupsForTeamModal_(groups);
  wireTeamModalOnce_();
  sec.style.display = "block";
  grid.innerHTML = groups.map(g => renderGroupCard_(g)).join("");
}

let TEAM_MODAL_BOUND = false;

function wireTeamModalOnce_(){
  if(TEAM_MODAL_BOUND) return;
  TEAM_MODAL_BOUND = true;
  const modal = $("teamModal");
  const closeBtn = $("closeTeamModalBtn");
  if(closeBtn){
    closeBtn.addEventListener("click", closeTeamModal_);
  }
  window.addEventListener("click", (e) => {
    if(modal && e.target === modal) closeTeamModal_();
  });
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeTeamModal_();
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".team-btn");
    if(!btn) return;
    e.preventDefault();
    const pid = String(btn.dataset.pid || "").trim();
    if(pid) openTeamModal_(pid);
  });
}

function openTeamModal_(pid){
  const modal = $("teamModal");
  if(!modal) return;
  const data = TEAM_MODAL_CACHE.get(String(pid)) || null;
  if(!data){
    showToast("⚠ No encontré el equipo de este jugador");
    return;
  }
  const title = $("teamModalTitle");
  const meta  = $("teamModalMeta");
  const grid  = $("teamModalGrid");
  if(title) title.textContent = data.name || "Equipo";
  if(meta){
    meta.innerHTML = `
      <span class="team-badge">GRUPO <b>${escapeHtml(data.gid || "-")}</b></span>
      <span class="team-stat">#${numOr0_(data.rank) || "-"}</span>
      <span class="team-stat">PTS: <b>${numOr0_(data.pts)}</b></span>
      <span class="team-stat">W-L: <b>${numOr0_(data.w)}-${numOr0_(data.l)}</b></span>
      <span class="team-stat">G: <b>${numOr0_(data.gw)}-${numOr0_(data.gl)}</b></span>
    `;
  }
  if(grid){
    const team = Array.isArray(data.team) ? data.team.slice(0,6) : [];
    while(team.length < 6) team.push("");
    grid.innerHTML = team.map(tok=>{
      const t = String(tok||"").trim();
      const label = t ? (iconLabelFor(t) || t) : "Vacío";
      const url = t ? monImgUrl_(t) : "";
      if(!t){
        return `<div class="team-poke team-poke--empty" title="Vacío"><div class="team-poke-empty">—</div></div>`;
      }
      return `
        <div class="team-poke" title="${escapeHtml(label)}">
          <img src="${escapeHtml(url)}" alt="${escapeHtml(label)}"
               onerror="this.style.display='none'; this.parentElement.classList.add('team-poke--empty'); this.parentElement.innerHTML='?';">
        </div>
      `;
    }).join("");
  }
  modal.style.display = "flex";
  const reg = $("formModal");
  const regOpen = reg && reg.style.display === "flex";
  if(!regOpen) bloquearScrollBody();
}

function closeTeamModal_(){
  const modal = $("teamModal");
  if(!modal) return;
  modal.style.display = "none";
  const reg = $("formModal");
  const regOpen = reg && reg.style.display === "flex";
  if(!regOpen) restaurarScrollBody();
}

function fmtTrainerCode12_(raw){
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 12);
  if(digits.length !== 12) return String(raw || "").trim();
  return digits.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3");
}

function buildRound1OpponentMap_(t){
  const map = {};
  const matches = Array.isArray(t?.matches) ? t.matches : [];
  const byId = t?.byId || {};
  matches
    .filter(m => Number(m.Round || 0) === 1)
    .forEach(m => {
      const aId = String(m.PlayerAId || "").trim();
      const bId = String(m.PlayerBId || "").trim();
      const aName = byId[aId]?.name || aId || "";
      const bName = byId[bId]?.name || bId || "";
      if(aId && bId){
        map[aId] = bName;
        map[bId] = aName;
      }else if(aId && !bId){
        map[aId] = "BYE";
      }else if(!aId && bId){
        map[bId] = "BYE";
      }
    });
  return map;
}

function normalizeGroupId_(raw){
  const s = String(raw || "").trim().toUpperCase();
  if(!s) return "";
  return s.replace(/^GRUPO\s+/i, "").replace(/^GROUP\s+/i, "").trim();
}

function buildPlayerGroupMap_(t){
  const map = {};
  const matches = Array.isArray(t?.matches) ? t.matches : [];
  matches.forEach(m => {
    const stage = String(m?.Stage ?? m?.stage ?? "").trim().toLowerCase();
    if(stage !== "groups") return;
    const gid = normalizeGroupId_(m?.GroupId ?? m?.groupId ?? "");
    if(!gid) return;
    const a = String(m?.PlayerAId ?? m?.playerAId ?? "").trim();
    const b = String(m?.PlayerBId ?? m?.playerBId ?? "").trim();
    if(a && !map[a]) map[a] = gid;
    if(b && !map[b]) map[b] = gid;
  });
  return map;
}

function renderPrepPokeFace_(name){
  const n = String(name||"").trim();
  if(!n) return `<div class="prep-poke"><span>?</span></div>`;
  const url = spriteUrl(n);
  return `
    <div class="prep-poke" title="${escapeHtml(n)}">
      <img src="${escapeHtml(url)}" alt="${escapeHtml(n)}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span>${escapeHtml(n)}</span>'">
    </div>
  `;
}

async function copyText_(text){
  const s = String(text || "");
  if(!s) return false;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(s);
      return true;
    }
  }catch(_){ }
  try{
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  }catch(_){
    return false;
  }
}

function wirePrepCopyButtons_(){
  const root = $("eventSummary");
  if(!root) return;
  if(root.dataset.copyBound === "1") return;
  root.dataset.copyBound = "1";
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest(".prep-copy-btn");
    if(!btn) return;
    const code = String(btn.getAttribute("data-code") || "").trim();
    if(!code) return;
    const digits = code.replace(/\D/g, "");
    if(digits.length !== 12){
      showToast("⚠ Código inválido");
      return;
    }
    const ok = await copyText_(digits);
    showToast(ok ? "✅ Código copiado" : "⚠ No se pudo copiar");
  });
}

function teamTokenToIconId_(tok){
  const s = String(tok || "").trim();
  if(!s) return "";
  const first = s.split(" - ")[0].trim();
  return first.split(/\s+/)[0].trim().toLowerCase();
}

function renderPrepPokeIcon_(tok){
  const id = teamTokenToIconId_(tok);
  if(!id) return `<div class="prep-poke prep-poke--empty">?</div>`;
  const title = iconLabelFor(id) || id;
  const src = iconUrl(id);
  return `
    <div class="prep-poke" title="${escapeHtml(title)}">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(title)}"
           onerror="this.onerror=null;this.style.display='none';this.parentElement.classList.add('prep-poke--empty');this.parentElement.innerHTML='?';">
    </div>
  `;
}

function renderPrepParticipantCard(p, oppName, showVs, groupId){
  const name = p.NombrePokemonGO || p.Nick || p.Nombre || "Jugador";
  const codeNice = fmtTrainerCode12_(p.Codigo || p.codigo || "");
  const team = (getTeamFromInscrito(p) || []).map(x=>String(x||"").trim()).filter(Boolean);
  const slots = [];
  for(let i=0;i<6;i++) slots.push(team[i] || "");
  const teamHtml = slots.map(tok => renderPrepPokeIcon_(tok)).join("");
  const opp = String(oppName || "").trim();
  const gid = normalizeGroupId_(groupId);
const groupHtml = (showVs && gid)
  ? `<div class="prep-group-badge" title="Grupo ${escapeHtml(gid)}">GRUPO <b>${escapeHtml(gid)}</b></div>`
  : "";
  const statusHtml = showVs
    ? `Próximo enfrentamiento: <b>VS ${opp ? escapeHtml(opp) : "por definir"}</b>`
    : `Esperando enfrentamiento`;
  const statusClass = showVs ? "prep-status prep-status--vs" : "prep-status prep-status--wait";
  const digits = String(codeNice || "").replace(/\D/g,"");
  const canCopy = (digits.length === 12);
return `
    <div class="prep-card" data-group="${escapeHtml(gid)}">
      ${groupHtml}
      <div class="prep-name">${escapeHtml(name)}</div>
      <div class="prep-code-row">
        <div class="prep-code">
          <div class="prep-code-label">CÓDIGO ENTRENADOR</div>
          <div class="prep-code-val">${escapeHtml(codeNice || "—")}</div>
        </div>
        <button
          class="prep-copy-btn"
          type="button"
          data-code="${escapeHtml(codeNice)}"
          aria-label="Copiar código"
          ${canCopy ? "" : "disabled"}
        >
          <svg class="prep-copy-ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
          </svg>
        </button>
      </div>
      <div class="prep-team">
        ${teamHtml}
      </div>
      <div class="prep-footer">
        <div class="${statusClass}">${statusHtml}</div>
      </div>
    </div>
  `;
}

function renderPrepParticipants(t){
  const box = $("eventSummary");
  if(!box) return;
  const inscritos = Array.isArray(t?.inscritos) ? t.inscritos : [];
  const players = inscritos
    .filter(x => {
      const st = String(x.Estado || x.estado || "").toLowerCase();
      return st === "inscrito" || st === "aprobado" || st === "approved";
    })
    .slice();
  const oppMap  = buildRound1OpponentMap_(t);
  const groupMap = buildPlayerGroupMap_(t);
  const showVs  = !!t?.generated; 
  players.sort((a,b) => {
    const na = String(a.NombrePokemonGO || a.Nick || a.Nombre || "");
    const nb = String(b.NombrePokemonGO || b.Nick || b.Nombre || "");
    if(!showVs){
      return na.localeCompare(nb, "es", { sensitivity:"base" });
    }
    const pidA = String(a.PlayerId || a.playerId || "").trim();
    const pidB = String(b.PlayerId || b.playerId || "").trim();
    const gA = normalizeGroupId_(pidA ? (groupMap[pidA] || "") : "");
    const gB = normalizeGroupId_(pidB ? (groupMap[pidB] || "") : "");
    const keyA = gA || "ZZZ"; 
    const keyB = gB || "ZZZ";
    if(keyA !== keyB){
      return keyA.localeCompare(keyB, "en", { sensitivity:"base", numeric:true });
    }
    return na.localeCompare(nb, "es", { sensitivity:"base" });
  });
  const cardsHtml = players.map(p => {
  const pid = String(p.PlayerId || p.playerId || "").trim();
  const oppName = pid ? (oppMap[pid] || "") : "";
  const gid = pid ? (groupMap[pid] || "") : "";
  return renderPrepParticipantCard(p, oppName, showVs, gid);
}).join("");
  box.style.display = "block";
  box.innerHTML = `
    <div class="meta-row meta-row--format meta-row--participants">
     <span class="meta-label">PARTICIPANTES:</span>
      <span class="meta-value meta-value--participants">
        <span class="participants-text">${players.length}</span>
        <span class="participants-sub">jugadores</span>
      </span>
    </div>
    <div class="prep-wrap">
      <div class="prep-grid">
        ${cardsHtml || `<div style="color:#fff;opacity:.85;font-weight:900;">Aún no hay participantes.</div>`}
      </div>
    </div>
  `;
  wirePrepCopyButtons_();
}

function renderMatchCard(title, t, m){
  if(!m){
    return `
      <div class="match-card">
        <div class="match-head">
          <div class="match-title">${escapeHtml(title)}</div>
          <div class="match-meta">${escapeHtml(t.generated ? "🏆 Bracket" : "⏳ Aún no")}</div>
        </div>
        <div style="color:#fff; opacity:.9; font-weight:800;">
          No hay enfrentamientos pendientes aún.
        </div>
      </div>
    `;
  }
  const aId = String(m.PlayerAId||"");
  const bId = String(m.PlayerBId||"");
  const a = t.byId[aId] || { name: aId, team: [] };
  const b = t.byId[bId] || { name: bId, team: [] };
  const labelR = roundLabel(m.Round, t.maxRound);
  const meta = `${labelR} · BO${t.bestOf || "-"}`;
  const aTeam = (a.team || []).map(p => renderPoke(p)).join("");
  const bTeam = (b.team || []).map(p => renderPoke(p)).join("");
  return `
    <div class="match-card">
      <div class="match-head">
        <div class="match-title">${escapeHtml(title)}</div>
        <div class="match-meta">${escapeHtml(meta)}</div>
      </div>
      <div class="vs">
        <div class="playerBox">
          <div class="playerName">
            <span>${escapeHtml(a.name)}</span>
            <span class="playerTag">A</span>
          </div>
          <div class="pokeGrid">${aTeam || renderEmptyTeam()}</div>
        </div>
        <div class="vs-mid">VS</div>
        <div class="playerBox">
          <div class="playerName">
            <span>${escapeHtml(b.name)}</span>
            <span class="playerTag">B</span>
          </div>
          <div class="pokeGrid">${bTeam || renderEmptyTeam()}</div>
        </div>
      </div>
     <div class="match-footer">
  Match: ${escapeHtml(m.MatchId || "-")} · Estado: ${escapeHtml(String(m.Status||"pending"))}
</div>
    </div>
  `;
}

function renderEmptyTeam(){
  return new Array(6).fill(0).map(()=> `<div class="poke"><span>?</span></div>`).join("");
}

function renderPoke(name){
  const n = String(name||"").trim();
  if(!n) return `<div class="poke"><span>?</span></div>`;
  const url = spriteUrl(n);
  return `
    <div class="poke" title="${escapeHtml(n)}">
      <img src="${escapeHtml(url)}" alt="${escapeHtml(n)}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span>${escapeHtml(n)}</span>'">
    </div>
  `;
}

function renderBracket(t){
  const wrap = $("bracket");
  if(!wrap) return;
  const torneoId = String(t?.torneoId || SELECTED_ID || "t0");
  const matches = sortMatches_(Array.isArray(t?.matches) ? t.matches : []);
  matches.forEach((m,i)=> { try{ m.__brIdx = i; }catch(_){ } });
  if(!matches.length){
    wrap.innerHTML = `<div class="rule-empty" style="padding:14px; text-align:center;">Aún no hay bracket generado.</div>`;
    BRACKET_MEM.delete(torneoId);
    return;
  }
  const byRound = {};
  matches.forEach(m=>{
    const r = Number(m?.Round ?? m?.round ?? 1);
    (byRound[r] ||= []).push(m);
  });
  const rounds = Object.keys(byRound).map(Number).sort((a,b)=>a-b);
  const maxRound = Math.max(...rounds);
  const sig = bracketSig_(matches);
  const prev = BRACKET_MEM.get(torneoId) || {};
  const prevScroll = document.getElementById("bracketScroll");
  const needBuild = (!prevScroll) || (prev.sig !== sig);
  const vis = bracketComputeVisibility_(t, matches, maxRound);
  const minRoundToShow = vis.minRoundToShow;
  const visibleSideRounds = vis.visibleSideRounds;
  const current = vis.current;
  let keepScale = prev.scale || 1;
  let keepLeft = prev.left || 0;
  let keepTop  = prev.top  || 0;
  if(prevScroll){
    const cs = getComputedStyle(prevScroll);
    keepScale = parseFloat(cs.getPropertyValue("--bracketScale")) || keepScale || 1;
    keepLeft = prevScroll.scrollLeft;
    keepTop  = prevScroll.scrollTop;
  }

  if(needBuild){
    const sideRounds = rounds.filter(r => r < maxRound);
    const leftCols = [];
    const rightCols = [];
    sideRounds.forEach(r=>{
      const list = sortMatches_(byRound[r] || []);
      const half = Math.ceil(list.length / 2);
      leftCols.push({ r, list: list.slice(0, half) });
      rightCols.push({ r, list: list.slice(half) });
    });
    const finalMatch = (byRound[maxRound] || [])[0] || null;
    const matchHTML = (m, side, r, i) => {
      const aId = getMatchPlayerId_(m, "A");
      const bId = getMatchPlayerId_(m, "B");
      const aName = (t.byId?.[aId]?.name) || getMatchPlayerName_(m,"A") || aId || "TBD";
      const bName = (t.byId?.[bId]?.name) || getMatchPlayerName_(m,"B") || bId || "TBD";
      const aScore = getScoreA_(m);
      const bScore = getScoreB_(m);
      const bo = Number(m?.bestOf ?? m?.BestOf ?? t?.bestOf ?? 3) || 3;
      const need = needWinsFromBestOf(bo);
      const finished = isMatchDone_(m) || (aScore >= need) || (bScore >= need);
      const aCls = finished ? (aScore > bScore ? "win" : (bScore > aScore ? "lose" : "")) : "";
      const bCls = finished ? (bScore > aScore ? "win" : (aScore > bScore ? "lose" : "")) : "";
      const domId = bracketDomId_(m, (typeof m.__brIdx === "number" ? m.__brIdx : i));
      const curId = current ? bracketDomId_(current, (typeof current.__brIdx === "number" ? current.__brIdx : 0)) : "";
      const isCurrent = curId && domId === curId;
      return `
        <div class="match-node${isCurrent ? " is-current" : ""}"
             data-matchid="${escapeHtml(domId)}"
             data-side="${side}" data-round="${r}" data-index="${i}">
          <div class="player-row ${aCls}">
            <div class="player-name">${escapeHtml(aName)}</div>
            <div class="player-badge">${aScore}</div>
          </div>
          <div class="player-row ${bCls}">
            <div class="player-name">${escapeHtml(bName)}</div>
            <div class="player-badge">${bScore}</div>
          </div>
        </div>
      `;
    };
    const colHTML = (title, matchesArr, side, r) => {
      const hidden = (r < minRoundToShow);
      return `
        <div class="round-col${hidden ? " is-hidden" : ""}" data-round="${r}" data-side="${side}">
          <div class="round-title">${escapeHtml(title)}</div>
          ${matchesArr.map((m,i)=> matchHTML(m, side, r, i)).join("")}
        </div>
      `;
    };
    const leftHTML = leftCols.map(c => colHTML(roundLabel(c.r, maxRound), c.list, "left", c.r)).join("");
    const rightHTML = rightCols.map(c => colHTML(roundLabel(c.r, maxRound), c.list, "right", c.r)).join("");
    const centerMatchHTML = finalMatch
      ? matchHTML(finalMatch, "center", maxRound, 0)
      : `<div class="rule-empty" style="text-align:center;">Final por definir</div>`;
    wrap.innerHTML = `
      <div class="bracket-scroll" id="bracketScroll">
        <svg id="bracketLines" class="bracket-lines"></svg>
        <div class="bracket-layout" id="bracketLayout">
          <div class="bracket-side left" id="bracketLeft">${leftHTML}</div>
          <div class="bracket-center" id="bracketCenter">
            <div class="center-title">FINAL</div>
            ${centerMatchHTML}
          </div>
          <div class="bracket-side right" id="bracketRight">${rightHTML}</div>
        </div>
      </div>
    `;
    const scroll = document.getElementById("bracketScroll");
    if(scroll){
      scroll.dataset.maxRound = String(maxRound);
      scroll.dataset.visibleRounds = JSON.stringify(visibleSideRounds);
      scroll.style.setProperty("--bracketScale", String(keepScale || 1));
      scroll.classList.add("no-anim");
      window.__BRACKET_DRAW_FN = () => requestAnimationFrame(drawBracketLinesStatic_);
      requestAnimationFrame(() => {
        scroll.scrollLeft = keepLeft || 0;
        scroll.scrollTop  = keepTop  || 0;
        fitBracketToScreen();
        window.__BRACKET_DRAW_FN();
        requestAnimationFrame(() => scroll.classList.remove("no-anim"));
      });
    }
    BRACKET_MEM.set(torneoId, { sig, scale: keepScale || 1, left: keepLeft || 0, top: keepTop || 0 });
  }else{
    const scroll = document.getElementById("bracketScroll");
    if(scroll){
      scroll.dataset.maxRound = String(maxRound);
      scroll.dataset.visibleRounds = JSON.stringify(visibleSideRounds);
      bracketApplyVisibilityToDom_(minRoundToShow, maxRound);
    }
    bracketPatchNodes_(t, matches, current);
    const cs = scroll ? getComputedStyle(scroll) : null;
    const scale = scroll ? (parseFloat(cs.getPropertyValue("--bracketScale")) || 1) : 1;
    BRACKET_MEM.set(torneoId, {
      sig,
      scale,
      left: scroll ? scroll.scrollLeft : 0,
      top:  scroll ? scroll.scrollTop  : 0
    });
  }

  if(!window.__BRACKET_EVENTS_BOUND){
    window.__BRACKET_EVENTS_BOUND = 1;
    const redraw = () => {
      if(!window.__BRACKET_DRAW_FN) window.__BRACKET_DRAW_FN = () => requestAnimationFrame(drawBracketLinesStatic_);
      window.__BRACKET_DRAW_FN();
    };
    const refitAndRedraw = () => {
      requestAnimationFrame(() => {
        const s = document.getElementById("bracketScroll");
        if(s) s.classList.add("no-anim");
        fitBracketToScreen();
        redraw();
        setTimeout(redraw, 120);
        requestAnimationFrame(() => { if(s) s.classList.remove("no-anim"); });
      });
    };
    window.addEventListener("resize", refitAndRedraw, { passive:true });
    document.addEventListener("visibilitychange", () => { if(!document.hidden) refitAndRedraw(); });
    window.addEventListener("focus", refitAndRedraw, { passive:true });
    window.addEventListener("pageshow", refitAndRedraw, { passive:true });
  }
}

/* Registro */
$("btnRegister").onclick = async () => {
  const btn = $("btnRegister");
  if (btn.dataset.sending === "1") return;
  const codigo = $("codigo").value.trim();
  if (!/^\d+$/.test(codigo)){
    return showToast("⚠ El código entrenador solo debe tener números");
  }
  if (codigo.length !== 12){
    return showToast("⚠ El código entrenador debe tener 12 dígitos");
  }
  const tSel = TORNEOS.find(x => x.torneoId === SELECTED_ID) || TORNEOS[0];
  const rulesObj = tSel ? getPerLeagueRules_(tSel) : null;
  const rulesKeys = rulesObj ? Object.keys(rulesObj.leagues || {}) : [];
  const isMultiLeague = !!rulesObj && rulesKeys.length > 1;

  const dexFromPid = (pid) => {
    const m = String(pid || "").trim().match(/^(\d{1,4})/);
    return m ? Number(m[1]) : null;
  };

  const getDex = (id) => {
    const el = document.getElementById(id);
    const dx = Number(el?.dataset?.dex);
    if (dx) return dx;
    const pid = String(el?.dataset?.pid || "").trim();
    const dx2 = dexFromPid(pid);
    if (dx2) return dx2;
    return parseDexFromInput(el?.value);
  };

  const getPid = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const pid = String(el.dataset.pid || "").trim();
    if (pid) return pid;
    const opt = POKE_OPT_BY_LABEL.get(el.value.trim());
    if (opt?.id) return String(opt.id);
    const dx = getDex(id);
    return dx ? String(dx) : null;
  };

  let pCols = null;

  if(isMultiLeague){
    modalSaveCurrentLeaguePicks_();
    const keys = (MODAL_LEAGUE_KEYS && MODAL_LEAGUE_KEYS.length) ? MODAL_LEAGUE_KEYS : rulesKeys;
    const entries = keys.map(k => {
      const cp = leagueCpFromLeagueKey_(k);
      const prefix = cp ? `liga${cp}` : `liga${k}`;
      const pids = MODAL_PICKS_BY_LEAGUE.get(k) || [];
      return { key:k, cp, prefix, pids };
    });
    for(const e of entries){
      const labelLiga = e.cp ? `Liga ${e.cp}` : e.key;
      if(!Array.isArray(e.pids) || e.pids.length !== 6 || e.pids.some(x => !String(x||"").trim())){
        showToast(`⚠ Completa los 6 Pokémon de ${labelLiga}`);
        return;
      }
      const dexes = e.pids.map(dexFromPid).map(Number).filter(Boolean);
      if(dexes.length !== 6 || new Set(dexes).size !== 6){
        showToast(`⚠ No puedes repetir el mismo Pokémon en ${labelLiga}`);
        return;
      }
    }
    pCols = {};
    for(let i=0; i<6; i++){
      const tokens = entries.map(e => `${e.prefix}.${String(e.pids[i]).trim()}`);
      pCols[`p${i+1}`] = tokens.join(",");
    }
  } else {
    const pid1 = getPid("p1"), pid2 = getPid("p2"), pid3 = getPid("p3"),
          pid4 = getPid("p4"), pid5 = getPid("p5"), pid6 = getPid("p6");
    if(!pid1 || !pid2 || !pid3 || !pid4 || !pid5 || !pid6){
      showToast("⚠ Completa los 6 Pokémon (elige de la lista)");
      return;
    }
    const d1 = getDex("p1"), d2 = getDex("p2"), d3 = getDex("p3"),
          d4 = getDex("p4"), d5 = getDex("p5"), d6 = getDex("p6");
    const arrDex = [d1,d2,d3,d4,d5,d6].map(Number).filter(Boolean);
    if (arrDex.length !== 6 || new Set(arrDex).size !== 6){
      showToast("⚠ No puedes repetir el mismo Pokémon");
      return;
    }
    pCols = {
      p1: String(pid1), p2: String(pid2), p3: String(pid3),
      p4: String(pid4), p5: String(pid5), p6: String(pid6),
    };
  }

  btn.dataset.sending = "1";
  const oldText = btn.textContent;
  btn.textContent = "⏳ Enviando...";
  btn.disabled = true;

  try{
    const payload = {
      torneoId: SELECTED_ID || "",
      nombre: $("nombre").value.trim(),
      nick: $("nick").value.trim(),
      codigo: $("codigo").value.trim(),
      campfire: $("campfire").value.trim(),
      ...pCols
    };
    const r = await torneoRegisterGET(payload);
    if(!r || !r.ok){
      showToast("⚠ " + (r?.error || "Error"));
      return;
    }
    showToast("✅ Inscrito al torneo");
    $("formModal").style.display = "none";
    restaurarScrollBody();
    resetModalForm(); 
    await loadAll(true);
  } finally {
    btn.dataset.sending = "0";
    btn.textContent = oldText;
    btn.disabled = false;
  }
};

/* Init */
(async function init(){
  try{
    await loadPokemonDB();
    try{
      await loadMovesDB();
    }catch(e){
      console.warn("Moves DB no cargó:", e);
    }
    await loadAll(true);           
    setInterval(loadAll, 12000);   
  }catch(e){
    $("torneoInfo").textContent = "Error cargando torneo";
    showToast("⚠ " + (e?.message || e));
  }
})();

let fitBracketTimer = null;
let lastKnownScale = 1;
let lastScrollEl = null;

function fitBracketToScreen(){
  const scroll = document.getElementById("bracketScroll") || document.querySelector(".bracket-scroll");
  if(!scroll) return;
  const layout = scroll.querySelector(".bracket-layout");
  if(!layout) return;
  if(lastScrollEl !== scroll){
    lastScrollEl = scroll;
    lastKnownScale = -1;
  }
  if(document.hidden) return;
  const available = scroll.clientWidth;
  const full = layout.scrollWidth || 1;
  if(available <= 0 || full <= 0) return;
  const MIN_SCALE = 0.55;
  const MAX_SCALE = 1;
  const base = available / full;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, base));
  const currentCss = parseFloat(getComputedStyle(scroll).getPropertyValue("--bracketScale")) || 1;
  if(Math.abs(scale - currentCss) >= 0.005 || Math.abs(scale - lastKnownScale) >= 0.005){
    scroll.style.setProperty("--bracketScale", scale.toFixed(4));
    lastKnownScale = scale;
  }
  const rawH = layout.scrollHeight || layout.offsetHeight || 1;
  scroll.style.height = Math.ceil(rawH * scale) + "px";
  const scaledWidth = full * scale;
  if(scaledWidth > available + 1){
    scroll.style.overflowX = "auto";
    layout.style.marginLeft = "0";
  }else{
    scroll.style.overflowX = "hidden";
    layout.style.marginLeft = ((available - scaledWidth) / 2) + "px";
  }
}

function fitBracketToScreenDebounced(){
  clearTimeout(fitBracketTimer);
  fitBracketTimer = setTimeout(() => {
    fitBracketToScreen();
  }, 150); 
}

window.addEventListener("resize", fitBracketToScreenDebounced);
document.addEventListener("visibilitychange", () => {
  if(!document.hidden) {
    setTimeout(() => {
      fitBracketToScreen();
    }, 200);
  }
});
