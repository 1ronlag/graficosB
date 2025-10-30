const express = require("express");
const router = express.Router();

const {
  getMatriculaResumen,
  getSeriesEducacion,
  getMatriculaSexo,
} = require("../services/educacionService");

router.get("/matricula/resumen", async (req, res) => {
  try {
    const data = await getMatriculaResumen();
    res.json(data);
  } catch (err) {
    console.error("Error /matricula/resumen", err);
    res.status(500).json({ error: "Error interno" });
  }
});

router.get("/series", async (req, res) => {
  try {
    const data = await getSeriesEducacion();
    res.json(data);
  } catch (err) {
    console.error("Error /series", err);
    res.status(500).json({ error: "Error interno" });
  }
});

router.get("/sexo", async (req, res) => {
  try {
    const data = await getMatriculaSexo();
    res.json(data);
  } catch (err) {
    console.error("Error /sexo", err);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;