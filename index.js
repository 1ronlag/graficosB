// ======================= index.js ==========================
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

// ===== Servicios =====
const educacion = require("./services/educacionService");
const {
  getAnual,
  getDataset,
  getTasas,
  getPiramide,
  getESIIngresos,
  getMeta,
} = require("./services/trabajoService");
const salud = require("./services/saludService");

// ===== APP / PORT / HOST =====
const app = express();
// Railway requiere usar process.env.PORT
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

// ----------------------- CORS -----------------------
const allowedOrigins = [
  "http://localhost:5173", // dev vite
  "http://localhost:3000", // dev CRA
  "https://datosparalademocracia.netlify.app", // ✅ dominio netlify
  /\.netlify\.app$/, // permite previews
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.some((o) => (o.test ? o.test(origin) : o === origin))) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const ok = allowedOrigins.some((o) => (o.test ? o.test(origin) : o === origin));
    return ok ? cb(null, true) : cb(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
}));

app.use(express.json());

// =====================================================
// 🚀 ENDPOINT RAÍZ Y HEALTHCHECK
// =====================================================

app.get("/", (_req, res) => {
  res.send("✅ Backend activo y operativo en Railway");
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// =====================================================
// ==============   BANCO CENTRAL (NO TOCAR)   =========
// =====================================================

app.post("/api/banco-central/obtenerSerie", async (req, res) => {
  const { USER_BC, PASS_BC } = process.env;
  const { serieId, startDate, endDate } = req.body;

  const url = `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?user=${USER_BC}&pass=${PASS_BC}&function=GetSeries&timeseries=${serieId}&firstdate=${startDate}&lastdate=${endDate}`;

  try {
    const response = await axios.get(url, { timeout: 30000 });
    res.json(response.data);
  } catch (error) {
    console.error("❌ Error al obtener datos del Banco Central:", error.message);
    res.status(500).json({ error: "No se pudo obtener datos del Banco Central" });
  }
});

// Alias /serie
app.post("/api/banco-central/serie", async (req, res) => {
  const { USER_BC, PASS_BC } = process.env;
  const { serieId, startDate, endDate } = req.body;

  const url = `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?user=${USER_BC}&pass=${PASS_BC}&function=GetSeries&timeseries=${serieId}&firstdate=${startDate}&lastdate=${endDate}`;

  try {
    const response = await axios.get(url, { timeout: 30000 });
    res.json(response.data);
  } catch (error) {
    console.error("❌ Error alias /serie:", error.message);
    res.status(500).json({ error: "No se pudo obtener datos del Banco Central" });
  }
});

// =====================================================
// ====================   TRABAJO   ====================
// =====================================================

app.get("/api/trabajo/anual", async (_req, res) => {
  try {
    const data = await getAnual();
    res.json(data);
  } catch (e) {
    console.error("❌ /trabajo/anual:", e);
    res.status(500).json({ error: "No se pudo obtener los datos anuales de trabajo" });
  }
});

app.get("/api/trabajo/dataset", async (req, res) => {
  try {
    const data = await getDataset(req.query);
    res.json(data);
  } catch (e) {
    console.error("❌ /trabajo/dataset:", e);
    res.status(500).json({ error: "No se pudo obtener el dataset de trabajo" });
  }
});

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

app.get("/api/trabajo/meta", async (_req, res) => {
  try {
    const meta = await getMeta();
    res.json({ ok: true, meta });
  } catch (e) {
    console.error("❌ /trabajo/meta:", e);
    res.status(500).json({ ok: false, error: "No se pudo leer meta" });
  }
});

// =====================================================
// ====================== SALUD ========================
// =====================================================

app.get("/api/salud/beneficiarios", async (_req, res) => {
  try {
    const rows = await salud.getBeneficiarios();
    res.json({ rows });
  } catch (e) {
    console.error("❌ /salud/beneficiarios:", e);
    res.status(500).json({ error: "No se pudo obtener beneficiarios" });
  }
});

app.get("/api/salud/tipo", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getTipoBeneficiario({ year });
    res.json(data);
  } catch (e) {
    console.error("❌ /salud/tipo:", e);
    res.status(500).json({ error: "No se pudo obtener tipo de beneficiario" });
  }
});

app.get("/api/salud/sexo", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getSexo({ year });
    res.json(data);
  } catch (e) {
    console.error("❌ /salud/sexo:", e);
    res.status(500).json({ error: "No se pudo obtener distribución por sexo" });
  }
});

app.get("/api/salud/indicadores/:key", async (req, res) => {
  try {
    const rows = await salud.getIndicador(req.params.key);
    res.json({ rows });
  } catch (e) {
    console.error("❌ /salud/indicadores:", e);
    res.status(500).json({ error: "No se pudo obtener el indicador" });
  }
});

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

app.get("/api/salud/vigencia", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getVigencia({ year });
    res.json(data);
  } catch (e) {
    console.error("❌ /salud/vigencia:", e);
    res.status(500).json({ error: "No se pudo obtener vigencia" });
  }
});

app.get("/api/salud/region", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getRegion({ year });
    res.json(data);
  } catch (e) {
    console.error("❌ /salud/region:", e);
    res.status(500).json({ error: "No se pudo obtener región" });
  }
});

// =====================================================
// 🚀 Iniciar servidor
// =====================================================
app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor Backend escuchando en http://${HOST}:${PORT}`);
});
