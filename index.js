// ======================== SALUD ====================================

// Helper para responder errores con detalle
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

// 🔎 Endpoint de diagnóstico: existencia de CSVs requeridos
app.get("/api/salud/debug/files", (_req, res) => {
  try {
    const path = require("path");
    const fs = require("fs");

    const BASE = path.join(__dirname, "data", "salud");
    const files = [
      ["fonasa/beneficiarios_fonasa.csv"],
      ["fonasa/titulares_cargas_fonasa.csv"],
      ["fonasa/titulares_cargas_sexo_fonasa.csv"],
      ["isapre/beneficiarios_isapre.csv"],
      ["isapre/cotizantes_cargas_isapre.csv"],
      ["isapre/cotizantes_cargas_sexo_isapre.csv"],
      ["indicadores/Participación público y privado salud en el PIB.csv"],
      ["indicadores/Participacion_publico_y_privado_salud_en_el_PIB.csv"],
      ["indicadores/Participación sector salud total en el PIB.csv"],
      ["indicadores/Participacion_sector_salud_total_en_el_PIB.csv"],
      ["indicadores/Per cápita en Salud Constante.csv"],
      ["indicadores/Per_capita_en_Salud_Constante.csv"],
      ["indicadores/Per cápita en Salud Corriente.csv"],
      ["indicadores/Per_capita_en_Salud_Corriente.csv"],
      ["indicadores/Per cápita en Salud PPA.csv"],
      ["indicadores/Per_capita_en_Salud_PPA.csv"],
      ["edad_salud.csv"],
      ["vigencia_salud.csv"],
      ["region_salud.csv"],
    ].map(parts => path.join(BASE, ...parts));

    const payload = files.map(f => ({
      file: f.replace(process.cwd(), ""),
      exists: fs.existsSync(f)
    }));

    return res.json({ ok: true, base: BASE.replace(process.cwd(), ""), files: payload });
  } catch (e) {
    return sendError(res, e, "/salud/debug/files");
  }
});
