const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const DATA_DIR = path.join(__dirname, "..", "data", "educacion");
const FILE_TOTAL = path.join(DATA_DIR, "matricula_total_por_anio.csv");
const FILE_NIVEL = path.join(DATA_DIR, "matricula_por_nivel.csv");
const FILE_SEXO = path.join(DATA_DIR, "matricula_por_sexo.csv");

function readCSV(filePath) {
  const csv = fs.readFileSync(filePath, "utf8");
  return parse(csv, { columns: true, skip_empty_lines: true });
}

// MATRÍCULA TOTAL POR AÑO
async function getMatriculaResumen() {
  const rows = readCSV(FILE_TOTAL);

  const porAnio = rows
    .map((r) => ({
      anio: Number(r.anio),
      matricula_total: Number(r.matricula_total),
    }))
    .filter(
      (r) => Number.isFinite(r.anio) && Number.isFinite(r.matricula_total)
    )
    .sort((a, b) => a.anio - b.anio);

  const ultimo = porAnio.length ? porAnio[porAnio.length - 1].anio : null;

  return {
    porAnio,
    ultimoDetalle: {
      anio: ultimo,
      dependencia: [],
    },
  };
}

// SERIES POR NIVEL EDUCATIVO
async function getSeriesEducacion() {
  const rows = readCSV(FILE_NIVEL);
  const grupos = {};

  for (const r of rows) {
    const nivel = String(r.nivel_educativo).trim();
    const anio = Number(r.anio);
    const valor = Number(r.poblacion);

    if (!grupos[nivel]) grupos[nivel] = [];

    if (Number.isFinite(anio) && Number.isFinite(valor)) {
      grupos[nivel].push({ anio, valor });
    }
  }

  Object.keys(grupos).forEach((k) => {
    grupos[k].sort((a, b) => a.anio - b.anio);
  });

  return grupos;
}

// MATRÍCULA POR SEXO
async function getMatriculaSexo() {
  const rows = readCSV(FILE_SEXO);

  // agrupamos por año: { [anio]: { Hombre: X, Mujer: Y, "Sin información": Z } }
  const byYear = {};
  for (const r of rows) {
    const anio = Number(r.anio);
    const sexo = String(r.sexo).trim();
    const poblacion = Number(r.poblacion);

    if (!Number.isFinite(anio) || !Number.isFinite(poblacion)) continue;

    if (!byYear[anio]) {
      byYear[anio] = {};
    }
    byYear[anio][sexo] = poblacion;
  }

  // ordenamos años
  const allYears = Object.keys(byYear)
    .map((y) => Number(y))
    .sort((a, b) => a - b);

  // construimos serieCompleta [{anio, genero:[...]}]
  const serieCompleta = allYears.map((y) => {
    const hombres = byYear[y]["Hombre"] || 0;
    const mujeres = byYear[y]["Mujer"] || 0;
    const sinInfo = byYear[y]["Sin información"] || 0;
    const total = hombres + mujeres + sinInfo;

    const genero = [
      {
        sexo: "Hombre",
        matricula: hombres,
        porcentaje: total
          ? ((hombres / total) * 100).toFixed(1)
          : "0.0",
      },
      {
        sexo: "Mujer",
        matricula: mujeres,
        porcentaje: total
          ? ((mujeres / total) * 100).toFixed(1)
          : "0.0",
      },
      {
        sexo: "Sin información",
        matricula: sinInfo,
        porcentaje: total
          ? ((sinInfo / total) * 100).toFixed(1)
          : "0.0",
      },
    ];

    return { anio: y, genero };
  });

  // último año disponible
  let ultimo = null;
  if (serieCompleta.length > 0) {
    ultimo = serieCompleta[serieCompleta.length - 1];
  }

  // aquí devolvemos SIEMPRE la misma estructura estable
  // el frontend leerá .ultimo primero
  return {
    serieCompleta,
    ultimo,
  };
}

module.exports = {
  getMatriculaResumen,
  getSeriesEducacion,
  getMatriculaSexo,
};
