require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

// ===== Servicios de Educación (lee CSV consolidados) =====
const educacion = require("./services/educacionService");

// ===== Servicios de Trabajo =====
const {
  getAnual,
  getDataset,
  getTasas,
  getPiramide,
  getESIIngresos,
  getMeta,
} = require("./services/trabajoService");

// ===== Servicios de Salud =====
const salud = require("./services/saludService");

// ===== APP / PORT =====
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ----------------------- Healthcheck -----------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ===================================================================
// ==============   BANCO CENTRAL (NO TOCAR)   =======================
// ===================================================================
app.post("/api/banco-central/obtenerSerie", async (req, res) => {
  const { USER_BC, PASS_BC } = process.env;
  const { serieId, startDate, endDate } = req.body;

  const url = `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?user=${USER_BC}&pass=${PASS_BC}&function=GetSeries&timeseries=${serieId}&firstdate=${startDate}&lastdate=${endDate}`;

  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error("❌ Error al obtener datos:", error.message);
    res
      .status(500)
      .json({ error: "No se pudo obtener datos del Banco Central" });
  }
});

app.post("/api/banco-central/serie", async (req, res) => {
  const { USER_BC, PASS_BC } = process.env;
  const { serieId, startDate, endDate } = req.body;

  const url = `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?user=${USER_BC}&pass=${PASS_BC}&function=GetSeries&timeseries=${serieId}&firstdate=${startDate}&lastdate=${endDate}`;

  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error("❌ Error al obtener datos (alias /serie):", error.message);
    res.status(500).json({
      error: "No se pudo obtener datos del Banco Central (alias /serie)",
    });
  }
});

// ===================================================================
// =======================   TRABAJO   ================================
// ===================================================================

// Anual (2018–2024): { rows: [...] }
app.get("/api/trabajo/anual", async (_req, res) => {
  try {
    const data = await getAnual();
    res.json(data);
  } catch (e) {
    console.error("❌ /trabajo/anual:", e);
    res
      .status(500)
      .json({ error: "No se pudo obtener los datos anuales de trabajo" });
  }
});

// Dataset ENE completo (permite filtros por query si los envías)
app.get("/api/trabajo/dataset", async (req, res) => {
  try {
    const data = await getDataset(req.query);
    res.json(data);
  } catch (e) {
    console.error("❌ /trabajo/dataset:", e);
    res
      .status(500)
      .json({ error: "No se pudo obtener el dataset de trabajo" });
  }
});

// Tasas ENE (TD, TO, TP, TPL, SU1–SU4, TOI, TOSI)
app.get("/api/trabajo/tasas", async (req, res) => {
  try {
    const { periodo, sexo } = req.query;
    const data = await getTasas({ periodo, sexo });
    res.json(data);
  } catch (e) {
    console.error("❌ /trabajo/tasas:", e);
    res.status(500).json({ error: "No se pudieron obtener las tasas" });
  }
});

// Pirámide PET/FDT/OC/... (por periodo, ej: 2024T2)
app.get("/api/trabajo/piramide", async (req, res) => {
  try {
    const { periodo } = req.query;
    const data = await getPiramide({ periodo });
    res.json(data);
  } catch (e) {
    console.error("❌ /trabajo/piramide:", e);
    res.status(500).json({ error: "No se pudo obtener la pirámide" });
  }
});

// ESI Ingresos (array en {rows}: [{ anio, total, hombres, mujeres }])
app.get("/api/trabajo/esi/ingresos", async (req, res) => {
  try {
    const { anioDesde, anioHasta } = req.query;
    const rows = await getESIIngresos({
      anioDesde: anioDesde ? Number(anioDesde) : undefined,
      anioHasta: anioHasta ? Number(anioHasta) : undefined,
    });
    res.json({ rows });
  } catch (e) {
    console.error("❌ /trabajo/esi/ingresos:", e);
    res.status(500).json({ error: "No se pudo obtener ESI ingresos" });
  }
});

// (Opcional) Meta: cuenta filas y muestra años min/max por archivo CSV
app.get("/api/trabajo/meta", async (_req, res) => {
  try {
    const meta = await getMeta();
    res.json({ ok: true, meta });
  } catch (e) {
    console.error("❌ /trabajo/meta:", e);
    res.status(500).json({ ok: false, error: "No se pudo leer meta" });
  }
});

// ===================================================================
// ======================== SALUD ====================================
// ===================================================================

// Beneficiarios por año — FONASA vs ISAPRE
app.get("/api/salud/beneficiarios", async (_req, res) => {
  try {
    const rows = await salud.getBeneficiarios();
    res.json({ rows });
  } catch (e) {
    console.error("❌ /salud/beneficiarios:", e);
    res
      .status(500)
      .json({ error: "No se pudo obtener beneficiarios" });
  }
});

// Titular/Carga (último año común o ?year=YYYY)
app.get("/api/salud/tipo", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getTipoBeneficiario({ year });
    res.json(data);
  } catch (e) {
    console.error("❌ /salud/tipo:", e);
    res
      .status(500)
      .json({ error: "No se pudo obtener tipo de beneficiario" });
  }
});

// Sexo (último año común o ?year=YYYY)
app.get("/api/salud/sexo", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getSexo({ year });
    res.json(data);
  } catch (e) {
    console.error("❌ /salud/sexo:", e);
    res
      .status(500)
      .json({ error: "No se pudo obtener distribución por sexo" });
  }
});

// Indicadores (CSV convertidos de Excel)
app.get("/api/salud/indicadores/:key", async (req, res) => {
  try {
    const rows = await salud.getIndicador(req.params.key);
    res.json({ rows });
  } catch (e) {
    console.error("❌ /salud/indicadores:", e);
    res
      .status(500)
      .json({ error: "No se pudo obtener el indicador" });
  }
});

// Edad (placeholder / datos por edad)
app.get("/api/salud/edad", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getEdad({ year });
    res.json(data);
  } catch (e) {
    console.error("❌ /salud/edad:", e);
    res.status(500).json({ error: "No se pudo obtener edad" });
  }
});

// Vigencia (placeholder)
app.get("/api/salud/vigencia", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getVigencia({ year });
    res
      .status(500)
      .json({ error: "No se pudo obtener vigencia" });
  } catch (e) {
    console.error("❌ /salud/vigencia:", e);
    res
      .status(500)
      .json({ error: "No se pudo obtener vigencia" });
  }
});

// Región (por año)
app.get("/api/salud/region", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getRegion({ year });
    res.json(data);
  } catch (e) {
    console.error("❌ /salud/region:", e);
    res
      .status(500)
      .json({ error: "No se pudo obtener región" });
  }
});

// ===================================================================
// ===================== EDUCACION ===================================
// ===================================================================

// --- 1. Resumen total matrícula (serie total anual + último año disponible) ---
app.get("/api/educacion/matricula/resumen", async (_req, res) => {
  try {
    const data = await educacion.getMatriculaResumen();
    res.json(data);
  } catch (e) {
    console.error("❌ /educacion/matricula/resumen:", e);
    res.status(500).json({ error: "No se pudo obtener el resumen" });
  }
});

// --- 2. Series por nivel educativo (Parvularia, Básica, Media, etc.) ---
app.get("/api/educacion/series", async (_req, res) => {
  try {
    const data = await educacion.getSeriesEducacion();
    res.json(data);
  } catch (e) {
    console.error("❌ /educacion/series:", e);
    res.status(500).json({ error: "No se pudo obtener las series" });
  }
});

// --- 3. Distribución por sexo (donut último año) ---
app.get("/api/educacion/sexo", async (_req, res) => {
  try {
    const data = await educacion.getMatriculaSexo();
    res.json(data);
  } catch (e) {
    console.error("❌ /educacion/sexo:", e);
    res.status(500).json({
      error: "No se pudo obtener la información por sexo",
    });
  }
});

// ----------------------- Server -----------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend escuchando en http://localhost:${PORT}`);
});
