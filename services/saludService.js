// backend/services/saludService.js
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

// ================== RUTAS BASE ==================
const DATA_DIR = path.join(__dirname, "..", "data", "salud");
const FONASA_DIR = path.join(DATA_DIR, "fonasa");
const ISAPRE_DIR = path.join(DATA_DIR, "isapre");
const INDICADORES_DIR = path.join(DATA_DIR, "indicadores");

// ================== HELPERS ==================
function readCsv(p) {
  const raw = fs.readFileSync(p, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true });
}

function tryReadCsv(fileCandidates) {
  for (const fname of fileCandidates) {
    const p = path.join(...fname);
    if (fs.existsSync(p)) return readCsv(p);
  }
  throw new Error("Archivo no encontrado: " + JSON.stringify(fileCandidates));
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
  const s = String(x).trim();
  const normalized = s.replace(/\s/g, "").replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

// 1) Beneficiarios por año
async function getBeneficiarios() {
  const fonasa = readCsv(path.join(FONASA_DIR, "beneficiarios_fonasa.csv"));
  const isapre = readCsv(path.join(ISAPRE_DIR, "beneficiarios_isapre.csv"));

  const map = new Map();

  fonasa.forEach((r) => {
    const y = String(r.ANIO ?? r.Anio ?? r.AÑO ?? r.anio);
    if (!y) return;
    map.set(y, {
      anio: y,
      fonasa: toInt(r.BENEFICIARIOS),
      isapre: undefined,
    });
  });

  isapre.forEach((r) => {
    const y = String(r.ANIO ?? r.Anio ?? r.AÑO ?? r.anio);
    if (!y) return;
    const row = map.get(y) || { anio: y };
    row.isapre = toInt(r.BENEFICIARIOS);
    map.set(y, row);
  });

  return Array.from(map.values()).sort(
    (a, b) => Number(a.anio) - Number(b.anio)
  );
}

// 2) Titular/Carga por sistema
async function getTipoBeneficiario({ year } = {}) {
  const fonasa = readCsv(
    path.join(FONASA_DIR, "titulares_cargas_fonasa.csv")
  );
  const isapre = readCsv(
    path.join(ISAPRE_DIR, "cotizantes_cargas_isapre.csv")
  );

  const normIsapreTipo = (s) => {
    const t = normStr(s);
    if (t.startsWith("COTIZ")) return "COTIZANTES";
    if (t.startsWith("CARG")) return "CARGAS";
    return t;
  };

  const yearsF = new Set(fonasa.map((r) => Number(r["AÑO"])).filter(Boolean));
  const yearsI = new Set(isapre.map((r) => Number(r["AÑO"])).filter(Boolean));

  let y;
  if (year) {
    y = Number(year);
  } else {
    const inter = [...yearsF]
      .filter((yy) => yearsI.has(yy))
      .sort((a, b) => a - b);
    y = inter.length
      ? inter[inter.length - 1]
      : Math.max(...[...yearsF, ...yearsI]);
  }

  const FT = fonasa.find(
    (r) => Number(r["AÑO"]) === y && normStr(r.TITULAR_CARGA) === "TITULAR"
  )?.POBLACION;
  const FC = fonasa.find(
    (r) => Number(r["AÑO"]) === y && normStr(r.TITULAR_CARGA) === "CARGA"
  )?.POBLACION;

  const IT = isapre.find(
    (r) =>
      Number(r["AÑO"]) === y &&
      normIsapreTipo(r.COTIZANTE_CARGA) === "COTIZANTES"
  )?.POBLACION;
  const IC = isapre.find(
    (r) =>
      Number(r["AÑO"]) === y &&
      normIsapreTipo(r.COTIZANTE_CARGA) === "CARGAS"
  )?.POBLACION;

  return {
    year: y,
    rows: [
      { sistema: "FONASA", Titular: toInt(FT), Carga: toInt(FC) },
      { sistema: "ISAPRE", Titular: toInt(IT), Carga: toInt(IC) },
    ],
  };
}

// 3) Distribución por sexo (Titular+Carga / Cotizante+Carga)
async function getSexo({ year } = {}) {
  const F = readCsv(
    path.join(FONASA_DIR, "titulares_cargas_sexo_fonasa.csv")
  );
  const I = readCsv(
    path.join(ISAPRE_DIR, "cotizantes_cargas_sexo_isapre.csv")
  );

  const yearsF = new Set(F.map((r) => Number(r["AÑO"])).filter(Boolean));
  const yearsI = new Set(I.map((r) => Number(r["AÑO"])).filter(Boolean));

  let y;
  if (year) {
    y = Number(year);
  } else {
    const inter = [...yearsF]
      .filter((yy) => yearsI.has(yy))
      .sort((a, b) => a - b);
    y = inter.length
      ? inter[inter.length - 1]
      : Math.max(...[...yearsF, ...yearsI]);
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
      .filter((r) => Number(r["AÑO"]) === y)
      .forEach((r) => {
        const k = sexoMapper(r.SEXO);
        agg[k] = (agg[k] || 0) + toInt(r.POBLACION);
      });
    const order = ["HOMBRE", "MUJER", "INDETERMINADO"];
    return order
      .filter((k) => agg[k])
      .map((k) => ({ name: k, value: agg[k] }));
  }

  return {
    year: y,
    fonasa: sumBySexo(F, y, (s) => normStr(s)),
    isapre: sumBySexo(I, y, mapSexo),
  };
}

// 4) Indicadores macro (los excels convertidos a CSV)
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

  const rows = tryReadCsv(files[nombre]); // array objetos
  const cols = Object.keys(rows[0] || {});
  const colYear =
    cols.find((c) => c.trim() === "-") ||
    cols.find((c) => /anio|año|year/i.test(c));

  if (cols.includes("Privado") && cols.includes("Público")) {
    return rows.map((r) => ({
      anio: String(r[colYear]),
      privado: toFloat(r["Privado"]),
      publico: toFloat(r["Público"]),
    }));
  }

  const colSaludPIB = cols.find((c) => /Salud % PIB/i.test(c));
  if (colSaludPIB) {
    return rows.map((r) => ({
      anio: String(r[colYear]),
      valor: toFloat(r[colSaludPIB]),
    }));
  }

  const colPerCapita =
    cols.find((c) => /Gasto per cápita en salud/i.test(c)) ||
    cols.find((c) => /Gasto per capita en salud/i.test(c));

  if (colPerCapita) {
    return rows.map((r) => ({
      anio: String(r[colYear]),
      valor: toFloat(r[colPerCapita]),
    }));
  }

  return rows;
}

// 5) Otros (edad / vigencia / región) - opcionales
async function getEdad({ year } = {}) {
  const p = path.join(DATA_DIR, "edad_salud.csv");
  if (!fs.existsSync(p)) {
    return {
      ok: false,
      message: "Falta backend/data/salud/edad_salud.csv",
    };
  }
  const rows = readCsv(p); // AÑO,TRAMO_EDAD,POBLACION
  const ys = [...new Set(rows.map((r) => Number(r["AÑO"])))].filter(Boolean);
  const y = Number(year) || Math.max(...ys);
  return {
    ok: true,
    year: y,
    rows: rows
      .filter((r) => Number(r["AÑO"]) === y)
      .map((r) => ({
        tramo: r.TRAMO_EDAD,
        poblacion: toInt(r.POBLACION),
      })),
  };
}

async function getVigencia({ year } = {}) {
  const p = path.join(DATA_DIR, "vigencia_salud.csv");
  if (!fs.existsSync(p)) {
    return {
      ok: false,
      message: "Falta backend/data/salud/vigencia_salud.csv",
    };
  }
  const rows = readCsv(p); // AÑO,VIGENCIA,POBLACION
  const ys = [...new Set(rows.map((r) => Number(r["AÑO"])))].filter(Boolean);
  const y = Number(year) || Math.max(...ys);
  return {
    ok: true,
    year: y,
    rows: rows
      .filter((r) => Number(r["AÑO"] === y))
      .map((r) => ({
        vigencia: r.VIGENCIA,
        poblacion: toInt(r.POBLACION),
      })),
  };
}

async function getRegion({ year } = {}) {
  const p = path.join(DATA_DIR, "region_salud.csv");
  if (!fs.existsSync(p)) {
    return {
      ok: false,
      message: "Falta backend/data/salud/region_salud.csv",
    };
  }
  const rows = readCsv(p); // AÑO,REGION,POBLACION
  const ys = [...new Set(rows.map((r) => Number(r["AÑO"])))].filter(Boolean);
  const y = Number(year) || Math.max(...ys);
  return {
    ok: true,
    year: y,
    rows: rows
      .filter((r) => Number(r["AÑO"]) === y)
      .map((r) => ({
        region: r.REGION,
        poblacion: toInt(r.POBLACION),
      })),
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