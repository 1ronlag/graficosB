// ======================= index.js ==========================
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

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
const PORT = process.env.PORT || 8080; // Railway asigna PORT
const HOST = "0.0.0.0";

// ----------------------- CORS -----------------------
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://datosparalademocracia.netlify.app",
  /\.netlify\.app$/,
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
// 🚀 ROOT & HEALTH
// =====================================================
app.get("/", (_req, res) => {
  res.send("✅ Backend activo y operativo en Railway");
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// =====================================================
// ==============   BANCO CENTRAL   ====================
// =====================================================
app.post("/api/banco-central/obtenerSerie", async (req, res) => {
  const { USER_BC, PASS_BC } = process.env;
  const { serieId, startDate, endDate } = req.body;

  const url = `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?user=${USER_BC}&pass=${PASS_BC}&function=GetSeries&timeseries=${serieId}&firstdate=${startDate}&lastdate=${endDate}`;

  try {
    const response = await axios.get(url, { timeout: 30000 });
    res.json(response.data);
  } catch (error) {
    console.error("❌ Banco Central /obtenerSerie:", error.message);
    res.status(500).json({ ok: false, error: "No se pudo obtener datos del Banco Central" });
  }
});

app.post("/api/banco-central/serie", async (req, res) => {
  const { USER_BC, PASS_BC } = process.env;
  const { serieId, startDate, endDate } = req.body;

  const url = `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?user=${USER_BC}&pass=${PASS_BC}&function=GetSeries&timeseries=${serieId}&firstdate=${startDate}&lastdate=${endDate}`;

  try {
    const response = await axios.get(url, { timeout: 30000 });
    res.json(response.data);
  } catch (error) {
    console.error("❌ Banco Central /serie:", error.message);
    res.status(500).json({ ok: false, error: "No se pudo obtener datos del Banco Central" });
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
    res.status(500).json({ ok: false, error: "No se pudo obtener datos anuales" });
  }
});

app.get("/api/trabajo/dataset", async (req, res) => {
  try {
    const data = await getDataset(req.query);
    res.json(data);
  } catch (e) {
    console.error("❌ /trabajo/dataset:", e);
    res.status(500).json({ ok: false, error: "No se pudo obtener dataset" });
  }
});

app.get("/api/trabajo/tasas", async (req, res) => {
  try {
    const { periodo, sexo } = req.query;
    const data = await getTasas({ periodo, sexo });
    res.json(data);
  } catch (e) {
    console.error("❌ /trabajo/tasas:", e);
    res.status(500).json({ ok: false, error: "No se pudieron obtener tasas" });
  }
});

app.get("/api/trabajo/piramide", async (req, res) => {
  try {
    const { periodo } = req.query;
    const data = await getPiramide({ periodo });
    res.json(data);
  } catch (e) {
    console.error("❌ /trabajo/piramide:", e);
    res.status(500).json({ ok: false, error: "No se pudo obtener pirámide" });
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
    res.status(500).json({ ok: false, error: "No se pudo obtener ESI ingresos" });
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
// ====================== EDUCACIÓN ====================
// (endpoints de tu servicio de educación si los usas)
// =====================================================
// Ejemplos (descomenta si tienes rutas en el front pidiendo esto):
app.get("/api/educacion/matricula/resumen", async (_req, res) => {
  try { res.json(await educacion.getMatriculaResumen()); }
  catch (e) { console.error("❌ /educacion/resumen:", e); res.status(500).json({ ok:false, error:"No se pudo obtener resumen" }); }
});
app.get("/api/educacion/series", async (_req, res) => {
  try { res.json(await educacion.getSeriesEducacion()); }
  catch (e) { console.error("❌ /educacion/series:", e); res.status(500).json({ ok:false, error:"No se pudo obtener series" }); }
});
app.get("/api/educacion/sexo", async (_req, res) => {
  try { res.json(await educacion.getMatriculaSexo()); }
  catch (e) { console.error("❌ /educacion/sexo:", e); res.status(500).json({ ok:false, error:"No se pudo obtener sexo" }); }
});

// =====================================================
// ======================== SALUD ======================
// =====================================================
function sendError(res, e, label) {
  const code = e?.code === "CSV_MISSING" ? 400 : 500;
  const msg = e?.message || String(e);
  console.error(`❌ ${label}:`, msg);
  return res.status(code).json({ ok: false, error: msg, code: e?.code || "ERR" });
}

app.get("/api/salud/beneficiarios", async (_req, res) => {
  try {
    const rows = await salud.getBeneficiarios();
    res.json({ ok: true, rows });
  } catch (e) {
    sendError(res, e, "/salud/beneficiarios");
  }
});

app.get("/api/salud/tipo", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getTipoBeneficiario({ year });
    res.json({ ok: true, ...data });
  } catch (e) {
    sendError(res, e, "/salud/tipo");
  }
});

app.get("/api/salud/sexo", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getSexo({ year });
    res.json({ ok: true, ...data });
  } catch (e) {
    sendError(res, e, "/salud/sexo");
  }
});

app.get("/api/salud/indicadores/:key", async (req, res) => {
  try {
    const rows = await salud.getIndicador(req.params.key);
    res.json({ ok: true, rows });
  } catch (e) {
    sendError(res, e, "/salud/indicadores");
  }
});

app.get("/api/salud/edad", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getEdad({ year });
    res.json({ ok: true, ...data });
  } catch (e) {
    sendError(res, e, "/salud/edad");
  }
});

app.get("/api/salud/vigencia", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getVigencia({ year });
    res.json({ ok: true, ...data });
  } catch (e) {
    sendError(res, e, "/salud/vigencia");
  }
});

app.get("/api/salud/region", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await salud.getRegion({ year });
    res.json({ ok: true, ...data });
  } catch (e) {
    sendError(res, e, "/salud/region");
  }
});

// 🔎 Diagnóstico de archivos esperados de SALUD
app.get("/api/salud/debug/files", (_req, res) => {
  try {
    const BASE = path.join(__dirname, "data", "salud");
    const files = [
      // fonasa
      path.join(BASE, "fonasa", "beneficiarios_fonasa.csv"),
      path.join(BASE, "fonasa", "titulares_cargas_fonasa.csv"),
      path.join(BASE, "fonasa", "titulares_cargas_sexo_fonasa.csv"),
      // isapre
      path.join(BASE, "isapre", "beneficiarios_isapre.csv"),
      path.join(BASE, "isapre", "cotizantes_cargas_isapre.csv"),
      path.join(BASE, "isapre", "cotizantes_cargas_sexo_isapre.csv"),
      // indicadores (nombres alternativos)
      path.join(BASE, "indicadores", "Participación público y privado salud en el PIB.csv"),
      path.join(BASE, "indicadores", "Participacion_publico_y_privado_salud_en_el_PIB.csv"),
      path.join(BASE, "indicadores", "Participación sector salud total en el PIB.csv"),
      path.join(BASE, "indicadores", "Participacion_sector_salud_total_en_el_PIB.csv"),
      path.join(BASE, "indicadores", "Per cápita en Salud Constante.csv"),
      path.join(BASE, "indicadores", "Per_capita_en_Salud_Constante.csv"),
      path.join(BASE, "indicadores", "Per cápita en Salud Corriente.csv"),
      path.join(BASE, "indicadores", "Per_capita_en_Salud_Corriente.csv"),
      path.join(BASE, "indicadores", "Per cápita en Salud PPA.csv"),
      path.join(BASE, "indicadores", "Per_capita_en_Salud_PPA.csv"),
      // otros
      path.join(BASE, "edad_salud.csv"),
      path.join(BASE, "vigencia_salud.csv"),
      path.join(BASE, "region_salud.csv"),
    ];

    const payload = files.map(f => ({
      file: f.replace(process.cwd(), ""),
      exists: fs.existsSync(f),
    }));

    res.json({ ok: true, base: BASE.replace(process.cwd(), ""), files: payload });
  } catch (e) {
    sendError(res, e, "/salud/debug/files");
  }
});

// =====================================================
// 🚀 Iniciar servidor
// =====================================================
app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor backend 32 escuchando en http://${HOST}:${PORT}`);
});
