// ======================================================
// CONFIG
// ======================================================
const SHEET_NAME = "Registro";

const USERS = {
  daniel: { pin: "9999", role: "owner" }
};

// ======================================================
// API PRINCIPAL (ÚNICO doGet)
// ======================================================
function doGet(e) {
  const accion = e.parameter.accion || "";

  switch (accion) {

    // ---------- PUBLICO ----------
    case "obtener":
      return json(obtenerAprobados());

    case "validarCodigo":
      return json({ existe: verificarCodigo(e.parameter.codigo || "") });

    case "guardar":
      return json({ respuesta: guardarDatos(e.parameter) });

    case "version":
      return json({ version: obtenerVersion() });

    case "limpiarCache":
      limpiarCacheAprobados();
      return texto("Cache limpiado");

case "torneo_export_json":
  return json(torneo_export_json(e.parameter));


    // ---------- PANEL ----------
    case "login":
      return loginPanel(e.parameter);

    case "panelListar":
      return json(obtenerPendientes());

  case "aprobar":
  aprobarFila(Number(e.parameter.fila), e.parameter.user);
  return json({ ok: true });

case "rechazar":
  rechazarFila(Number(e.parameter.fila), e.parameter.user);
  return json({ ok: true });

  case "torneo_update":
  return json(torneo_update(e.parameter));

    // ---------- TORNEOS (GET) ----------
    case "torneo_list":
  return json(torneo_list());

case "torneo_config":
  return json(torneo_config(e.parameter));

case "torneo_list_inscritos":
  return json(torneo_list_inscritos(e.parameter));

case "torneo_list_matches":
  return json(torneo_list_matches(e.parameter));

  case "match_update_status":
  return json(match_update_status(e.parameter));

case "match_update_location":
  return json(match_update_location(e.parameter));


case "torneo_register":
  return json(torneo_register(e.parameter));

case "torneo_update_rules":
  return json(torneo_update_rules(e.parameter));

case "torneo_delete":
  return json(torneo_delete(e.parameter));

case "torneo_update_score":
  return json(torneo_update_score(e.parameter));

case "torneo_unreport_result":
  return json(torneo_unreport_result(e.parameter));



// ---------- TORNEOS (GET acciones admin) ----------
case "torneo_crear":
  return json(torneo_crear(e.parameter));

case "torneo_close":
  return json(torneo_close(e.parameter));

case "torneo_open":
  return json(torneo_open(e.parameter));


case "torneo_generate_single":
  return json(torneo_generate_single(e.parameter));

  case "torneo_force_start":
  return json(torneo_force_start(e.parameter));

case "torneo_seed_dummy_inscritos":
  return json(torneo_seed_dummy_inscritos(e.parameter));


case "torneo_report_result":
  return json(torneo_report_result(e.parameter));

  case "torneo_generate":
  return json(torneo_generate(e.parameter));

case "torneo_groups_seed_playoffs":
  return json(torneo_groups_seed_playoffs(e.parameter));




    default:
  return json({ ok:false, error: "Acción no válida" });
  }
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";

    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      data = {}; // si no es JSON, seguimos igual
    }

    // ✅ accion puede venir del JSON o del querystring (?accion=...)
    const accion = String(
      (data && (data.accion || data.action)) ||
      (e && e.parameter && e.parameter.accion) ||
      ""
    ).trim();

    switch (accion) {
      case "ping":
        return json({ ok:true, accion:"ping", rawLen: raw.length });

      case "torneo_register":        return json(torneo_register(data));
      case "torneo_crear":           return json(torneo_crear(data));
      case "torneo_update":          return json(torneo_update(data));
      case "torneo_update_rules":    return json(torneo_update_rules(data));
      case "torneo_delete":          return json(torneo_delete(data));
      case "torneo_close":           return json(torneo_close(data));
      case "torneo_open":            return json(torneo_open(data));
      case "torneo_generate_single": return json(torneo_generate_single(data));
      case "torneo_generate":        return json(torneo_generate(data));
      case "torneo_groups_seed_playoffs": return json(torneo_groups_seed_playoffs(data));
      case "torneo_report_result":   return json(torneo_report_result(data));
      case "torneo_update_score":    return json(torneo_update_score(data));
case "match_update_status":    return json(match_update_status(data));
case "match_update_location":  return json(match_update_location(data));
case "torneo_unreport_result": return json(torneo_unreport_result(data));

      case "torneo_force_start":        return json(torneo_force_start(data));
case "torneo_seed_dummy_inscritos": return json(torneo_seed_dummy_inscritos(data));


      default:
        return json({
          ok:false,
          error:"Acción POST no válida",
          accionRecibida: accion,
          rawPreview: String(raw).slice(0, 200),
          keys: Object.keys(data || {})
        });
    }
  } catch (err) {
    return json({ ok:false, error: String(err) });
  }
}




// ======================================================
// RESPUESTAS
// ======================================================
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}


function texto(txt) {
  return ContentService
    .createTextOutput(txt)
    .setMimeType(ContentService.MimeType.TEXT);
}

// ======================================================
// LOGIN PANEL
// ======================================================
function loginPanel(p) {
  const { user, pin } = p;

  if (!USERS[user] || USERS[user].pin !== pin)
    return json({ ok: false });

  return json({
    ok: true,
    role: USERS[user].role
  });
}

// ======================================================
// VALIDAR TEXTO
// ======================================================
function validarTexto(valor, campo) {
  valor = String(valor || "").trim();

  const regex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-_.]+$/;
  if (!regex.test(valor))
    throw new Error(`Campo "${campo}" inválido`);

  return valor;
}

// ======================================================
// GUARDAR REGISTRO
// ======================================================
function guardarDatos(d) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return "Servidor ocupado";

  try {
    const hoja = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    // 🔒 Asegura que la columna D (codigo) sea TEXTO siempre
hoja.getRange("D:D").setNumberFormat("@");

    const nombre  = validarTexto(d.nombre, "Nombre");
    const pokemon = validarTexto(d.pokemon, "Pokémon");
    const codigo  = String(d.codigo || "").trim();

    if (!/^\d{12}$/.test(codigo))
      return "Código inválido";

    // Duplicado
    const codigos = hoja.getRange(2, 4, hoja.getLastRow(), 1)
      .getValues().flat().map(String);

    if (codigos.includes(codigo))
      return "DUPLICADO";

    hoja.appendRow([
      new Date(),
      nombre,
      pokemon,
      codigo,
      d.campfire || "",
      0,
      "Casual",
      "Pendiente",
      ""
    ]);

// ✅ Re-escribe el código como texto en la celda recién creada (col D)
const last = hoja.getLastRow();
hoja.getRange(last, 4).setNumberFormat("@");
hoja.getRange(last, 4).setValue(codigo);


    return "OK";

  } catch (e) {
    return "Error: " + e.message;
  } finally {
    lock.releaseLock();
  }
}

// ======================================================
// OBTENER APROBADOS (WEB)
// ======================================================
function obtenerAprobados() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("aprobados");
  if (cached) return JSON.parse(cached);

  const hoja = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const lastRow = hoja.getLastRow();
  if (lastRow < 2) return [];

  // Lee A:I (9 columnas) desde fila 2 hasta el final
  const datos = hoja.getRange(2, 1, lastRow - 1, 9).getValues();

  const aprobados = datos
    .map((r, idx) => ({ r, fila: idx + 2 })) // fila real de la hoja
    .filter(x => x.r[7] === "Aprobado")       // Columna H (Estado)
    .map(x => ({
      timestamp: x.r[0], // Columna A
      fila: x.fila,      // número de fila en la hoja
      nombre: x.r[1],    // B
      pokemon: x.r[2],   // C
      codigo: x.r[3],    // D
      campfire: x.r[4],  // E
      asistencias: x.r[5], // F
      rango: x.r[6]        // G
    }));

  cache.put("aprobados", JSON.stringify(aprobados), 1800);
  return aprobados;
}

// ======================================================
// PANEL - PENDIENTES
// ======================================================
function obtenerPendientes() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const datos = hoja.getRange(2,1,hoja.getLastRow()-1,9).getValues();

  return datos
    .map((r,i) => ({
      fila: i + 2,
      nombre: r[1],
      pokemon: r[2],
      codigo: r[3],
      estado: r[7]
    }))
    .filter(r => r.estado === "Pendiente");
}


// ======================================================
// VALIDAR CODIGO
// ======================================================
function verificarCodigo(codigo) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const codigos = hoja.getRange(2,4,hoja.getLastRow(),1)
    .getValues().flat().map(String);

  return codigos.includes(String(codigo).trim());
}

// ======================================================
// VERSION / CACHE
// ======================================================
function obtenerVersion() {
  const p = PropertiesService.getScriptProperties();
  return Number(p.getProperty("version") || 1);
}

function limpiarCacheAprobados() {
  CacheService.getScriptCache().remove("aprobados");
  const p = PropertiesService.getScriptProperties();
  p.setProperty("version", obtenerVersion() + 1);
}

function aprobarFila(fila, user) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);

  hoja.getRange(fila, 8).setValue("Aprobado");     // H → Estado
  hoja.getRange(fila, 11).setValue(user);          // K → Quién
  hoja.getRange(fila, 12).setValue(new Date());    // L → Fecha

  limpiarCacheAprobados();
}

function rechazarFila(fila, user) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);

  hoja.getRange(fila, 8).setValue("Rechazado");
  hoja.getRange(fila, 11).setValue(user);
  hoja.getRange(fila, 12).setValue(new Date());

  limpiarCacheAprobados();
}

// ======================================================
// TORNEOS (MULTI-EVENTOS)
// ======================================================

// ---- Hojas ----
const T_SHEET_TORNEOS   = "Torneos";          // NUEVA
const T_SHEET_CONFIG    = "Torneo_Config";    // legacy fallback
const T_SHEET_INSCRITOS = "Torneo_Inscritos";
const T_SHEET_MATCHES   = "Torneo_Matches";
const T_SHEET_AUDIT     = "Torneo_AuditLog";


// ---------------- HELPERS ----------------
function t_ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function t_sh(name) { return t_ss().getSheetByName(name); }

function t_admin_ok(user, pin) {
  return USERS[user] && USERS[user].pin === String(pin || "");
}

function t_nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }
function t_shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function t_now_gmt5() {
  return new Date(); // GAS usa la TZ del proyecto; si quieres fijo: Utilities.formatDate + parse
}

function t_isTrue(v){
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "si" || s === "sí" || s === "verdadero" || s === "TRUE".toLowerCase();
}


function ensurePrepEndsAt_(torneoId, config, sheet, header, rowIndex1Based){
  const colPrep = header.indexOf("prepEndsAt");
  if(colPrep < 0) return;

  const open = String(config.inscriptionsOpen || "").toLowerCase();
  const gen  = String(config.generated || "").toLowerCase();
  const hasPrep = String(config.prepEndsAt || "").trim();

  const isOpen = (open === "true" || open === "1" || open === "si" || open === "sí");
  const isGen  = (gen  === "true" || gen  === "1" || gen  === "si" || gen  === "sí");

  if(!isOpen && !isGen && !hasPrep){
    const end = new Date(Date.now() + 30 * 60 * 1000);
    const tz = Session.getScriptTimeZone();
    const stamp = Utilities.formatDate(end, tz, "yyyy-MM-dd HH:mm:ss");

    sheet.getRange(rowIndex1Based, colPrep + 1).setValue(stamp);
    config.prepEndsAt = stamp; // ✅ para devolverlo ya mismo al JS
  }
}


// ---------------- ENSURE HEADERS ----------------
function t_ensureSheet(name, headers) {
  const ss = t_ss();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  // 1. Leemos SOLO las columnas que existen actualmente
  const currentLastCol = sh.getLastColumn();
  let existing = [];
  
  if (currentLastCol > 0) {
    existing = sh.getRange(1, 1, 1, currentLastCol).getValues()[0]
                 .map(v => String(v || "").trim());
  }

  const existingLower = new Set(existing.map(h => h.toLowerCase()).filter(Boolean));

  // 2. Si la hoja está vacía, ponemos todo el header
  if (existing.length === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sh;
  }

  // 3. Buscamos qué headers faltan
  const missing = headers.filter(h => !existingLower.has(String(h).toLowerCase()));

  // 4. Si faltan columnas, las agregamos al final
  if (missing.length > 0) {
    // Calculamos dónde empezar a escribir (después de la última columna con datos)
    let startCol = currentLastCol + 1;
    
    // Escribimos los headers faltantes
    sh.getRange(1, startCol, 1, missing.length).setValues([missing]);
  }

  return sh;
}


function t_bootstrap() {
  // Torneos
t_ensureSheet(T_SHEET_TORNEOS, [
  "torneoId","title","format","leaguePlan","mode","dateTime","bestOf","boPhasesJson",
  "suggestedSize","inscriptionsOpen","generated","createdAt","createdBy",

  // ✅ REGLAS (todo texto)
  "bannedTypes",
  "bannedCategories",
  "bannedPokemon",
  "allowedPokemon",
  "bannedFastMoves",
  "bannedChargedMoves",
  "allowedTypes",
  "allowedCategories",
"leagueRulesJson",
"prepEndsAt",


   // ✅ NUEVO: premios
  "prizesJson",

  // estado
  "status",
  "finishedAt",

  // config grupos
  "groupsCount",
  "groupsQualify",
  "groupSize",
 "currentMatchId",
"battlePaused",

// ✅ Presencial: mesas/escenario
"tablesCount",
"hasMainStage",
"mainStageFrom",
"mainStageRandomPct"
]);



  // ✅ fuerza columnas de reglas como TEXTO
  const tor = t_sh(T_SHEET_TORNEOS);

  function t_setTextCol_(sheet, colName){
  const lastCol = sheet.getLastColumn();
  if(!lastCol) return;
  const hdr = sheet.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  const idx = hdr.indexOf(colName);
  if(idx < 0) return;
  sheet.getRange(1, idx+1, sheet.getMaxRows(), 1).setNumberFormat("@");
}


  // Columnas M:R son 6 columnas desde bannedTypes hasta bannedChargedMoves
  // (M=bannedTypes, N=bannedCategories, O=bannedPokemon, P=allowedPokemon, Q=bannedFastMoves, R=bannedChargedMoves)
 tor.getRange("M:U").setNumberFormat("@");

// ✅ prizesJson (V) y status (W) como TEXTO
tor.getRange("V:W").setNumberFormat("@");

// ✅ boPhasesJson como TEXTO
t_setTextCol_(tor, "boPhasesJson");
t_setTextCol_(tor, "currentMatchId");
t_setTextCol_(tor, "battlePaused");





  // Inscritos
  t_ensureSheet(T_SHEET_INSCRITOS, [
    "Timestamp","TorneoId","PlayerId","Nombre","Nick","Codigo","Campfire","Estado",
    "P1","P2","P3","P4","P5","P6"
  ]);

t_ensureSheet(T_SHEET_MATCHES, [
  "TorneoId","MatchId","Round","Slot",
  "PlayerAId","PlayerBId",
  "ScoreA","ScoreB",
  "WinnerId","LoserId",
  "Status","NextMatchId","NextSide",

  // ✅ columnas extra para formatos avanzados (no rompen single)
  "Stage",       // single | groups | playoffs | swiss
  "GroupId",     // A | B | C | D (si groups)
  "SwissRound",  // 1..N (si swiss)
  "Bracket",     // WB | LB | GF (si double)
  "MetaJson",    // texto libre (desempates, seed, etc.)
  "Location",
"LocationType",


  // ✅ OPERACIÓN EN VIVO (Punto #1)
  "MatchStatus", // scheduled | running | paused | finished | cancelled
  "PausedAt",    // ISO string
  "ResumedAt",   // ISO string
  "UpdatedAt",   // ISO string
  "UpdatedBy",   // texto (admin)
  "HistoryJson"  // JSON array de eventos (auditoría simple)
]);

  // ✅ AUDITORÍA SIMPLE (opcional pero recomendado)
  t_ensureSheet(T_SHEET_AUDIT, [
    "Timestamp","TorneoId","MatchId","Action","By","PayloadJson"
  ]);

  // ✅ fuerza estas columnas como TEXTO (para que no se rompan los IDs/JSON)
  const mat = t_sh(T_SHEET_MATCHES);
  ["MetaJson","MatchStatus","Location","PausedAt","ResumedAt","UpdatedAt","UpdatedBy","HistoryJson,MatchStatus","Location"]
    .forEach(c => t_setTextCol_(mat, c));

  const audit = t_sh(T_SHEET_AUDIT);
  ["Timestamp","TorneoId","MatchId","Action","By","PayloadJson"]
    .forEach(c => t_setTextCol_(audit, c));


}


// ---------------- Torneos table helpers ----------------
function t_torneos_all() {
  t_bootstrap();
  const sheet = t_sh(T_SHEET_TORNEOS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(h => String(h || "").trim());
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    header.forEach((h, idx) => obj[h] = values[i][idx]);
    if (String(obj.torneoId || "").trim()) rows.push(obj);
  }
  return rows;
}

function t_torneo_get(torneoId) {
  torneoId = String(torneoId || "").trim();
  if (!torneoId) return null;

  const all = t_torneos_all();
  return all.find(t => String(t.torneoId).trim() === torneoId) || null;
}

function t_torneo_upsert(obj) {
  t_bootstrap();
  const sheet = t_sh(T_SHEET_TORNEOS);
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(h => String(h || "").trim());

  const torneoId = String(obj.torneoId || "").trim();
  if (!torneoId) throw new Error("torneoId requerido");

  // ✅ obj normalizado a lowercase (para match sin importar mayúsculas)
  const objLC = {};
  Object.keys(obj || {}).forEach(k => {
    objLC[String(k).trim().toLowerCase()] = obj[k];
  });

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === torneoId) {
      rowIndex = i + 1;
      break;
    }
  }

  const row = header.map(h => {
    const key = String(h || "").trim();
    const lc = key.toLowerCase();
    // 1) si existe exacto
    if (obj[key] !== undefined) return obj[key];
    // 2) si existe por lowercase
    if (objLC[lc] !== undefined) return objLC[lc];
    return "";
  });

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, header.length).setValues([row]);
  }
}


// ---------------- Legacy fallback (para no romper panel viejo) ----------------
function t_cfg_getAll_legacy() {
  const sheet = t_sh(T_SHEET_CONFIG);
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || "").trim();
    if (!key) continue;
    out[key] = values[i][1];
  }
  return out;
}

function t_cfg_set_legacy(key, value) {
  const sheet = t_sh(T_SHEET_CONFIG);
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// si no mandan torneoId, usamos último creado o legacy activeTournamentId
function t_resolve_torneoId(paramTorneoId) {
  const raw = String(paramTorneoId ?? "").trim();
  const low = raw.toLowerCase();

  // ✅ si viene basura desde el front, lo tratamos como vacío para usar fallback
  if (raw && low !== "undefined" && low !== "null" && low !== "nan") {
    return raw;
  }

  const all = t_torneos_all();
  if (all.length) {
    const last = all[all.length - 1];
    return String(last.torneoId || "").trim();
  }

  const legacy = t_cfg_getAll_legacy();
  return String(legacy.activeTournamentId || "").trim();
}


// ---------------- PARTICIPANTES sugeridos ----------------
function t_suggestedSize(format) {
  if (format === "groups") return 16;
  if (format === "double") return 16;
  if (format === "swiss")  return 0;
  return 16; // single
}

// ======================================================
// ENDPOINTS (multi-eventos)
// ======================================================

// 1) LISTAR TORNEOS
function torneo_list() {
  const torneos = t_torneos_all()
    .map(t => ({
      torneoId: String(t.torneoId || ""),
      title: String(t.title || ""),
      format: String(t.format || ""),
      leaguePlan: String(t.leaguePlan || ""),
      mode: String(t.mode || ""),
      dateTime: String(t.dateTime || ""),
      bestOf: String(t.bestOf || ""),
      boPhasesJson: String(t.boPhasesJson || ""),
boPhases: parseJsonSafe(t.boPhasesJson, null),
      suggestedSize: Number(t.suggestedSize || 0),
      inscriptionsOpen: String(t.inscriptionsOpen || ""),
      generated: String(t.generated || ""),
      createdAt: t.createdAt || "",
      createdBy: String(t.createdBy || ""),
      allowedTypes: String(t.allowedTypes || ""),
allowedCategories: String(t.allowedCategories || ""),
leagueRulesJson: String(t.leagueRulesJson || ""),


// ✅ NUEVO: premios
prizesJson: String(t.prizesJson || "[]"),

// ✅ estado
status: String(t.status || "active"),
finishedAt: t.finishedAt || "",




      // ✅ reglas
      bannedTypes: String(t.bannedTypes || ""),
      bannedCategories: String(t.bannedCategories || ""),
      bannedPokemon: String(t.bannedPokemon || ""),
      allowedPokemon: String(t.allowedPokemon || ""),
      bannedFastMoves: String(t.bannedFastMoves || ""),
      bannedChargedMoves: String(t.bannedChargedMoves || "")
    }))
    .sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  return { ok: true, torneos };
}

// 2) CONFIG DE UN TORNEO
function torneo_config(p) {
  t_bootstrap();

  const torneoId = t_resolve_torneoId(p && p.torneoId);
  if (!torneoId) return { ok: true, hasTournament: false, config: {} };

  const sheet = t_sh(T_SHEET_TORNEOS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok:false, error:"No hay torneos" };

  const header = values[0].map(h => String(h || "").trim());

  // buscar fila del torneoId (col 1)
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === String(torneoId).trim()) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }
  if (rowIndex === -1) return { ok:false, error:"Torneo no encontrado", torneoId };

  // armar config desde esa fila
  const row = values[rowIndex - 1];
  const config = {};
  header.forEach((h, idx) => config[h] = row[idx]);

  // ✅ aquí se setea prepEndsAt si corresponde (cerrado + no generado + vacío)
  ensurePrepEndsAt_(torneoId, config, sheet, header, rowIndex);

  return { ok: true, hasTournament: true, torneoId, config };
}


// 3) CREAR TORNEO
function torneo_crear(data) {
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const title      = String(data.title || "").trim();
  const format     = String(data.format || "single").trim();
  const leaguePlan = String(data.leaguePlan || data.league || "super1500").trim();
  const mode       = String(data.mode || "presencial").trim();
  const dateTime   = String(data.dateTime || "").trim();
  const bestOf     = String(data.bestOf || "3").trim();

  // puedes permitir override desde UI:
  const suggestedOverride = String(data.suggestedSize || "").trim();
// ✅ Grupos config
const groupSize = 4;
let groupsCount = Number(data.groupsCount || 0);
let groupsQualify = Number(data.groupsQualify || 2);

const fmt = String(format || "").trim().toLowerCase();

if(fmt === "groups"){

  // ✅ FIX: si no llega groupsCount pero sí llega suggestedSize (override),
  // inferimos groupsCount = suggestedSize / 4.
  if((!groupsCount || !Number.isFinite(groupsCount)) && suggestedOverride){
    const sug = Number(suggestedOverride);
    if(Number.isFinite(sug) && sug >= 8 && sug <= 40 && (sug % groupSize === 0)){
      groupsCount = sug / groupSize;
    }
  }

  if(!groupsCount || !Number.isFinite(groupsCount)) groupsCount = 4;
  groupsCount = Math.max(2, Math.min(10, Math.floor(groupsCount)));

  groupsQualify = (groupsQualify === 1) ? 1 : 2;
}


// suggested auto
let suggestedSize = suggestedOverride ? Number(suggestedOverride) : t_suggestedSize(fmt);
if(fmt === "groups"){
  suggestedSize = groupsCount * groupSize; // ✅ cupo = grupos*4
}



  if (!title || !dateTime) return { ok: false, error: "Falta título o fecha/hora" };

  const torneoId = "T" + Utilities.formatDate(new Date(), "GMT-5", "yyyyMMdd-HHmmss");

  const obj = {
    torneoId,
    title,
    format: fmt,
    leaguePlan,
    mode,
    dateTime,
    bestOf,
      // ✅ BO por fase (JSON desde panel)
  boPhasesJson: String(data.boPhasesJson || ""),
    suggestedSize,
    inscriptionsOpen: "TRUE",
    generated: "FALSE",
    createdAt: new Date(),
    createdBy: String(data.user || ""),
    allowedTypes:      t_parseList(data.allowedTypes),
allowedCategories: t_parseList(data.allowedCategories),
leagueRulesJson: String(data.leagueRulesJson || ""),



    // ✅ REGLAS (se guardan tal cual, normalizadas a lista)
    bannedTypes:        t_parseList(data.bannedTypes),
    bannedCategories:   t_parseList(data.bannedCategories),
    bannedPokemon:      t_parseList(data.bannedPokemon),
    allowedPokemon:     t_parseList(data.allowedPokemon),

   bannedFastMoves:    t_parseList(data.bannedFastMoves),
bannedChargedMoves: t_parseList(data.bannedChargedMoves),

// ✅ premios: si el panel manda, se guarda; si no, vacío
prizesJson: String(data.prizesJson || "[]"),
// ✅ config grupos
groupsCount: (format === "groups") ? String(groupsCount) : "",
groupsQualify: (format === "groups") ? String(groupsQualify) : "",
groupSize: (format === "groups") ? "4" : "",
// ✅ Presencial: mesas / escenario
tablesCount: (String(mode).toLowerCase()==="presencial") ? String(data.tablesCount || "").trim() : "",
hasMainStage: (String(mode).toLowerCase()==="presencial" && String(data.hasMainStage||"").toUpperCase()==="TRUE") ? "TRUE" : "FALSE",
mainStageFrom: (String(mode).toLowerCase()==="presencial") ? String(data.mainStageFrom || "semis").trim() : "",
mainStageRandomPct: (String(mode).toLowerCase()==="presencial") ? String(data.mainStageRandomPct || "10").trim() : "",



status: "active",
finishedAt: ""
};





  t_torneo_upsert(obj);

  // legacy fallback (para que tu panel viejo siga funcionando hasta que migremos JS)
  if (t_sh(T_SHEET_CONFIG)) {
    t_cfg_set_legacy("activeTournamentId", torneoId);
  }

  // NO borramos inscritos (son por torneoId).
  // Para matches: solo aseguramos que no existan rows previas con ese torneoId (no deberían existir).
  t_clearMatchesForTournament(torneoId);

  return { ok: true, torneoId, suggestedSize };
}

// 4) CERRAR INSCRIPCIONES
function torneo_close(data) {
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };

t.inscriptionsOpen = "FALSE";
t.prepEndsAt = "";      // ✅ reset para que se regenere cuando llamen a torneo_config
t_torneo_upsert(t);

  return { ok: true, torneoId };
}

// 4.1 Abrir torneo

function torneo_open(data) {
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };

 t.inscriptionsOpen = "TRUE";
t.prepEndsAt = "";      // ✅ reset para borrar cualquier conteo viejo
t_torneo_upsert(t);

  

  return {
  ok: true,
  torneoId,
  saved: {
    allowedTypes: t.allowedTypes,
    allowedCategories: t.allowedCategories
  }
};

}

// 4.2) FORZAR INICIO (fuerza mayor): termina preparación YA (prepEndsAt = ahora)
function torneo_force_start(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };

  // Cierra inscripciones por seguridad
  t.inscriptionsOpen = "FALSE";

  // Deja prepEndsAt en "ahora" para NO esperar 30 minutos
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const stamp = Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss");

  t.prepEndsAt = stamp;

  t_torneo_upsert(t);

  return { ok:true, torneoId, prepEndsAt: stamp, inscriptionsOpen: t.inscriptionsOpen };
}


// 4.3) POBLAR INSCRITOS DUMMY hasta llegar a targetCount (ej. 40)
function torneo_seed_dummy_inscritos(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const targetCount = Number(data.targetCount ?? data.count ?? 40);
  if(!Number.isFinite(targetCount) || targetCount < 1 || targetCount > 200){
    return { ok:false, error:"targetCount inválido (1 a 200)" };
  }

  const t = t_torneo_get(torneoId);
  if(!t) return { ok:false, error:"Torneo no encontrado" };

  // Si es groups, valida máximo por groupsCount*4
  const fmt = String(t.format || "").trim().toLowerCase();
  if(fmt === "groups"){
    const gCount = Number(t.groupsCount || 0);
    const maxPlayers = (gCount && Number.isFinite(gCount)) ? (gCount * 4) : 0;
    if(maxPlayers > 0 && targetCount > maxPlayers){
      return { ok:false, error:`Este torneo (groups) permite máximo ${maxPlayers}. Sube groupsCount/suggestedSize o usa targetCount <= ${maxPlayers}.` };
    }
  }

  const sheet = t_sh(T_SHEET_INSCRITOS);
  const values = sheet.getDataRange().getValues();

  // Cuenta inscritos actuales (ignora rechazados)
  let current = 0;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]) !== torneoId) continue; // TorneoId col2
    const st = String(values[i][7] || "").toLowerCase();
    if(st.includes("rechaz")) continue;
    current++;
  }

  const toAdd = targetCount - current;
  if(toAdd <= 0){
    return { ok:true, torneoId, added:0, currentCount: current, targetCount };
  }

  // Crea filas dummy en batch
  const rows = [];
  for(let k = 1; k <= toAdd; k++){
    const idx = current + k;

    const playerId = "D-" + Utilities.getUuid().slice(0, 8);
    const nombre   = `Dummy ${idx}`;
    const nick     = `Dummy${idx}`;

    // 12 dígitos (evita duplicados por torneo)
    const codigo = "9999" + String(idx).padStart(8, "0");

    const campfire = "";
    const estado = "Inscrito";

    // 6 Pokémon placeholders (puedes cambiarlos luego)
    const p = ["1","2","3","4","5","6"];

    rows.push([
      new Date(),
      torneoId,
      playerId,
      nombre,
      nick,
      codigo,
      campfire,
      estado,
      p[0], p[1], p[2], p[3], p[4], p[5]
    ]);
  }

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);

  return { ok:true, torneoId, added: toAdd, currentCount: current, targetCount };
}


// 5) REGISTRO (POST)
function torneo_register(data) {
  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok: false, error: "Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };

  const open = t_isTrue(t.inscriptionsOpen);

  if (!open) return { ok: false, error: "Inscripciones cerradas" };

  const nombre   = String(data.nombre || "").trim();
  const nick     = String(data.nick || "").trim();
  const codigo   = String(data.codigo || "").trim();
  const campfire = String(data.campfire || "").trim();
  const p = [data.p1,data.p2,data.p3,data.p4,data.p5,data.p6].map(x => String(x || "").trim());

  if (!nombre || !nick || !codigo) return { ok: false, error: "Faltan datos obligatorios" };
  if (p.some(x => !x)) return { ok: false, error: "Debes poner los 6 Pokémon" };

  const sheet = t_sh(T_SHEET_INSCRITOS);
  const values = sheet.getDataRange().getValues();

  // ✅ Cupos máximos en formato groups: groupsCount * 4
const fmt = String(t.format || "").trim().toLowerCase();
if(fmt === "groups"){
  const gCount = Number(t.groupsCount || 0);
  const maxPlayers = (gCount && Number.isFinite(gCount)) ? (gCount * 4) : 0;

  if(maxPlayers > 0){
    let current = 0;
    for (let i = 1; i < values.length; i++) {
      if(String(values[i][1]) !== torneoId) continue;
      const st = String(values[i][7] || "").toLowerCase();
      if(st.includes("rechaz")) continue;
      current++;
    }
    if(current >= maxPlayers){
      return { ok:false, error:`Cupo completo (${maxPlayers} participantes).` };
    }
  }
}


  // Duplicado por (torneoId + codigo)
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]) === torneoId && String(values[i][5]) === codigo) {
      return { ok: false, error: "Ya estás inscrito con ese código" };
    }
  }

  const playerId = "P-" + Utilities.getUuid().slice(0, 8);

  sheet.appendRow([
    new Date(),
    torneoId,
    playerId,
    nombre,
    nick,
    codigo,
    campfire,
    "Inscrito",
    p[0], p[1], p[2], p[3], p[4], p[5]
  ]);

  return { ok: true, torneoId, playerId };
}

// 6) LISTAR INSCRITOS (por torneo)
function torneo_list_inscritos(p) {
  t_bootstrap();

  const torneoId = t_resolve_torneoId(p && p.torneoId);
  if (!torneoId) return { ok: true, torneoId: "", inscritos: [] };

  const sheet = t_sh(T_SHEET_INSCRITOS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, torneoId, inscritos: [] };

  const header = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]) !== torneoId) continue; // TorneoId col2
    const obj = {};
    header.forEach((h, idx) => obj[h] = values[i][idx]);
    rows.push(obj);
  }
  return { ok: true, torneoId, inscritos: rows };
}

// 7) LISTAR MATCHES (por torneo)
function torneo_list_matches(p) {
  t_bootstrap();

  const torneoId = t_resolve_torneoId(p && p.torneoId);
  if (!torneoId) return { ok: true, torneoId: "", matches: [] };

  const sheet = t_sh(T_SHEET_MATCHES);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, torneoId, matches: [] };

  const header = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== torneoId) continue; // TorneoId col1
    const obj = {};
    header.forEach((h, idx) => obj[h] = values[i][idx]);
    rows.push(obj);
  }
  // ✅ defaults para operación (si las nuevas columnas aún no existen o están vacías)
rows.forEach(m => {
  const status = String(m.Status || "").trim().toLowerCase();
  const ms = String(m.MatchStatus || "").trim().toLowerCase();
  if (!ms) m.MatchStatus = (status === "done") ? "finished" : "scheduled";
  if (m.HistoryJson === undefined || m.HistoryJson === null || String(m.HistoryJson).trim() === "") {
    m.HistoryJson = "[]";
  }
  if (m.Location === undefined || m.Location === null) m.Location = "";
});

return { ok: true, torneoId, matches: rows };

}

// =====================================================
// ✅ MATCH OPS (Status/Ubicación + Auditoría) — Punto #1
// =====================================================
function t_isoNow_(){
  // Perú (GMT-5)
  return Utilities.formatDate(new Date(), "GMT-5", "yyyy-MM-dd'T'HH:mm:ss");
}

function t_jsonArraySafe_(raw){
  try{
    const v = (raw === undefined || raw === null) ? "[]" : String(raw);
    const a = JSON.parse(v || "[]");
    return Array.isArray(a) ? a : [];
  }catch(_){
    return [];
  }
}

function t_match_headerMap_(sheet){
  const last = sheet.getLastColumn();
  const hdr = sheet.getRange(1,1,1,last).getValues()[0].map(h => String(h||"").trim());
  const map = {};
  hdr.forEach((h,i)=>{ if(h) map[h] = i+1; });
  return map;
}

function t_match_findRowIndex_(sheet, torneoId, matchId){
  const values = sheet.getDataRange().getValues();
  for(let i=1;i<values.length;i++){
    if(String(values[i][0]) === String(torneoId) && String(values[i][1]) === String(matchId)){
      return i+1; // 1-based
    }
  }
  return -1;
}

function t_audit_append_(torneoId, matchId, action, by, payloadObj){
  try{
    const sh = t_sh(T_SHEET_AUDIT);
    const ts = t_isoNow_();
    const payload = JSON.stringify(payloadObj || {});
    sh.appendRow([ts, String(torneoId||""), String(matchId||""), String(action||""), String(by||""), payload]);
  }catch(_){}
}

function t_match_push_history_(sheet, rowIndex, hmap, ev){
  const col = hmap["HistoryJson"];
  if(!col) return;

  const cell = sheet.getRange(rowIndex, col);
  const arr = t_jsonArraySafe_(cell.getValue());
  arr.push(ev);

  // limit: guarda los últimos 100 eventos
  const trimmed = (arr.length > 100) ? arr.slice(arr.length - 100) : arr;
  cell.setValue(JSON.stringify(trimmed));
}

function match_update_status(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };
  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const matchId = String(data.matchId || "").trim();
  if (!matchId) return { ok:false, error:"Falta matchId" };

  const nextStatus = String(data.matchStatus || "").trim().toLowerCase();
  const allowed = ["scheduled","running","paused","finished","cancelled"];
  if (!allowed.includes(nextStatus)) return { ok:false, error:"MatchStatus inválido" };

  const by = String(data.user || "admin").trim();

  const sheet = t_sh(T_SHEET_MATCHES);
  const hmap = t_match_headerMap_(sheet);
  const rowIndex = t_match_findRowIndex_(sheet, torneoId, matchId);
  if(rowIndex < 0) return { ok:false, error:"Match no encontrado" };

  const colMS = hmap["MatchStatus"];
  const colStatus = hmap["Status"];
  const colPausedAt = hmap["PausedAt"];
  const colResumedAt = hmap["ResumedAt"];
  const colUpdatedAt = hmap["UpdatedAt"];
  const colUpdatedBy = hmap["UpdatedBy"];

  const oldMS = colMS ? String(sheet.getRange(rowIndex, colMS).getValue() || "").trim().toLowerCase() : "";
  const oldStatus = colStatus ? String(sheet.getRange(rowIndex, colStatus).getValue() || "").trim().toLowerCase() : "";
  const now = t_isoNow_();

  if(colMS) sheet.getRange(rowIndex, colMS).setValue(nextStatus);
  if(colUpdatedAt) sheet.getRange(rowIndex, colUpdatedAt).setValue(now);
  if(colUpdatedBy) sheet.getRange(rowIndex, colUpdatedBy).setValue(by);

  if(nextStatus === "paused"){
    if(colPausedAt) sheet.getRange(rowIndex, colPausedAt).setValue(now);
  }
  if(oldMS === "paused" && nextStatus !== "paused"){
    if(colResumedAt) sheet.getRange(rowIndex, colResumedAt).setValue(now);
  }

  t_match_push_history_(sheet, rowIndex, hmap, {
    ts: now, by, type: "status",
    from: oldMS || (oldStatus === "done" ? "finished" : "scheduled"),
    to: nextStatus
  });

  t_audit_append_(torneoId, matchId, "match_update_status", by, { from: oldMS, to: nextStatus });

  return { ok:true, torneoId, matchId, matchStatus: nextStatus };
}

function match_update_location(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };
  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const matchId = String(data.matchId || "").trim();
  if (!matchId) return { ok:false, error:"Falta matchId" };

  const location = String(data.location || "").trim();
  const by = String(data.user || "admin").trim();

  const sheet = t_sh(T_SHEET_MATCHES);
  const hmap = t_match_headerMap_(sheet);
  const rowIndex = t_match_findRowIndex_(sheet, torneoId, matchId);
  if(rowIndex < 0) return { ok:false, error:"Match no encontrado" };

  const colLoc = hmap["Location"];
  const colUpdatedAt = hmap["UpdatedAt"];
  const colUpdatedBy = hmap["UpdatedBy"];

  const oldLoc = colLoc ? String(sheet.getRange(rowIndex, colLoc).getValue() || "") : "";
  const now = t_isoNow_();

  if(colLoc) sheet.getRange(rowIndex, colLoc).setValue(location);
  if(colUpdatedAt) sheet.getRange(rowIndex, colUpdatedAt).setValue(now);
  if(colUpdatedBy) sheet.getRange(rowIndex, colUpdatedBy).setValue(by);

  t_match_push_history_(sheet, rowIndex, hmap, {
    ts: now, by, type: "location",
    from: oldLoc, to: location
  });

  t_audit_append_(torneoId, matchId, "match_update_location", by, { from: oldLoc, to: location });

  return { ok:true, torneoId, matchId, location };
}


// 8) GENERAR SINGLE ELIM (por torneo)
function torneo_generate_single(data) {
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok: false, error: "Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };

  const inscritos = torneo_list_inscritos({ torneoId }).inscritos
    .filter(x => String(x.Estado || "").toLowerCase() === "aprobado"
              || String(x.Estado || "").toLowerCase() === "inscrito");

  const players = inscritos.map(x => ({
    id: x.PlayerId,
    name: x.NombrePokemonGO || x.Nombre
  }));

  if (players.length < 2) return { ok: false, error: "Se necesitan mínimo 2 participantes" };

  // Limpia matches SOLO de este torneo
  t_clearMatchesForTournament(torneoId);

  // Mezcla
  t_shuffle(players);

  const n = players.length;
  const bracketSize = t_nextPow2(n);
  const byes = bracketSize - n;
  const totalRounds = Math.log(bracketSize) / Math.log(2);

  const seeds = players.slice();
  for (let i = 0; i < byes; i++) seeds.push({ id: "", name: "BYE" });

  const matchIdMap = {};
  for (let r = 1; r <= totalRounds; r++) {
    const slots = bracketSize / Math.pow(2, r);
    for (let s = 1; s <= slots; s++) {
      matchIdMap[`${r}-${s}`] = `M${r}-${s}`;
    }
  }

  const sheet = t_sh(T_SHEET_MATCHES);

  // R1
  const r1slots = bracketSize / 2;
  for (let s = 1; s <= r1slots; s++) {
    const a = seeds[(s - 1) * 2];
    const b = seeds[(s - 1) * 2 + 1];

    const matchId = matchIdMap[`1-${s}`];
    const nextMatchId = matchIdMap[`2-${Math.ceil(s / 2)}`] || "";
    const nextSide = (s % 2 === 1) ? "A" : "B";

    let winnerId = "";
    let loserId = "";
    let status = "pending";

    if (a.id && !b.id) { winnerId = a.id; status = "done"; }
    if (!a.id && b.id) { winnerId = b.id; status = "done"; }

   sheet.appendRow([
  torneoId, matchId, 1, s,
  a.id, b.id,
  0, 0,                 // ✅ ScoreA, ScoreB
  winnerId, loserId,
  status,
  nextMatchId, nextSide
]);

  }

  // Rest rounds
  for (let rr = 2; rr <= totalRounds; rr++) {
    const sCount = bracketSize / Math.pow(2, rr);
    for (let ss = 1; ss <= sCount; ss++) {
      const matchId = matchIdMap[`${rr}-${ss}`];
      const nextMatchId = matchIdMap[`${rr + 1}-${Math.ceil(ss / 2)}`] || "";
      const nextSide = (ss % 2 === 1) ? "A" : "B";

      sheet.appendRow([
  torneoId, matchId, rr, ss,
  "", "",
  0, 0,        // ✅ ScoreA, ScoreB
  "", "",
  "pending",
  nextMatchId, nextSide
]);

    }
  }

  // ✅ asigna mesas/escenario (presencial)
t_assign_match_locations_(torneoId);


  t.generated = "TRUE";
  t_torneo_upsert(t);

  return { ok: true, torneoId, players: players.length, bracketSize, byes };
}


// ✅ GENERADOR AUTO SEGÚN FORMATO
function torneo_generate(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };

  const fmt = String(t.format || "single").trim().toLowerCase();

  if(fmt === "groups") return torneo_generate_groups(data);

  // por ahora: double y swiss siguen con single hasta implementarlos
  return torneo_generate_single(data);
}

// ✅ GENERAR: GRUPOS + PLAYOFFS
function torneo_generate_groups(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };

  const gCount = Math.max(2, Math.min(10, Math.floor(Number(t.groupsCount || 4))));
  const gQual  = (Number(t.groupsQualify || 2) === 1) ? 1 : 2;
  const groupSize = 4;

  const inscritos = torneo_list_inscritos({ torneoId }).inscritos
    .filter(x => {
      const st = String(x.Estado || "").toLowerCase();
      return st === "aprobado" || st === "inscrito";
    });

  const players = inscritos.map(x => ({
    id: String(x.PlayerId || "").trim(),
    name: x.NombrePokemonGO || x.Nombre || ""
  })).filter(p => p.id);

  const expected = gCount * groupSize;
  if(players.length !== expected){
    return { ok:false, error:`Para ${gCount} grupos de ${groupSize}, se necesitan EXACTO ${expected} participantes (tienes ${players.length}).` };
  }

  // ✅ limpia solo este torneo
  t_clearMatchesForTournament(torneoId);

  // ✅ mezcla para repartir grupos
  t_shuffle(players);

  const groupIds = t_groupIds_(gCount);
  const groups = {};
  for(let i=0;i<gCount;i++){
    const gid = groupIds[i];
    groups[gid] = players.slice(i*groupSize, (i+1)*groupSize).map(p=>p.id);
  }

  const sheet = t_sh(T_SHEET_MATCHES);

  // ✅ 1) MATCHES DE GRUPOS (round robin)
  let totalGroupMatches = 0;

  groupIds.forEach(gid => {
    const ids = groups[gid];
    const rr = t_roundRobinSchedule_(ids);

    rr.forEach((roundPairs, rIdx) => {
      roundPairs.forEach((pair, sIdx) => {
        const aId = pair[0];
        const bId = pair[1];
        if(!aId || !bId) return;

        const matchId = `G-${gid}-R${rIdx+1}-S${sIdx+1}`;

        sheet.appendRow([
          torneoId, matchId, (rIdx+1), (sIdx+1),
          aId, bId,
          0,0,
          "","",
          "pending",
          "","",

          "groups",   // Stage
          gid,        // GroupId
          "",         // SwissRound
          "",         // Bracket
          ""          // MetaJson
        ]);

        totalGroupMatches++;
      });
    });
  });

  // ✅ 2) PLAYOFFS (bracket potencia de 2)
  const seedCodes = [];
  // prioridad: primero todos los 1ros, luego los 2dos
  groupIds.forEach(g => seedCodes.push(`${g}1`));
  if(gQual === 2) groupIds.forEach(g => seedCodes.push(`${g}2`));

  const qualifiers = seedCodes.length;
  const bracketSize = t_nextPow2(qualifiers);
  const byes = bracketSize - qualifiers;
  const totalRounds = Math.log(bracketSize) / Math.log(2);

  const seedPos = t_seedPositions_(bracketSize); // posiciones estándar
  const slotSeeds = seedPos.map(n => seedCodes[n-1] || ""); // "" => BYE

  const matchIdMap = {};
  for (let r = 1; r <= totalRounds; r++) {
    const slots = bracketSize / Math.pow(2, r);
    for (let s = 1; s <= slots; s++) {
      matchIdMap[`${r}-${s}`] = `P${r}-${s}`;
    }
  }

  // Round 1 playoffs (con seeds en MetaJson)
  const r1slots = bracketSize / 2;
  for(let s=1;s<=r1slots;s++){
    const seedA = slotSeeds[(s-1)*2];
    const seedB = slotSeeds[(s-1)*2 + 1];

    const matchId = matchIdMap[`1-${s}`];
    const nextMatchId = matchIdMap[`2-${Math.ceil(s/2)}`] || "";
    const nextSide = (s % 2 === 1) ? "A" : "B";

    const metaJson = JSON.stringify({ seedA, seedB });

    sheet.appendRow([
      torneoId, matchId, 1, s,
      "","",
      0,0,
      "","",
      "pending",
      nextMatchId,nextSide,

      "playoffs",
      "",
      "",
      "",
      metaJson
    ]);
  }

  // rounds siguientes
  for(let rr=2; rr<=totalRounds; rr++){
    const sCount = bracketSize / Math.pow(2, rr);
    for(let ss=1; ss<=sCount; ss++){
      const matchId = matchIdMap[`${rr}-${ss}`];
      const nextMatchId = matchIdMap[`${rr+1}-${Math.ceil(ss/2)}`] || "";
      const nextSide = (ss % 2 === 1) ? "A" : "B";

      sheet.appendRow([
        torneoId, matchId, rr, ss,
        "","",
        0,0,
        "","",
        "pending",
        nextMatchId,nextSide,

        "playoffs",
        "",
        "",
        "",
        ""
      ]);
    }
  }

  t.generated = "TRUE";
  t.status = "active";
  t.finishedAt = "";
  t_torneo_upsert(t);

  return {
    ok:true,
    torneoId,
    format:"groups",
    players: players.length,
    groupCount: gCount,
    qualifyTop: gQual,
    groupMatches: totalGroupMatches,
    playoffBracketSize: bracketSize,
    byes
  };
}

function torneo_groups_seed_playoffs(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };
  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };

  const fmt = String(t.format || "").toLowerCase();
  if(fmt !== "groups") return { ok:false, error:"Este torneo no es formato groups" };

  const force = String(data.force || "").toLowerCase() === "true";

  const sheet = t_sh(T_SHEET_MATCHES);
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(h => String(h||"").trim());

  const col = (name) => header.indexOf(name);

  const cTorneo = col("TorneoId");
  const cMatch  = col("MatchId");
  const cRound  = col("Round");
  const cA      = col("PlayerAId");
  const cB      = col("PlayerBId");
  const cW      = col("WinnerId");
  const cL      = col("LoserId");
  const cSt     = col("Status");
  const cNextM  = col("NextMatchId");
  const cNextS  = col("NextSide");
  const cStage  = col("Stage");
  const cGroup  = col("GroupId");
  const cMeta   = col("MetaJson");

  // index matchId -> rowIndex
  const rowByMatch = {};
  for(let i=1;i<values.length;i++){
    if(String(values[i][cTorneo]) !== String(torneoId)) continue;
    rowByMatch[String(values[i][cMatch])] = i;
  }

  // 1) recopilar matches de grupos
  const groupMatches = [];
  let allGroupsDone = true;

  for(let i=1;i<values.length;i++){
    if(String(values[i][cTorneo]) !== String(torneoId)) continue;
    const stg = String(values[i][cStage] || "");
    if(stg !== "groups") continue;

    groupMatches.push(values[i]);
    if(String(values[i][cSt]) !== "done") allGroupsDone = false;
  }

  if(!allGroupsDone && !force){
    return { ok:false, error:"Aún no terminan todos los matches de grupos. (Usa force:true si quieres sembrar igual)" };
  }

  // 2) standings por grupo
  const stats = {}; // groupId -> playerId -> {w,l}
const ensure = (gid, pid) => {
  if (!stats[gid]) stats[gid] = {};
  if (!stats[gid][pid]) stats[gid][pid] = { w: 0, l: 0 };
  return stats[gid][pid];
};


  groupMatches.forEach(r=>{
    const gid = String(r[cGroup] || "");
    const a = String(r[cA] || "");
    const b = String(r[cB] || "");
    if(a) ensure(gid,a);
    if(b) ensure(gid,b);

    if(String(r[cSt]) !== "done") return;
    const w = String(r[cW] || "");
    const l = String(r[cL] || "");
    if(w) ensure(gid,w).w++;
    if(l) ensure(gid,l).l++;
  });

  // orden por wins desc, losses asc
  const qualifyTop = (Number(t.groupsQualify || 2) === 1) ? 1 : 2;
  const seedMap = {}; // "A1" -> playerId

  Object.keys(stats).forEach(gid=>{
    const arr = Object.keys(stats[gid]).map(pid=>({
      pid,
      w: stats[gid][pid].w,
      l: stats[gid][pid].l
    }));

    arr.sort((x,y)=> (y.w - x.w) || (x.l - y.l) || String(x.pid).localeCompare(String(y.pid)));

    for(let k=1;k<=qualifyTop;k++){
      seedMap[`${gid}${k}`] = (arr[k-1] && arr[k-1].pid) ? arr[k-1].pid : "";

    }
  });

  // 3) llenar playoffs R1 según MetaJson.seedA/seedB
  const changedRows = new Set();

  for(let i=1;i<values.length;i++){
    if(String(values[i][cTorneo]) !== String(torneoId)) continue;
    const stg = String(values[i][cStage] || "");
    if(stg !== "playoffs") continue;
    if(Number(values[i][cRound] || 0) !== 1) continue;

    // si ya hay alguien jugando y NO force, no tocar
    const curA = String(values[i][cA] || "");
    const curB = String(values[i][cB] || "");
    if((curA || curB) && !force) continue;

    let meta = {};
    try { meta = JSON.parse(String(values[i][cMeta] || "{}")); } catch(_){ meta = {}; }

    const seedA = String(meta.seedA || "");
    const seedB = String(meta.seedB || "");

    const pA = seedA ? (seedMap[seedA] || "") : "";
    const pB = seedB ? (seedMap[seedB] || "") : "";

    if(curA !== pA){ values[i][cA] = pA; changedRows.add(i); }
    if(curB !== pB){ values[i][cB] = pB; changedRows.add(i); }

    // auto-advance BYE
    if(pA && !pB){
      values[i][cW] = pA;
      values[i][cL] = "";
      values[i][cSt] = "done";
      changedRows.add(i);

      const nextMatchId = String(values[i][cNextM] || "");
      const nextSide = String(values[i][cNextS] || "");
      const j = rowByMatch[nextMatchId];
      if(nextMatchId && j !== undefined){
        if(nextSide === "A") values[j][cA] = pA;
        if(nextSide === "B") values[j][cB] = pA;
        changedRows.add(j);
      }
    }
    if(pB && !pA){
      values[i][cW] = pB;
      values[i][cL] = "";
      values[i][cSt] = "done";
      changedRows.add(i);

      const nextMatchId = String(values[i][cNextM] || "");
      const nextSide = String(values[i][cNextS] || "");
      const j = rowByMatch[nextMatchId];
      if(nextMatchId && j !== undefined){
        if(nextSide === "A") values[j][cA] = pB;
        if(nextSide === "B") values[j][cB] = pB;
        changedRows.add(j);
      }
    }
  }

  // 4) escribir cambios
  changedRows.forEach(i=>{
    sheet.getRange(i+1, 1, 1, header.length).setValues([values[i]]);
  });

  return { ok:true, torneoId, seeded:true, force, qualifyTop };
}



// ============ HELPERS ============

function parseJsonSafe(s, fallback = null) {
  try {
    const txt = String(s || "").trim();
    if (!txt) return fallback;
    return JSON.parse(txt);
  } catch (e) {
    return fallback;
  }
}


function t_groupIds_(count){
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const out = [];
  for(let i=0;i<count;i++) out.push(letters[i] || ("G"+(i+1)));
  return out;
}

function t_seedPositions_(bracketSize){
  // genera orden estándar: 8 => [1,8,4,5,2,7,3,6]
  const n = Number(bracketSize || 0);
  if(n <= 1) return [1];

  let arr = [1,2];
  let size = 2;
  while(size < n){
    size *= 2;
    const next = [];
    for(let i=0;i<arr.length;i++){
      const p = arr[i];
      next.push(p);
      next.push(size + 1 - p);
    }
    arr = next;
  }
  return arr;
}


function t_roundRobinSchedule_(playerIds){
  const ids = (playerIds||[]).slice();
  if(ids.length < 2) return [];

  if(ids.length % 2 === 1) ids.push("");

  const n = ids.length;
  let arr = ids.slice();
  const rounds = [];

  for(let r=0; r<n-1; r++){
    const pairs = [];
    for(let i=0;i<n/2;i++){
      const a = arr[i];
      const b = arr[n-1-i];
      if(a && b) pairs.push([a,b]);
    }
    rounds.push(pairs);

    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed].concat(rest);
  }

  return rounds;
}

function t_groupsPlayoffPairings_(groupIds){
  const gids = (groupIds||[]).slice();
  const out = [];
  for(let i=0;i<gids.length;i+=2){
    const g1 = gids[i];
    const g2 = gids[i+1];
    if(!g2) break;

    out.push([`${g1}1`, `${g2}2`]);
    out.push([`${g2}1`, `${g1}2`]);
  }
  return out;
}


// 9) LIMPIAR MATCHES SOLO DEL TORNEO
function t_clearMatchesForTournament(torneoId) {
  t_bootstrap();
  const sheet = t_sh(T_SHEET_MATCHES);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const keep = [values[0]];
  for (let i = 1; i < values.length; i++) {
    // mantiene los de OTROS torneos
    if (String(values[i][0]) !== String(torneoId)) keep.push(values[i]);
  }
  sheet.clearContents();
  sheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
}

// ======================================================
// ✅ PRESENCIAL: ASIGNACIÓN AUTOMÁTICA DE MESAS / ESCENARIO
// ======================================================
function t_int_(v, def){
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : (def ?? 0);
}

function t_hashPct_(str){
  const s = String(str ?? "");
  let h = 0;
  for(let i=0;i<s.length;i++){
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 100);
}

function t_hash32_(str){
  const s = String(str ?? "");
  // FNV-1a 32-bit
  let h = 2166136261;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}


function t_mainStageThresholdRound_(maxRound, from){
  const mr = Math.max(1, t_int_(maxRound, 1));
  const f = String(from || "semis").trim().toLowerCase();

  // final por defecto
  let th = mr;
  if(f === "semis") th = mr - 1;
  if(f === "quarters") th = mr - 2;

  if(th < 1) th = 1;
  return th;
}

function t_assign_match_locations_(torneoId){
  t_bootstrap();

  torneoId = String(torneoId || "").trim();
  if(!torneoId) return;

  const t = t_torneo_get(torneoId);
  if(!t) return;

  const mode = String(t.mode || "").trim().toLowerCase();
  if(mode !== "presencial") return;

  const tablesCount = Math.max(0, t_int_(t.tablesCount, 0));
  const hasMainStage = (String(t.hasMainStage || "").toUpperCase() === "TRUE");
  const mainStageFrom = String(t.mainStageFrom || "semis").trim().toLowerCase();
  const randomPct = Math.max(0, Math.min(100, t_int_(t.mainStageRandomPct, 100)));


  if(!tablesCount && !hasMainStage) return;

  const sheet = t_sh(T_SHEET_MATCHES);
  const values = sheet.getDataRange().getValues();
  if(values.length < 2) return;

  const header = values[0].map(h => String(h||"").trim());
  const col = (name) => header.indexOf(name);

  const cTid   = col("TorneoId");
  const cMid   = col("MatchId");
  const cRound = col("Round");
  const cSlot  = col("Slot");
  const cStage = col("Stage");
  const cGroup = col("GroupId");
  const cLoc   = col("Location");
  const cLocT  = col("LocationType");

  if(cTid < 0 || cMid < 0 || cLoc < 0 || cLocT < 0) return;

  // calcular maxRound por stage (single vs playoffs)
  let maxSingle = 1;
  let maxPlayoffs = 1;

  for(let i=1;i<values.length;i++){
    const row = values[i];
    if(String(row[cTid]||"").trim() !== torneoId) continue;

    const st = String(row[cStage]||"").trim().toLowerCase() || "single";
    const r  = Number(row[cRound]||0);

    if(!Number.isFinite(r)) continue;
    if(st === "playoffs") maxPlayoffs = Math.max(maxPlayoffs, r);
    if(st !== "groups" && st !== "playoffs") maxSingle = Math.max(maxSingle, r);
  }

  const thSingle   = t_mainStageThresholdRound_(maxSingle, mainStageFrom);
  const thPlayoffs = t_mainStageThresholdRound_(maxPlayoffs, mainStageFrom);

  // GROUPS: asignación secuencial para repartir mesas
  const groupRowIdx = [];
  for(let i=1;i<values.length;i++){
    const row = values[i];
    if(String(row[cTid]||"").trim() !== torneoId) continue;
    const st = String(row[cStage]||"").trim().toLowerCase();
    if(st === "groups") groupRowIdx.push(i);
  }

  groupRowIdx.sort((i,j)=>{
    const ri = Number(values[i][cRound]||0);
    const rj = Number(values[j][cRound]||0);
    if(ri !== rj) return ri - rj;

    const gi = String(values[i][cGroup]||"");
    const gj = String(values[j][cGroup]||"");
    if(gi !== gj) return gi.localeCompare(gj);

    const si = Number(values[i][cSlot]||0);
    const sj = Number(values[j][cSlot]||0);
    if(si !== sj) return si - sj;

    return String(values[i][cMid]||"").localeCompare(String(values[j][cMid]||""));
  });

  let gCounter = 0;
  groupRowIdx.forEach(i=>{
    if(!tablesCount) return;
    const mesa = "Mesa " + ((gCounter % tablesCount) + 1);
    gCounter++;
    sheet.getRange(i+1, cLoc+1, 1, 2).setValues([[mesa, "table"]]);
  });

  // ELIMINACIÓN: asignación por TURNOS (mesas simultáneas) + 1 match a escenario por turno
  // - Turno = bloque de N matches dentro de un Round (N = tablesCount) usando Slot
  // - Antes de la fase principal: máximo 1 match por TURNO va al escenario
  // - Desde la fase configurada (quarters/semis/final): TODOS los matches van al escenario
  const turnSize = Math.max(1, tablesCount || 1);

  // buckets: stageKey|round|turn -> [{rowIdx,pos,mid}]
  const buckets = {};

  for(let i=1;i<values.length;i++){
    const row = values[i];
    if(String(row[cTid]||"").trim() !== torneoId) continue;

    const stRaw = String(row[cStage]||"").trim().toLowerCase() || "single";
    if(stRaw === "groups") continue;

    const stageKey = (stRaw === "playoffs") ? "playoffs" : "single";
    const r  = t_int_(row[cRound], 1);
    const s  = Math.max(1, t_int_(row[cSlot], 1));
    const mid = String(row[cMid]||"");

    const turn = Math.floor((s - 1) / turnSize) + 1;       // ✅ turno físico
    const pos  = ((s - 1) % turnSize) + 1;                 // ✅ posición dentro del turno

    const key = `${stageKey}|${r}|${turn}`;
    if(!buckets[key]) buckets[key] = { stageKey, r, turn, entries: [] };
    buckets[key].entries.push({ rowIdx: i, pos, mid });
  }

  // orden estable
  const bucketKeys = Object.keys(buckets).sort((a,b)=>{
    const pa=a.split("|"), pb=b.split("|");
    if(pa[0] !== pb[0]) return pa[0].localeCompare(pb[0]);
    const ra = t_int_(pa[1],0), rb = t_int_(pb[1],0);
    if(ra !== rb) return ra - rb;
    const ta = t_int_(pa[2],0), tb = t_int_(pb[2],0);
    return ta - tb;
  });

  bucketKeys.forEach(k=>{
    const b = buckets[k];
    const stageKey = b.stageKey;
    const r = b.r;
    const turn = b.turn;
    const entries = b.entries;

    const th = (stageKey === "playoffs") ? thPlayoffs : thSingle;

    // 1) desde la fase principal => todo al escenario
    if(hasMainStage && r >= th){
      entries.forEach(e=>{
        sheet.getRange(e.rowIdx+1, cLoc+1, 1, 2).setValues([["Escenario Principal", "main"]]);
      });
      return;
    }

    // 2) antes de fase principal => máximo 1 match por TURNO en escenario
    let mainMid = "";
    let useMainThisTurn = false;

    if(hasMainStage && randomPct > 0){
      // ✅ randomPct ahora se aplica POR TURNO (no por match)
      const turnKey = `${torneoId}|${stageKey}|${r}|${turn}`;
      useMainThisTurn = (t_hashPct_(turnKey) < randomPct);

      if(useMainThisTurn){
        // escoger 1 match del turno (aleatorio pero estable)
        let best = null;
        entries.forEach(e=>{
          const hv = t_hash32_(e.mid);
          if(!best || hv < best.hv || (hv === best.hv && String(e.mid).localeCompare(String(best.mid)) < 0)){
            best = { mid: e.mid, hv };
          }
        });
        mainMid = best ? best.mid : "";
      }
    }

    // si usamos escenario en este turno => mesas disponibles se reducen en 1
    const tablesThisTurn = useMainThisTurn ? Math.max(0, tablesCount - 1) : tablesCount;

    // asignación ordenada por posición dentro del turno
    entries.sort((x,y)=> (x.pos - y.pos) || String(x.mid).localeCompare(String(y.mid)));

    let mesaCounter = 1;
    entries.forEach(e=>{
      if(mainMid && e.mid === mainMid){
        sheet.getRange(e.rowIdx+1, cLoc+1, 1, 2).setValues([["Escenario Principal", "main"]]);
        return;
      }

      if(tablesThisTurn > 0){
        const mesa = "Mesa " + mesaCounter;
        mesaCounter++;
        sheet.getRange(e.rowIdx+1, cLoc+1, 1, 2).setValues([[mesa, "table"]]);
      }else{
        sheet.getRange(e.rowIdx+1, cLoc+1, 1, 2).setValues([["", ""]]);
      }
    });
  });

}


// 10) REPORTAR RESULTADO (por torneo)
function torneo_report_result(data) {
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok: false, error: "Falta torneoId" };

  const matchId  = String(data.matchId || "").trim();
  const winnerId = String(data.winnerId || "").trim();

  const scoreA = Number(data.scoreA ?? 0);
  const scoreB = Number(data.scoreB ?? 0);

  const sheet  = t_sh(T_SHEET_MATCHES);
  const values = sheet.getDataRange().getValues();

  const idx = {
    torneo:0, match:1, round:2, slot:3,
    a:4, b:5,
    scoreA:6, scoreB:7,
    winner:8, loser:9,
    status:10, nextMatch:11, nextSide:12
  };

  // 1) ubicar match actual
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx.torneo]) === torneoId && String(values[i][idx.match]) === matchId) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) return { ok: false, error: "Match no encontrado" };

  const row  = sheet.getRange(rowIndex, 1, 1, values[0].length).getValues()[0];
  const aId  = String(row[idx.a] || "");
  const bId  = String(row[idx.b] || "");

  if (winnerId !== aId && winnerId !== bId) return { ok: false, error: "Winner inválido" };

  const loserId    = (winnerId === aId) ? bId : aId;

  const oldWinner  = String(row[idx.winner] || "");
  const nextMatchId= String(row[idx.nextMatch] || "");
  const nextSide   = String(row[idx.nextSide] || "");

  // 2) si existe nextMatch, bloquear edición si nextMatch ya está done
  let nextRowIndex = -1;
  let nextRow = null;

  if (nextMatchId) {
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idx.torneo]) === torneoId && String(values[i][idx.match]) === nextMatchId) {
        nextRowIndex = i + 1;
        break;
      }
    }

    if (nextRowIndex !== -1) {
      nextRow = sheet.getRange(nextRowIndex, 1, 1, values[0].length).getValues()[0];
      const nextStatus = String(nextRow[idx.status] || "");
      if (nextStatus === "done") {
        return { ok:false, error:"No se puede editar: el siguiente match ya está finalizado" };
      }
    }
  }

  // 3) si cambió el ganador, limpiar el slot del nextMatch donde estaba el oldWinner
  if (nextRowIndex !== -1 && nextRow) {
    const colToWrite = (nextSide === "A") ? (idx.a + 1) : (idx.b + 1);

    // si el slot actualmente tiene oldWinner y voy a cambiarlo, lo limpio
    const currentInSlot = String(sheet.getRange(nextRowIndex, colToWrite).getValue() || "");
    if (oldWinner && oldWinner !== winnerId && currentInSlot === oldWinner) {
      sheet.getRange(nextRowIndex, colToWrite).setValue("");
    }
  }

  // 4) guardar resultado del match
  sheet.getRange(rowIndex, idx.scoreA + 1).setValue(scoreA);
  sheet.getRange(rowIndex, idx.scoreB + 1).setValue(scoreB);
  sheet.getRange(rowIndex, idx.winner + 1).setValue(winnerId);
  sheet.getRange(rowIndex, idx.loser + 1).setValue(loserId);
  sheet.getRange(rowIndex, idx.status + 1).setValue("done");

  // ✅ operación en vivo: marca como finished (si existe la columna)
try{
  const hmap = t_match_headerMap_(sheet);
  const colMS = hmap["MatchStatus"];
  const colUpdatedAt = hmap["UpdatedAt"];
  const colUpdatedBy = hmap["UpdatedBy"];
  const nowIso = t_isoNow_();

  if(colMS) sheet.getRange(rowIndex, colMS).setValue("finished");
  if(colUpdatedAt) sheet.getRange(rowIndex, colUpdatedAt).setValue(nowIso);
  if(colUpdatedBy) sheet.getRange(rowIndex, colUpdatedBy).setValue(String(data.user || "admin"));

  t_match_push_history_(sheet, rowIndex, hmap, {
    ts: nowIso, by: String(data.user || "admin"),
    type: "result_done",
    scoreA: scoreA, scoreB: scoreB, winnerId: winnerId
  });

  t_audit_append_(torneoId, matchId, "torneo_report_result", String(data.user || "admin"), { scoreA, scoreB, winnerId });
}catch(_){}


  // 5) propagar nuevo ganador al nextMatch
  if (nextRowIndex !== -1 && nextRow) {
    const colToWrite = (nextSide === "A") ? (idx.a + 1) : (idx.b + 1);
    sheet.getRange(nextRowIndex, colToWrite).setValue(winnerId);
  }

  // ✅ (OPCIÓN 5) Si NO hay NextMatchId => este match es la FINAL
  // => marcar torneo como FINALIZADO
  // ✅ Solo considerar "final" si NO es un match de grupos/swiss
  const header = values[0].map(h => String(h||"").trim());
  const colStage = header.indexOf("Stage");
  const stage = (colStage >= 0) ? String(row[colStage] || "") : "";

  if (!nextMatchId && stage !== "groups" && stage !== "swiss") {
    const t = t_torneo_get(torneoId);
    if (t) {
      t.status = "finished";
      t.finishedAt = new Date();
      t.inscriptionsOpen = "FALSE";
      t_torneo_upsert(t);
    }
  }

// ✅ Auto: si terminaste un match de grupos, intentamos sembrar playoffs
try{
  const header2 = values[0].map(h => String(h||"").trim());
  const colStage2 = header2.indexOf("Stage");
  const stage2 = (colStage2 >= 0) ? String(row[colStage2] || "") : "";

  if(stage2 === "groups"){
    // no forzamos: solo si está todo listo
    torneo_groups_seed_playoffs({ user:data.user, pin:data.pin, torneoId, force:false });
  }
}catch(_){}


  return { ok: true, torneoId, finished: !nextMatchId };
}




// Normaliza listas: acepta separado por coma o por líneas
function t_parseList(raw){
  const s = String(raw || "").trim();
  if(!s) return "";
  // split por coma o salto de línea
  const items = s
    .split(/[\n,]+/g)
    .map(x => String(x || "").trim())
    .filter(Boolean);
  // guardamos como texto "A, B, C" (simple)
  return items.join(", ");
}

function torneo_update_rules(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };
  t.bannedTypes        = t_parseList(data.bannedTypes);
  t.bannedCategories   = t_parseList(data.bannedCategories);
  t.bannedPokemon      = t_parseList(data.bannedPokemon);
  t.allowedPokemon     = t_parseList(data.allowedPokemon);

  t.bannedFastMoves    = t_parseList(data.bannedFastMoves);
  t.bannedChargedMoves = t_parseList(data.bannedChargedMoves);
  t.allowedTypes      = t_parseList(data.allowedTypes);
t.allowedCategories = t_parseList(data.allowedCategories);
// ✅ NUEVO: reglas por liga (JSON como texto)
if (data.leagueRulesJson !== undefined) t.leagueRulesJson = String(data.leagueRulesJson || "");

// ✅ guardar premios (JSON como texto)
if (data.prizesJson !== undefined) t.prizesJson = String(data.prizesJson || "[]");





  t_torneo_upsert(t);

  return {
  ok: true,
  torneoId,
  received: {
    allowedTypes: data.allowedTypes,
    allowedCategories: data.allowedCategories
  },
  saved: {
    allowedTypes: t.allowedTypes,
    allowedCategories: t.allowedCategories
  }
};

}

function t_clearInscritosForTournament(torneoId){
  t_bootstrap();
  const sheet = t_sh(T_SHEET_INSCRITOS);
  const values = sheet.getDataRange().getValues();
  if(values.length < 2) return;

  const keep = [values[0]];
  for(let i=1;i<values.length;i++){
    if(String(values[i][1]) !== String(torneoId)) keep.push(values[i]); // col2 TorneoId
  }
  sheet.clearContents();
  sheet.getRange(1,1,keep.length,keep[0].length).setValues(keep);
}

function t_deleteTournamentRow(torneoId){
  t_bootstrap();
  const sheet = t_sh(T_SHEET_TORNEOS);
  const values = sheet.getDataRange().getValues();
  if(values.length < 2) return false;

  // torneoId está en col 1
  for(let i=1;i<values.length;i++){
    if(String(values[i][0]).trim() === String(torneoId).trim()){
      sheet.deleteRow(i+1);
      return true;
    }
  }
  return false;
}

function torneo_delete(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  const torneoId = String(data.torneoId || "").trim();
  if(!torneoId) return { ok:false, error:"Falta torneoId" };

  const deleted = t_deleteTournamentRow(torneoId);
  if(!deleted) return { ok:false, error:"Torneo no encontrado" };

  // ✅ borra data del torneo
  t_clearMatchesForTournament(torneoId);
  t_clearInscritosForTournament(torneoId);

  // opcional: si usas legacy activeTournamentId, apuntar al último si existe
  if (t_sh(T_SHEET_CONFIG)) {
    const all = t_torneos_all();
    const lastId = all.length ? String(all[all.length-1].torneoId || "").trim() : "";
    t_cfg_set_legacy("activeTournamentId", lastId);
  }

  return { ok:true, torneoId };
}

function torneo_update(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = String(data.torneoId || "").trim();
  if(!torneoId) return { ok:false, error:"Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if (!t) return { ok:false, error:"Torneo no encontrado" };

  // actualiza campos principales
  t.title = String(data.title || t.title || "").trim();
  t.format = String(data.format || t.format || "single").trim();
  t.leaguePlan = String(data.leaguePlan || t.leaguePlan || "super1500").trim();
  t.mode = String(data.mode || t.mode || "presencial").trim();
  // ✅ Presencial: mesas / escenario
if(data.tablesCount !== undefined) t.tablesCount = String(data.tablesCount || "").trim();
if(data.hasMainStage !== undefined) t.hasMainStage = (String(data.hasMainStage||"").toUpperCase()==="TRUE") ? "TRUE" : "FALSE";
if(data.mainStageFrom !== undefined) t.mainStageFrom = String(data.mainStageFrom || "semis").trim();
if(data.mainStageRandomPct !== undefined) t.mainStageRandomPct = String(data.mainStageRandomPct || "0").trim();

// si el torneo NO es presencial, limpiamos esta config
if(String(t.mode || "").toLowerCase() !== "presencial"){
  t.tablesCount = "";
  t.hasMainStage = "FALSE";
  t.mainStageFrom = "";
  t.mainStageRandomPct = "";
}

  t.dateTime = String(data.dateTime || t.dateTime || "").trim();
  t.bestOf = String(data.bestOf || t.bestOf || "3").trim();
  // ✅ BO por fase (JSON desde panel)
if (data.boPhasesJson !== undefined) t.boPhasesJson = String(data.boPhasesJson || "");


 // ✅ Si es groups, suggested SIEMPRE = groupsCount*4
const fmt = String(t.format || "").trim().toLowerCase();

if(fmt === "groups"){
  const groupSize = 4;

// ✅ FIX: si el panel NO manda groupsCount pero sí manda suggestedSize (ej. 20),
// inferimos groupsCount = suggestedSize / 4.
let gCount = Number(data.groupsCount ?? "");

if(!gCount || !Number.isFinite(gCount)){
  const sug = Number(data.suggestedSize ?? "");
  if(Number.isFinite(sug) && sug >= 8 && sug <= 40 && (sug % groupSize === 0)){
    gCount = sug / groupSize; // ej 20/4 = 5 grupos
  }else{
    gCount = Number(t.groupsCount ?? 4);
  }
}

if(!gCount || !Number.isFinite(gCount)) gCount = 4;
gCount = Math.max(2, Math.min(10, Math.floor(gCount)));

  let gQual = Number(data.groupsQualify ?? t.groupsQualify ?? 2);
  gQual = (gQual === 1) ? 1 : 2;

  t.groupsCount = String(gCount);
  t.groupsQualify = String(gQual);
  t.groupSize = "4";
  t.suggestedSize = gCount * groupSize;
}else{
  // si cambiaste formato, limpiamos config grupos
  t.groupsCount = "";
  t.groupsQualify = "";
  t.groupSize = "";

  const suggestedRaw = String(data.suggestedSize || "").trim();
  if(suggestedRaw) t.suggestedSize = Number(suggestedRaw);
}


  // opcional: también reglas aquí (si quieres)
  if(data.bannedFastMoves !== undefined) t.bannedFastMoves = t_parseList(data.bannedFastMoves);
  if(data.bannedChargedMoves !== undefined) t.bannedChargedMoves = t_parseList(data.bannedChargedMoves);
  if(data.bannedPokemon !== undefined) t.bannedPokemon = t_parseList(data.bannedPokemon);
    if(data.bannedTypes !== undefined)      t.bannedTypes = t_parseList(data.bannedTypes);
  if(data.bannedCategories !== undefined) t.bannedCategories = t_parseList(data.bannedCategories);
  if(data.allowedPokemon !== undefined)   t.allowedPokemon = t_parseList(data.allowedPokemon);
  if(data.allowedTypes !== undefined)      t.allowedTypes = t_parseList(data.allowedTypes);
if(data.allowedCategories !== undefined) t.allowedCategories = t_parseList(data.allowedCategories);
// ✅ NUEVO: reglas por liga (JSON como texto)
if (data.leagueRulesJson !== undefined) t.leagueRulesJson = String(data.leagueRulesJson || "");

// ✅ guardar premios (JSON como texto)
if (data.prizesJson !== undefined) t.prizesJson = String(data.prizesJson || "[]");




  // NO tocar: createdAt, createdBy, generated, inscriptionsOpen
  t_torneo_upsert(t);

  return { ok:true, torneoId };
}

function torneo_update_score(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const matchId = String(data.matchId || "").trim();
  if(!matchId) return { ok:false, error:"Falta matchId" };

  const scoreA = Number(data.scoreA ?? 0);
  const scoreB = Number(data.scoreB ?? 0);

  const sheet = t_sh(T_SHEET_MATCHES);
  const values = sheet.getDataRange().getValues();

  const idx = {
    torneo:0, match:1, round:2, slot:3,
    a:4, b:5,
    scoreA:6, scoreB:7,
    winner:8, loser:9,
    status:10, nextMatch:11, nextSide:12
  };

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(torneoId) && String(values[i][1]) === matchId) {
      rowIndex = i + 1;
      break;
    }
  }
  if(rowIndex === -1) return { ok:false, error:"Match no encontrado" };

  // ✅ SOLO actualiza ScoreA/ScoreB
  sheet.getRange(rowIndex, idx.scoreA + 1).setValue(scoreA);
  sheet.getRange(rowIndex, idx.scoreB + 1).setValue(scoreB);

  return { ok:true, torneoId, matchId, scoreA, scoreB };
}

function torneo_unreport_result(data){
  if (!t_admin_ok(data.user, data.pin)) return { ok:false, error:"No autorizado" };

  t_bootstrap();

  const torneoId = t_resolve_torneoId(data.torneoId);
  if (!torneoId) return { ok:false, error:"Falta torneoId" };

  const matchId = String(data.matchId || "").trim();
  if(!matchId) return { ok:false, error:"Falta matchId" };

  // Limpia este match y, si el siguiente ya estaba jugado, lo limpia también (cadena)
  t_clearMatchAndDownstream(torneoId, matchId);
  // ✅ si se deshace un resultado, reabrimos estado (por si era la final)
const t = t_torneo_get(torneoId);
if (t && String(t.status || "") === "finished") {
  t.status = "active";
  t.finishedAt = "";
  t_torneo_upsert(t);
}


  return { ok:true, torneoId, matchId };
}

function t_clearMatchAndDownstream(torneoId, matchId){
  const sheet = t_sh(T_SHEET_MATCHES);

  const idx = {
    torneo:0, match:1, round:2, slot:3,
    a:4, b:5,
    scoreA:6, scoreB:7,
    winner:8, loser:9,
    status:10, nextMatch:11, nextSide:12
  };

  const values = sheet.getDataRange().getValues();

  // Encuentra fila del match
  let rowIndex = -1;
  for(let i=1;i<values.length;i++){
    if(String(values[i][0]) === String(torneoId) && String(values[i][1]) === String(matchId)){
      rowIndex = i + 1;
      break;
    }
  }
  if(rowIndex === -1) return;

  const row = sheet.getRange(rowIndex, 1, 1, values[0].length).getValues()[0];

  const prevWinnerId = String(row[idx.winner] || "");
  const nextMatchId  = String(row[idx.nextMatch] || "");
  const nextSide     = String(row[idx.nextSide] || "");

  // 1) Limpia este match (NO borro score para que puedas editar y re-guardar)
  sheet.getRange(rowIndex, idx.winner + 1).setValue("");
  sheet.getRange(rowIndex, idx.loser + 1).setValue("");
  sheet.getRange(rowIndex, idx.status + 1).setValue("pending");

  // 2) Limpia el avance al siguiente match (si coincide con el ganador anterior)
  if(nextMatchId){
    const values2 = sheet.getDataRange().getValues();

    let nextRowIndex = -1;
    for(let i=1;i<values2.length;i++){
      if(String(values2[i][0]) === String(torneoId) && String(values2[i][1]) === String(nextMatchId)){
        nextRowIndex = i + 1;
        break;
      }
    }

    if(nextRowIndex !== -1){
      const col = (nextSide === "A") ? idx.a + 1 : idx.b + 1;
      const currentPlaced = String(sheet.getRange(nextRowIndex, col).getValue() || "");

      if(prevWinnerId && currentPlaced === prevWinnerId){
        sheet.getRange(nextRowIndex, col).setValue("");
      }

      // 3) Si el siguiente match estaba "done", lo limpiamos también (para no dejar bracket roto)
      const nextStatus = String(sheet.getRange(nextRowIndex, idx.status + 1).getValue() || "");
      if(nextStatus === "done"){
        const nextNext = String(sheet.getRange(nextRowIndex, idx.nextMatch + 1).getValue() || "");
        // Limpia ganador/estado del next
        sheet.getRange(nextRowIndex, idx.winner + 1).setValue("");
        sheet.getRange(nextRowIndex, idx.loser + 1).setValue("");
        sheet.getRange(nextRowIndex, idx.status + 1).setValue("pending");

        // Recursivo: si ya había avanzado más, seguimos limpiando
        if(nextNext){
          const nextMatchId2 = String(sheet.getRange(nextRowIndex, idx.match + 1).getValue() || "");
          if(nextMatchId2) t_clearMatchAndDownstream(torneoId, nextMatchId2);
        }
      }
    }
  }
}

function torneo_export_json(p){
  t_bootstrap();

  const torneoId = t_resolve_torneoId(p && p.torneoId);
  if(!torneoId) return { ok:false, error:"Falta torneoId" };

  const t = t_torneo_get(torneoId);
  if(!t) return { ok:false, error:"Torneo no encontrado" };

  const ins = torneo_list_inscritos({ torneoId }).inscritos || [];
  const matches = torneo_list_matches({ torneoId }).matches || [];

  // map de playerId -> datos (incluye equipo)
  const playersById = {};
  ins.forEach(x => {
    const pid = String(x.PlayerId || "").trim();
    if(!pid) return;
    playersById[pid] = {
      playerId: pid,
      nombre: String(x.NombrePokemonGO || x.Nombre || ""),
      nick: String(x.Nick || ""),
      codigo: String(x.Codigo || ""),
      campfire: String(x.Campfire || ""),
      team: [x.P1,x.P2,x.P3,x.P4,x.P5,x.P6].map(v => String(v || "").trim()).filter(Boolean)
    };
  });

  const parseJsonSafe = (s, fallback=null) => {
    try {
      const txt = String(s || "").trim();
      if(!txt) return fallback;
      return JSON.parse(txt);
    } catch(_) {
      return fallback;
    }
  };

  // ✅ Normalizamos TODOS los matches con Stage/GroupId + meta parseado
  // Si Stage viene vacío (single legacy), lo marcamos como "single"
  const allMatches = (matches || []).map(m => {
    const rawStage = String(m.Stage || "").trim();
    const stage = rawStage ? rawStage : "single";

    return {
      matchId: String(m.MatchId || ""),
      round: Number(m.Round || 0),
      slot: Number(m.Slot || 0),

      playerAId: String(m.PlayerAId || ""),
      playerBId: String(m.PlayerBId || ""),

      scoreA: Number(m.ScoreA ?? 0),
      scoreB: Number(m.ScoreB ?? 0),

      winnerId: String(m.WinnerId || ""),
      loserId: String(m.LoserId || ""),

      status: String(m.Status || ""),
      nextMatchId: String(m.NextMatchId || ""),
      nextSide: String(m.NextSide || ""),

      stage,                           // groups | playoffs | single
      groupId: String(m.GroupId || ""),// A | B | C...
      swissRound: Number(m.SwissRound || 0),
      bracket: String(m.Bracket || ""),
      metaJson: String(m.MetaJson || ""),
      meta: parseJsonSafe(m.MetaJson, null)
    };
  });

  // ======================================================
  // ✅ Campeón / subcampeón (solo playoffs o single; ignora groups)
  // ======================================================
  let championId = "";
  let runnerUpId = "";

  const stageMatches = allMatches.filter(m => {
    const st = String(m.stage || "").toLowerCase();
    return st === "playoffs" || st === "single";
  });

  const rounds = stageMatches.map(m => Number(m.round || 0)).filter(n => n > 0);
  const maxRound = rounds.length ? Math.max(...rounds) : 0;

  const finalMatch = stageMatches.find(m =>
    Number(m.round) === maxRound &&
    Number(m.slot) === 1 &&
    String(m.status) === "done"
  );

  if(finalMatch){
    championId = String(finalMatch.winnerId || "");
    runnerUpId = String(finalMatch.loserId || "");

    if(!runnerUpId){
      const a = String(finalMatch.playerAId || "");
      const b = String(finalMatch.playerBId || "");
      runnerUpId = (championId === a) ? b : (championId === b) ? a : "";
    }
  }

  // ======================================================
  // ✅ snapshot de reglas / config (incluye lo nuevo)
  // ======================================================
  const rules = {
    bannedTypes: String(t.bannedTypes || ""),
    bannedCategories: String(t.bannedCategories || ""),
    bannedPokemon: String(t.bannedPokemon || ""),
    allowedPokemon: String(t.allowedPokemon || ""),
    bannedFastMoves: String(t.bannedFastMoves || ""),
    bannedChargedMoves: String(t.bannedChargedMoves || ""),

    allowedTypes: String(t.allowedTypes || ""),
    allowedCategories: String(t.allowedCategories || ""),
    leagueRulesJson: String(t.leagueRulesJson || "")
  };

  // ======================================================
  // ✅ EXPORT GRUPOS: grupos + resultados + standings
  // ======================================================
  const groupMatches = allMatches.filter(m =>
    String(m.stage || "").toLowerCase() === "groups" && String(m.groupId || "").trim()
  );

  const groupsById = {}; // gid -> { groupId, players:Set, matches:[], standings:[] }
  groupMatches.forEach(m => {
    const gid = String(m.groupId || "").trim();
    if(!gid) return;

    if(!groupsById[gid]){
      groupsById[gid] = { groupId: gid, players: new Set(), matches: [], standings: [] };
    }
    if(m.playerAId) groupsById[gid].players.add(m.playerAId);
    if(m.playerBId) groupsById[gid].players.add(m.playerBId);

    groupsById[gid].matches.push(m);
  });

  const qualifyTop = (Number(t.groupsQualify || 2) === 1) ? 1 : 2;

  Object.values(groupsById).forEach(g => {
    const stat = {}; // pid -> {playerId,wins,losses,played}

    const ensure = (pid) => {
      if(!pid) return null;
      if(!stat[pid]) stat[pid] = { playerId: pid, wins: 0, losses: 0, played: 0 };
      return stat[pid];
    };

    // inicializa todos
    Array.from(g.players).forEach(pid => ensure(pid));

    // cuenta SOLO matches done
    g.matches.forEach(m => {
      if(String(m.status) !== "done") return;

      const a = String(m.playerAId || "");
      const b = String(m.playerBId || "");
      if(!a || !b) return;

      ensure(a).played++;
      ensure(b).played++;

      if(m.winnerId === a){
        ensure(a).wins++;
        ensure(b).losses++;
      } else if(m.winnerId === b){
        ensure(b).wins++;
        ensure(a).losses++;
      }
    });

    const standings = Object.values(stat).sort((x,y) =>
      (y.wins - x.wins) ||
      (x.losses - y.losses) ||
      String(x.playerId).localeCompare(String(y.playerId))
    );

    g.standings = standings.map((s, i) => ({
      playerId: s.playerId,
      wins: s.wins,
      losses: s.losses,
      played: s.played,
      seedRank: i + 1,
      qualified: (i < qualifyTop),
      nombre: (playersById[s.playerId] && playersById[s.playerId].nombre) ? playersById[s.playerId].nombre : "",
      nick: (playersById[s.playerId] && playersById[s.playerId].nick) ? playersById[s.playerId].nick : ""
    }));

    g.players = Array.from(g.players);

    // ordena matches dentro del grupo
    g.matches.sort((a,b) => (a.round - b.round) || (a.slot - b.slot));
  });

  const groups = Object.values(groupsById).sort((a,b) =>
    String(a.groupId).localeCompare(String(b.groupId))
  );

  // ======================================================
  // ✅ PLAYOFFS: todo lo que NO sea groups
  // ======================================================
  const playoffs = allMatches.filter(m => String(m.stage || "").toLowerCase() !== "groups");

  // ======================================================
  // ✅ OUT FINAL
  // ======================================================
  const out = {
    ok: true,
    exportVersion: 2,
    generatedAt: new Date().toISOString(),

    torneo: {
      torneoId: String(t.torneoId || torneoId),
      title: String(t.title || ""),
      format: String(t.format || ""),
      leaguePlan: String(t.leaguePlan || ""),
      mode: String(t.mode || ""),
      dateTime: String(t.dateTime || ""),
      bestOf: String(t.bestOf || ""),
      boPhasesJson: String(t.boPhasesJson || ""),
      suggestedSize: Number(t.suggestedSize || 0),
      createdAt: t.createdAt || "",
      createdBy: String(t.createdBy || ""),

      rules,

      // ✅ premios + estado
      prizesJson: String(t.prizesJson || "[]"),
      prizes: parseJsonSafe(t.prizesJson, []),
      status: String(t.status || "active"),
      finishedAt: t.finishedAt || "",

      // ✅ config groups
      groupsCount: Number(t.groupsCount || 0),
      groupsQualify: Number(t.groupsQualify || 0),
      groupSize: Number(t.groupSize || 0),

      championId,
      runnerUpId,
      champion: championId ? (playersById[championId] || { playerId: championId }) : null,
      runnerUp: runnerUpId ? (playersById[runnerUpId] || { playerId: runnerUpId }) : null
    },

    players: Object.values(playersById),

    // ✅ LO QUE NECESITAS PARA TU WEB:
    matches: allMatches, // TODO con Stage/GroupId
    groups,              // grupos + standings + resultados
    playoffs             // playoffs + single (sin groups)
  };

  return out;
}
