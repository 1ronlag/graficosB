const express = require("express");
const router = express.Router();

const {
  getMatriculaResumen,
  getSeriesEducacion,
  getMatriculaSexo,
} = require("../services/educacionService");

// === Middleware CORS por endpoint ===
function allowCORS(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.end();
}

// =====================================================
// /matricula/resumen
// =====================================================
router.options("/matricula/resumen", allowCORS);
router.get("/matricula/resumen", async (req, res) => {
  try {
    const data = await getMatriculaResumen();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error("❌ Error /matricula/resumen", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// =====================================================
// /series
// =====================================================
router.options("/series", allowCORS);
router.get("/series", async (req, res) => {
  try {
    const data = await getSeriesEducacion();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error("❌ Error /series", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// =====================================================
// /sexo
// =====================================================
router.options("/sexo", allowCORS);
router.get("/sexo", async (req, res) => {
  try {
    const data = await getMatriculaSexo();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error("❌ Error /sexo", err);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;
