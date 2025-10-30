// backend/services/saludService.js (versión robusta)
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");

// ================== RUTAS BASE ==================
const DATA_DIR = path.join(__dirname, "..", "data", "salud");
const FONASA_DIR = path.join(DATA_DIR, "fonasa");
const ISAPRE_DIR = path.join(DATA_DIR, "isapre");
const INDICADORES_DIR = path.join(DATA_DIR, "indicadores");

// ================== HELPERS ==================
function detectSeparator(headerLine) {
  if (!headerLine) return ",";
  return headerLine.includes(";") ? ";" : ",";
}
function createParser(sep) {
  return parse({
    columns: (h) => h.map((x) => String(x || "").trim()),
    bom: true,
    delimiter: sep,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });
}
async function readCsvFlexible(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV no encontrado: ${filePath}`);
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
const normStr = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();
const toInt = (x) => {
  if (x == null) return 0;
  const s = String(x).trim();
  const normalized = s.replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const toFloat = (x) => {
  if (x == null) return 0;
  const s = String(x).trim().replace(/\s/g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
function ensureFiles(files) {
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length) {
    const list = missing.map((p) => p.replace(process.cwd(), "")).join("\n - ");
    const e = new Error("Faltan CSV requeridos:\n - " + list);
    e.code = "CSV_MISSING";
    throw e;
  }
}

// 1) Beneficiarios por año
async function getBeneficiarios() {
  const reqFiles = [
    path.join(FONASA_DIR, "beneficiarios_fonasa.csv"),
    path.join(ISAPRE_DIR, "beneficiarios_isapre.csv"),
  ];
  ensureFiles(reqFiles);

  const fonasa = await readCsvFlexible(reqFiles[0]);
  const isapre = await readCsvFlexible(reqFiles[1]);

  const map = new Map();
  fonasa.forEach((r) => {
    const y = String(r.ANIO ?? r.Anio ?? r.AÑO ?? r.anio ?? r["Año"] ?? "").trim();
    if (!y) return;
    map.set(y, { anio: y, fonasa: toInt(r.BENEFICIARIOS), isapre: undefined });
  });
  isapre.forEach((r) => {
    const y = String(r.ANIO ?? r.Anio ?? r.AÑO ?? r.anio ?? r["Año"] ?? "").trim();
    if (!y) return;
    const row = map.get(y) || { anio: y };
    row.isapre = toInt(r.BENEFICIARIOS);
    map.set(y, row);
  });
  return Array.from(map.values()).sort((a, b) => Number(a.anio) - Number(b.anio));
}

// 2) Titular/Carga por sistema
async function getTipoBeneficiario({ year } = {}) {
  const reqFiles = [
    path.join(FONASA_DIR, "titulares_cargas_fonasa.csv"),
    path.join(ISAPRE_DIR, "cotizantes_cargas_isapre.csv"),
  ];
  ensureFiles(reqFiles);

  const fonasa = await readCsvFlexible(reqFiles[0]);
  const isapre = await readCsvFlexible(reqFiles[1]);

  const normIsapreTipo = (s) => {
    const t = normStr(s);
    if (t.startsWith("COTIZ")) return "COTIZANTES";
    if (t.startsWith("CARG")) return "CARGAS";
    return t;
  };

  const yearsF = new Set(fonasa.map((r) => Number(r["AÑO"] ?? r["Anio"] ?? r["ANIO"])).filter(Boolean));
  const yearsI = new Set(isapre.map((r) => Number(r["AÑO"] ?? r["Anio"] ?? r["ANIO"])).filter(Boolean));
  let y;
  if (year) {
    y = Number(year);
  } else {
    const inter = [...yearsF].filter((yy) => yearsI.has(yy)).sort((a, b) => a - b);
    y = inter.length ? inter.at(-1) : Math.max(...[...yearsF, ...yearsI]);
    if (!Number.isFinite(y)) y = null;
  }

  const FT = fonasa.find((r) => Number(r["AÑO"] ?? r["ANIO"]) === y && normStr(r.TITULAR_CARGA) === "TITULAR")?.POBLACION;
  const FC = fonasa.find((r) => Number(r["AÑO"] ?? r["ANIO"]) === y && normStr(r.TITULAR_CARGA) === "CARGA")?.POBLACION;

  const IT = isapre.find((r) => Number(r["AÑO"] ?? r["ANIO"]) === y && normIsapreTipo(r.COTIZANTE_CARGA) === "COTIZANTES")?.POBLACION;
  const IC = isapre.find((r) => Number(r["AÑO"] ?? r["ANIO"]) === y && normIsapreTipo(r.COTIZANTE_CARGA) === "CARGAS")?.POBLACION;

  return {
    year: y,
    rows: [
      { sistema: "FONASA", Titular: toInt(FT), Carga: toInt(FC) },
      { sistema: "ISAPRE", Titular: toInt(IT), Carga: toInt(IC) },
    ],
  };
}

// 3) Distribución por sexo
async function getSexo({ year } = {}) {
  const reqFiles = [
    path.join(FONASA_DIR, "titulares_cargas_sexo_fonasa.csv"),
    path.join(ISAPRE_DIR, "cotizantes_cargas_sexo_isapre.csv"),
  ];
  ensureFiles(reqFiles);

  const F = await readCsvFlexible(reqFiles[0]);
  const I = await readCsvFlexible(reqFiles[1]);

  const yearsF = new Set(F.map((r) => Number(r["AÑO"] ?? r["ANIO"])).filter(Boolean));
  const yearsI = new Set(I.map((r) => Number(r["AÑO"] ?? r["ANIO"])).filter(Boolean));

  let y;
  if (year) {
    y = Number(year);
  } else {
    const inter = [...yearsF].filter((yy) => yearsI.has(yy)).sort((a, b) => a - b);
    y = inter.length ? inter.at(-1) : Math.max(...[...yearsF, ...yearsI]);
    if (!Number.isFinite(y)) y = null;
  }

  const mapSexo = (s) => {
    const t = normStr(s);
    if (t === "MASCULINO") return "HOMBRE";
    if (t === "FEMENINO") return "MUJER";
    if (t === "SIN CLASIFICAR") return "INDETERMINADO";
    return t;
  };

  function sumBySexo(rows, y, sexoMapper = (x) => normStr(x)) {
    const agg = {};
    rows
      .filter((r) => Number(r["AÑO"] ?? r["ANIO"]) === y)
      .forEach((r) => {
        const k = sexoMapper(r.SEXO);
        agg[k] = (agg[k] || 0) + toInt(r.POBLACION);
      });
    const order = ["HOMBRE", "MUJER", "INDETERMINADO"];
    return order.filter((k) => agg[k]).map((k) => ({ name: k, value: agg[k] }));
  }

  return {
    year: y,
    fonasa: sumBySexo(F, y, (s) => normStr(s)),
    isapre: sumBySexo(I, y, mapSexo),
  };
}

// 4) Indicadores macro
async function getIndicador(nombre) {
  const files = {
    publico_privado_pib: [
      [INDICADORES_DIR, "Participación público y privado salud en el PIB.csv"],
      [INDICADORES_DIR, "Participacion_publico_y_privado_salud_en_el_PIB.csv"],
    ],
    salud_total_pib: [
      [INDICADORES_DIR, "Participación sector salud total en el PIB.csv"],
      [INDICADORES_DIR, "Participacion_sector_salud_total_en_el_PIB.csv"],
    ],
    per_capita_constante: [
      [INDICADORES_DIR, "Per cápita en Salud Constante.csv"],
      [INDICADORES_DIR, "Per_capita_en_Salud_Constante.csv"],
    ],
    per_capita_corriente: [
      [INDICADORES_DIR, "Per cápita en Salud Corriente.csv"],
      [INDICADORES_DIR, "Per_capita_en_Salud_Corriente.csv"],
    ],
    per_capita_ppa: [
      [INDICADORES_DIR, "Per cápita en Salud PPA.csv"],
      [INDICADORES_DIR, "Per_capita_en_Salud_PPA.csv"],
    ],
  };
  if (!files[nombre]) {
    throw new Error("Indicador no soportado: " + nombre);
  }
  // intenta en orden hasta encontrar uno
  for (const parts of files[nombre]) {
    const p = path.join(...parts);
    if (fs.existsSync(p)) {
      const rows = await readCsvFlexible(p);
      const cols = Object.keys(rows[0] || {});
      const colYear = cols.find((c) => c.trim() === "-") || cols.find((c) => /anio|año|year/i.test(c));
      if (cols.includes("Privado") && cols.includes("Público")) {
        return rows.map((r) => ({ anio: String(r[colYear]), privado: toFloat(r["Privado"]), publico: toFloat(r["Público"]) }));
      }
      const colSaludPIB = cols.find((c) => /Salud % PIB/i.test(c));
      if (colSaludPIB) return rows.map((r) => ({ anio: String(r[colYear]), valor: toFloat(r[colSaludPIB]) }));
      const colPerCapita =
        cols.find((c) => /Gasto per cápita en salud/i.test(c)) ||
        cols.find((c) => /Gasto per capita en salud/i.test(c));
      if (colPerCapita) return rows.map((r) => ({ anio: String(r[colYear]), valor: toFloat(r[colPerCapita]) }));
      return rows;
    }
  }
  throw new Error("Archivo de indicador no encontrado (intentados múltiples nombres).");
}

// 5) Otros (edad / vigencia / región)
async function getEdad({ year } = {}) {
  const p = path.join(DATA_DIR, "edad_salud.csv");
  if (!fs.existsSync(p)) return { ok: false, message: "Falta backend/data/salud/edad_salud.csv" };
  const rows = await readCsvFlexible(p);
  const ys = [...new Set(rows.map((r) => Number(r["AÑO"] ?? r["ANIO"])))].filter(Boolean);
  const y = Number(year) || Math.max(...ys);
  return {
    ok: true,
    year: y,
    rows: rows
      .filter((r) => Number(r["AÑO"] ?? r["ANIO"]) === y)
      .map((r) => ({ tramo: r.TRAMO_EDAD, poblacion: toInt(r.POBLACION) })),
  };
}
async function getVigencia({ year } = {}) {
  const p = path.join(DATA_DIR, "vigencia_salud.csv");
  if (!fs.existsSync(p)) return { ok: false, message: "Falta backend/data/salud/vigencia_salud.csv" };
  const rows = await readCsvFlexible(p);
  const ys = [...new Set(rows.map((r) => Number(r["AÑO"] ?? r["ANIO"])))].filter(Boolean);
  const y = Number(year) || Math.max(...ys);
  return {
    ok: true,
    year: y,
    rows: rows
      .filter((r) => Number(r["AÑO"] ?? r["ANIO"]) === y) // ✅ paréntesis corregido
      .map((r) => ({ vigencia: r.VIGENCIA, poblacion: toInt(r.POBLACION) })),
  };
}
async function getRegion({ year } = {}) {
  const p = path.join(DATA_DIR, "region_salud.csv");
  if (!fs.existsSync(p)) return { ok: false, message: "Falta backend/data/salud/region_salud.csv" };
  const rows = await readCsvFlexible(p);
  const ys = [...new Set(rows.map((r) => Number(r["AÑO"] ?? r["ANIO"])))].filter(Boolean);
  const y = Number(year) || Math.max(...ys);
  return {
    ok: true,
    year: y,
    rows: rows
      .filter((r) => Number(r["AÑO"] ?? r["ANIO"]) === y)
      .map((r) => ({ region: r.REGION, poblacion: toInt(r.POBLACION) })),
  };
}

module.exports = {
  getBeneficiarios,
  getTipoBeneficiario,
  getSexo,
  getIndicador,
  getEdad,
  getVigencia,
  getRegion,
};
