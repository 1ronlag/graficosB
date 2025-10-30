// backend/services/trabajoService.js
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");

/* =========================================================
   RUTAS A CSV (puedes sobreescribir por env)
   ========================================================= */
const DATA_DIR =
  process.env.DATA_DIR || path.join(__dirname, "..", "data", "trabajo");

const PATHS = {
  anual:
    process.env.TRABAJO_ANUAL_CSV ||
    path.join(DATA_DIR, "trabajo_anual.csv"),
  dataset:
    process.env.TRABAJO_DATASET_CSV ||
    path.join(DATA_DIR, "trabajo_dataset.csv"),
  piramide:
    process.env.TRABAJO_PIRAMIDE_CSV ||
    path.join(DATA_DIR, "trabajo_piramide.csv"),
  tasas:
    process.env.TRABAJO_TASAS_CSV ||
    path.join(DATA_DIR, "trabajo_tasas.csv"),
  esi:
    process.env.TRABAJO_ESI_INGRESOS_CSV ||
    path.join(DATA_DIR, "trabajo_esi_ingresos.csv"),
};

/* =========================================================
   HELPERS CSV
   ========================================================= */
function detectSeparator(headerLine) {
  if (!headerLine) return ",";
  return headerLine.includes(";") ? ";" : ",";
}

function createParser(sep) {
  return parse({
    columns: (h) => h.map((x) => String(x || "").trim().toLowerCase()),
    bom: true,
    delimiter: sep,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });
}

async function readCsvFlexible(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ CSV no encontrado: ${filePath}`);
    return [];
  }
  const first = fs.readFileSync(filePath, "utf8");
  const headerLine = (first.split(/\r?\n/)[0] || "").replace(/^\uFEFF/, "");
  const sep = detectSeparator(headerLine);

  return new Promise((resolve, reject) => {
    const out = [];
    fs.createReadStream(filePath, { encoding: "utf8" })
      .pipe(createParser(sep))
      .on("data", (row) => out.push(row))
      .on("end", () => resolve(out))
      .on("error", reject);
  });
}

/* Números: limpia $ . , espacios y símbolos */
const toNum = (v) => {
  if (v == null || v === "") return null;
  const s = String(v)
    .replace(/[^\d,.\-]/g, "") // deja solo dígitos, coma, punto, signo
    .replace(/\./g, "") // quita separadores de miles
    .replace(/,/g, "."); // coma -> punto
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/* Acceso seguro por alias de campo (cabeceras variadas) */
const pick = (row, aliases = []) => {
  for (const k of aliases) {
    const v = row[k];
    if (v != null && v !== "") return v;
  }
  return null;
};

/* =========================================================
   CACHE simple por mtime
   ========================================================= */
const cache = new Map(); // key -> { mtimeMs, data }
async function loadWithCache(key, filePath, mapFn) {
  const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  const mtimeMs = stat ? stat.mtimeMs : 0;
  const hit = cache.get(key);
  if (hit && hit.mtimeMs === mtimeMs) return hit.data;

  const raw = await readCsvFlexible(filePath);
  const data = (mapFn ? mapFn(raw) : raw) || [];
  cache.set(key, { mtimeMs, data });
  return data;
}

/* =========================================================
   SERVICIOS
   ========================================================= */

/* /trabajo/anual -> { rows: [...] } */
async function getAnual() {
  const rows = await loadWithCache("anual", PATHS.anual, (raw) =>
    raw
      .map((r) => {
        const anio = toNum(
          pick(r, ["anio", "año", "year", "ano", "ano_trimestre"])
        );

        const fuerza = toNum(
          pick(r, [
            "fuerza_laboral",
            "fuerza laboral",
            "fdt",
            "fuerza de trabajo",
            "fuerza_trabajo",
          ])
        );

        const td = toNum(
          pick(r, [
            "tasa_desempleo",
            "tasa desempleo",
            "td",
            "desempleo",
            "t_desempleo",
          ])
        );

        const ingreso = toNum(
          pick(r, [
            "ingreso_promedio",
            "ingreso promedio",
            "ingreso_medio",
            "ingreso medio",
            "ingreso_total",
            "ingreso",
            "promedio",
            "media_ingreso",
          ])
        );

        return {
          anio: Number(anio),
          fuerza_laboral: fuerza,
          tasa_desempleo: td,
          ingreso_promedio: ingreso,
        };
      })
      .filter((r) => Number.isFinite(r.anio))
      .filter((r) => r.anio >= 2010 && r.anio <= 2100)
      .sort((a, b) => a.anio - b.anio)
  );
  return { rows };
}

/* /trabajo/dataset -> { rows: [...] } (sin transformar) */
async function getDataset() {
  const rows = await loadWithCache("dataset", PATHS.dataset, (raw) => raw);
  return { rows };
}

/* /trabajo/tasas -> { rows: [...] } */
async function getTasas(q = {}) {
  const { periodo, sexo } = q;
  const rows = await loadWithCache("tasas", PATHS.tasas, (raw) =>
    raw.map((r) => ({
      periodo: String(r.periodo ?? r.trimestre ?? r.per ?? ""),
      sexo: String(r.sexo ?? r.ambito ?? "Nacional"),
      td: toNum(r.td),
      to: toNum(r.to),
      tp: toNum(r.tp),
      tpl: toNum(r.tpl),
      su1: toNum(r.su1),
      su2: toNum(r.su2),
      su3: toNum(r.su3),
      su4: toNum(r.su4),
      toi: toNum(r.toi),
      tosi: toNum(r.tosi),
    }))
  );
  const filt = rows.filter(
    (r) =>
      (!periodo || String(r.periodo) === String(periodo)) &&
      (!sexo ||
        String(r.sexo).toLowerCase() === String(sexo).toLowerCase())
  );
  return { rows: filt.length ? filt : rows };
}

/* /trabajo/piramide -> { rows: [...] } */
async function getPiramide(q = {}) {
  const { periodo } = q;
  const rows = await loadWithCache("piramide", PATHS.piramide, (raw) =>
    raw.map((r) => ({
      periodo: String(r.periodo ?? r.trimestre ?? r.per ?? ""),
      sexo: String(r.sexo ?? r.ambito ?? ""),
      tramo_edad: String(
        r.tramo_edad ?? r.tramo ?? r.edad ?? r.rango ?? ""
      ),
      pet: toNum(r.pet),
      fdt: toNum(r.fdt),
      oc: toNum(r.oc),
      des: toNum(r.des),
      id: toNum(r.id),
      tpi: toNum(r.tpi),
      obe: toNum(r.obe),
      ftp: toNum(r.ftp),
      fta: toNum(r.fta),
      fft: toNum(r.fft),
      oi: toNum(r.oi),
      osi: toNum(r.osi),
    }))
  );
  const result = periodo
    ? rows.filter((r) => String(r.periodo) === String(periodo))
    : rows;
  return { rows: result };
}

/* /trabajo/esi/ingresos -> {rows:[{anio,total,hombres,mujeres}]} 
   Si falta el CSV de ESI, se calcula desde dataset. */
async function getESIIngresos({ anioDesde, anioHasta } = {}) {
  // 1) Si existe el CSV específico de ESI, úsalo
  if (fs.existsSync(PATHS.esi)) {
    const rows = await loadWithCache("esi", PATHS.esi, (raw) =>
      raw
        .map((r) => ({
          anio: Number(toNum(r.anio ?? r.año ?? r.year ?? r.ano)),
          total: toNum(r.total),
          hombres: toNum(r.hombres ?? r.hombre),
          mujeres: toNum(r.mujeres ?? r.mujer),
        }))
        .filter((r) => Number.isFinite(r.anio))
        .filter((r) => r.anio >= 2010 && r.anio <= 2100)
        .sort((a, b) => a.anio - b.anio)
    );
    return rows.filter((r) => {
      if (anioDesde && r.anio < Number(anioDesde)) return false;
      if (anioHasta && r.anio > Number(anioHasta)) return false;
      return true;
    });
  }

  // 2) Fallback: construir desde dataset (promedios por año/sexo)
  const { rows: ds } = await getDataset();
  const acc = new Map();
  for (const r of ds) {
    const anio = Number(toNum(r.anio ?? r.año ?? r.year ?? r.ano));
    if (!Number.isFinite(anio)) continue;
    const sexoRaw = String(r.sexo ?? r.genero ?? "").trim().toLowerCase();
    const sexo =
      sexoRaw.startsWith("h") ? "Hombres" :
      sexoRaw.startsWith("m") ? "Mujeres" : null;
    if (!sexo) continue;
    const v = toNum(
      r.ingreso_promedio ??
        r["ingreso promedio"] ??
        r.ingreso_medio ??
        r["ingreso medio"] ??
        r.ingreso ??
        r.promedio
    );
    if (!acc.has(anio))
      acc.set(anio, { Hombres: { s: 0, c: 0 }, Mujeres: { s: 0, c: 0 } });
    const slot = acc.get(anio)[sexo];
    if (v != null) {
      slot.s += v;
      slot.c += 1;
    }
  }

  const rows = Array.from(acc.entries())
    .map(([anio, g]) => {
      const hombres = g.Hombres.c ? Math.round(g.Hombres.s / g.Hombres.c) : null;
      const mujeres = g.Mujeres.c ? Math.round(g.Mujeres.s / g.Mujeres.c) : null;
      const total =
        hombres != null && mujeres != null
          ? Math.round((hombres + mujeres) / 2)
          : hombres ?? mujeres ?? null;
      return { anio: Number(anio), total, hombres, mujeres };
    })
    .filter((r) => r.anio >= 2010 && r.anio <= 2100)
    .sort((a, b) => a.anio - b.anio);

  return rows.filter((r) => {
    if (anioDesde && r.anio < Number(anioDesde)) return false;
    if (anioHasta && r.anio > Number(anioHasta)) return false;
    return true;
  });
}

/* /trabajo/meta -> info rápida para debug */
async function getMeta() {
  const meta = {};
  for (const [key, file] of Object.entries(PATHS)) {
    const exists = fs.existsSync(file);
    const item = { exists, file, rows: 0, anioMin: null, anioMax: null };
    if (exists) {
      const rows = await readCsvFlexible(file);
      item.rows = rows.length;
      // intenta detectar años
      const years = rows
        .map((r) => toNum(r.anio ?? r.año ?? r.year ?? r.ano))
        .filter((n) => Number.isFinite(n));
      if (years.length) {
        item.anioMin = Math.min(...years);
        item.anioMax = Math.max(...years);
      }
    }
    meta[key] = item;
  }
  return meta;
}

module.exports = {
  getAnual,
  getDataset,
  getTasas,
  getPiramide,
  getESIIngresos,
  getMeta,
  PATHS,
};
