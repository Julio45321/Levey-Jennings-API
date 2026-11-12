const express = require("express");
const app = express();
app.use(express.json());
app.use(express.static("public"));

const { generarGraficaLeveyJennings } = require("./utils/grafica");
const { pruebaGrubbs } = require("./utils/grubbs");
const Medicion = require("./models/medicion");
const ParametroControl = require("./models/parametroControl");
const { calcularEstadisticas } = require("./utils/estadisticas");
const Analisis = require("./models/analisis");

require("dotenv").config();

const conectarDB = require("./config/database");

const PORT = 3000;

app.post("/api/control/registrar", async (req, res) => {
  try {
    const { prueba, nivelControl, valor, fecha, lote, equipo } = req.body;

    // Validar campos obligatorios
    if (
      !prueba ||
      !nivelControl ||
      valor === undefined ||
      !fecha ||
      !lote ||
      !equipo
    ) {
      return res.status(400).json({
        mensaje: "Todos los campos son obligatorios",
      });
    }

    // Validar valor numérico
    if (typeof valor !== "number" || !Number.isFinite(valor)) {
      return res.status(400).json({
        mensaje: "El valor debe ser un número válido",
      });
    }

    // Validar fecha
    const fechaMedicion = new Date(fecha);

    if (isNaN(fechaMedicion.getTime())) {
      return res.status(400).json({
        mensaje: "La fecha no es válida",
      });
    }

    // Crear medición
    const nuevaMedicion = new Medicion({
      prueba,
      nivelControl,
      valor,
      fecha: fechaMedicion,
      lote,
      equipo,
    });

    // Guardar en MongoDB
    await nuevaMedicion.save();

    res.status(201).json({
      mensaje: "Medición registrada correctamente",
      medicion: nuevaMedicion,
    });
  } catch (error) {
    console.error("Error al registrar medición:", error);

    res.status(500).json({
      mensaje: "Error al registrar la medición",
      error: error.message,
    });
  }
});

app.post("/api/control/registrar-lote", async (req, res) => {
  try {
    const { prueba, mediciones } = req.body || {};

    if (!prueba || typeof prueba !== "string" || !prueba.trim()) {
      return res.status(400).json({
        mensaje: "Debes proporcionar el nombre de la prueba.",
      });
    }

    if (!Array.isArray(mediciones) || mediciones.length !== 20) {
      return res.status(400).json({
        mensaje: "Debes enviar exactamente 20 mediciones.",
      });
    }

    for (let i = 0; i < mediciones.length; i++) {
      const { fecha, valor } = mediciones[i] || {};

      if (
        typeof fecha !== "string" ||
        !Number.isFinite(Date.parse(fecha)) ||
        !Number.isFinite(valor)
      ) {
        return res.status(400).json({
          mensaje: `La medición ${i + 1} tiene una fecha o valor inválido.`,
        });
      }
    }

    const valores = mediciones.map((medicion) => medicion.valor);

    const estadisticas = calcularEstadisticas(valores);

    // Ejecutar Grubbs enviando fecha y valor de cada medición
    const analisisGrubbs = pruebaGrubbs(mediciones);

    const nuevasMediciones = mediciones.map((medicion) => {
      // Comprobar si esta medición fue identificada como sospechosa
      const esSospechosa =
        analisisGrubbs.esAtipico &&
        medicion.valor === analisisGrubbs.valorSospechoso &&
        medicion.fecha === analisisGrubbs.fechaValorSospechoso;

      return {
        prueba: prueba.trim(),
        fecha: new Date(`${medicion.fecha}T12:00:00.000Z`),
        valor: medicion.valor,

        // Marcar el posible valor atípico para revisión
        estado: esSospechosa ? "pendiente_revision" : "valida",
      };
    });

    // Generar un identificador único para este análisis
    const analisisId = new Medicion.base.Types.ObjectId();

    // Relacionar las 20 mediciones con el mismo análisis
    nuevasMediciones.forEach((medicion) => {
      medicion.analisisId = analisisId;
    });

    const resultado = await Medicion.insertMany(nuevasMediciones);

    const nuevoAnalisis = await Analisis.create({
      _id: analisisId,
      prueba: prueba.trim(),
      ...estadisticas,
      analisisGrubbs,

      // Cantidad de mediciones requeridas
      medicionesRequeridas: 20,

      // Contar mediciones sin observaciones pendientes
      totalMedicionesValidas: nuevasMediciones.filter(
        (medicion) => medicion.estado === "valida",
      ).length,

      // Determinar el estado inicial del análisis
      estado:
        analisisGrubbs.esAtipico || analisisGrubbs.hayEmpate
          ? "pendiente_revision"
          : "completo",

      mediciones: resultado.map((medicion) => ({
        fecha: medicion.fecha,
        valor: medicion.valor,
      })),
    });

    res.status(201).json({
      mensaje: "Las 20 mediciones se registraron y analizaron correctamente.",
      analisis: nuevoAnalisis,
    });
  } catch (error) {
    console.error("Error al registrar y analizar:", error);

    res.status(500).json({
      mensaje: "Error al registrar y analizar las mediciones.",
      error: error.message,
    });
  }
});

app.get("/api/control/reevaluar-grubbs/:analisisId", async (req, res) => {
  try {
    const { analisisId } = req.params;

    // Validar el ID
    if (!/^[a-f\d]{24}$/i.test(analisisId)) {
      return res.status(400).json({
        mensaje: "El ID del análisis no es válido.",
      });
    }

    // Buscar el análisis
    const analisis = await Analisis.findById(analisisId);

    if (!analisis) {
      return res.status(404).json({
        mensaje: "No se encontró el análisis.",
      });
    }

    // Consultar todas las mediciones del análisis
    const mediciones = await Medicion.find({
      analisisId: analisis._id,
    }).sort({ fecha: 1, _id: 1 });

    // Excluir los valores descartados
    const candidatas = mediciones.filter(
      (m) => m.estado === "valida" || m.estado === "pendiente_revision",
    );

    const excluidas = mediciones.filter((m) => m.estado === "excluida");

    const requeridas = analisis.medicionesRequeridas || 20;

    // Grubbs debe trabajar con exactamente 20 valores
    if (candidatas.length !== requeridas) {
      return res.status(409).json({
        mensaje: `Se necesitan exactamente ${requeridas} mediciones candidatas.`,
        totalCandidatas: candidatas.length,
        totalExcluidas: excluidas.length,
      });
    }

    // Preparar los datos para Grubbs
    const datosGrubbs = candidatas.map((m) => ({
      fecha: m.fecha,
      valor: m.valor,
    }));

    // Ejecutar la prueba
    const resultadoGrubbs = pruebaGrubbs(datosGrubbs);

    if (resultadoGrubbs.error) {
      return res.status(422).json({
        mensaje: resultadoGrubbs.error,
      });
    }

    return res.status(200).json({
      mensaje: "Reevaluación de Grubbs realizada correctamente.",
      prueba: analisis.prueba,
      totalRegistradas: mediciones.length,
      totalCandidatas: candidatas.length,
      totalExcluidas: excluidas.length,
      resultadoGrubbs,
    });
  } catch (error) {
    console.error("Error al reevaluar Grubbs:", error);

    return res.status(500).json({
      mensaje: "Error al reevaluar la prueba de Grubbs.",
      error: error.message,
    });
  }
});

app.post("/api/control/agregar-reemplazo/:analisisId", async (req, res) => {
  try {
    const { analisisId } = req.params;
    const { fecha, valor } = req.body || {};

    // Validar el identificador del análisis
    if (!/^[a-f\d]{24}$/i.test(analisisId)) {
      return res.status(400).json({
        mensaje: "El ID del análisis no es válido.",
      });
    }

    // Buscar el análisis
    const analisis = await Analisis.findById(analisisId);

    if (!analisis) {
      return res.status(404).json({
        mensaje: "No se encontró el análisis.",
      });
    }

    // Consultar las mediciones relacionadas
    const mediciones = await Medicion.find({
      analisisId: analisis._id,
    });

    const totalValidas = mediciones.filter((m) => m.estado === "valida").length;

    const hayPendientes = mediciones.some(
      (m) => m.estado === "pendiente_revision",
    );

    const totalExcluidas = mediciones.filter(
      (m) => m.estado === "excluida",
    ).length;

    const requeridas = analisis.medicionesRequeridas || 20;

    // No permitir reemplazos durante una revisión
    if (hayPendientes) {
      return res.status(409).json({
        mensaje:
          "Primero debes resolver las mediciones pendientes de revisión.",
      });
    }

    // Solo permitir reemplazos de mediciones excluidas
    if (totalExcluidas === 0 || totalValidas >= requeridas) {
      return res.status(409).json({
        mensaje: "Este análisis no necesita mediciones de reemplazo.",
      });
    }

    // Validar fecha y valor
    if (
      typeof fecha !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      !Number.isFinite(Date.parse(fecha)) ||
      typeof valor !== "number" ||
      !Number.isFinite(valor)
    ) {
      return res.status(400).json({
        mensaje:
          "Debes proporcionar una fecha YYYY-MM-DD y un valor numérico válido.",
      });
    }

    // Registrar la medición de reemplazo
    const nuevaMedicion = await Medicion.create({
      prueba: analisis.prueba,
      fecha: new Date(`${fecha}T12:00:00.000Z`),
      valor,
      analisisId: analisis._id,
      estado: "pendiente_revision",
    });

    // Actualizar el estado del análisis
    analisis.totalMedicionesValidas = totalValidas;
    analisis.estado = "pendiente_revision";

    await analisis.save();

    return res.status(201).json({
      mensaje:
        "Medición de reemplazo registrada correctamente. Pendiente de evaluación.",
      medicion: nuevaMedicion,
      resumen: {
        totalRegistradas: mediciones.length + 1,
        totalValidas,
        totalExcluidas,
        totalPendientes: 1,
        medicionesRequeridas: requeridas,
        estado: analisis.estado,
      },
    });
  } catch (error) {
    console.error("Error al registrar reemplazo:", error);

    return res.status(500).json({
      mensaje: "Error al registrar la medición de reemplazo.",
      error: error.message,
    });
  }
});

app.patch("/api/control/revisar-medicion/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { decision, observaciones, motivo, autorizadoPor } = req.body || {};

    // Validar el identificador de MongoDB
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({
        mensaje: "El ID de la medición no es válido.",
      });
    }

    // Buscar la medición
    const medicion = await Medicion.findById(id);

    if (!medicion) {
      return res.status(404).json({
        mensaje: "No se encontró la medición.",
      });
    }

    // Solo se pueden revisar mediciones pendientes
    if (medicion.estado !== "pendiente_revision") {
      return res.status(409).json({
        mensaje: "Esta medición no está pendiente de revisión.",
      });
    }

    // Validar la decisión
    if (!["conservar", "excluir"].includes(decision)) {
      return res.status(400).json({
        mensaje: "La decisión debe ser conservar o excluir.",
      });
    }

    // Exigir observaciones de la investigación
    if (typeof observaciones !== "string" || !observaciones.trim()) {
      return res.status(400).json({
        mensaje: "Debes documentar las observaciones de la investigación.",
      });
    }

    // Para excluir, exigir motivo técnico y autorización
    if (decision === "excluir") {
      if (
        typeof motivo !== "string" ||
        !motivo.trim() ||
        typeof autorizadoPor !== "string" ||
        !autorizadoPor.trim()
      ) {
        return res.status(400).json({
          mensaje:
            "Para excluir debes indicar el motivo técnico y quién autorizó.",
        });
      }
    }

    medicion.investigacion = {
      observaciones: observaciones.trim(),
      fechaRevision: new Date(),
    };

    if (decision === "excluir") {
      medicion.estado = "excluida";

      medicion.exclusion = {
        motivo: motivo.trim(),
        autorizadoPor: autorizadoPor.trim(),
        fechaExclusion: new Date(),
      };
    } else {
      medicion.estado = "valida";
    }

    await medicion.save();

    // Actualizar el análisis relacionado con la medición
    if (medicion.analisisId) {
      const analisis = await Analisis.findById(medicion.analisisId);

      if (analisis) {
        // Consultar todas las mediciones del análisis
        const medicionesAnalisis = await Medicion.find({
          analisisId: analisis._id,
        });

        // Contar las mediciones válidas
        const totalValidas = medicionesAnalisis.filter(
          (m) => m.estado === "valida",
        ).length;

        // Comprobar si hay revisiones pendientes
        const hayPendientes = medicionesAnalisis.some(
          (m) => m.estado === "pendiente_revision",
        );

        analisis.totalMedicionesValidas = totalValidas;

        if (hayPendientes) {
          analisis.estado = "pendiente_revision";
        } else if (totalValidas < analisis.medicionesRequeridas) {
          analisis.estado = "requiere_reemplazo";
        } else if (totalValidas === analisis.medicionesRequeridas) {
          // Obtener únicamente las mediciones válidas
          const medicionesValidas = medicionesAnalisis
            .filter((m) => m.estado === "valida")
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

          // Preparar los datos para la prueba de Grubbs
          const datosGrubbs = medicionesValidas.map((m) => ({
            fecha: m.fecha,
            valor: m.valor,
          }));

          // Reevaluar Grubbs con las 20 mediciones válidas
          const resultadoGrubbs = pruebaGrubbs(datosGrubbs);

          // No finalizar si hay errores o posibles valores atípicos
          if (
            resultadoGrubbs.error ||
            resultadoGrubbs.esAtipico ||
            resultadoGrubbs.hayEmpate
          ) {
            analisis.estado = "pendiente_revision";
            analisis.analisisGrubbs = resultadoGrubbs;
          } else {
            // Calcular estadísticas definitivas
            const valoresValidos = medicionesValidas.map((m) => m.valor);

            const estadisticasFinales = calcularEstadisticas(valoresValidos);

            // Actualizar los resultados del análisis
            analisis.media = estadisticasFinales.media;
            analisis.desviacionEstandar =
              estadisticasFinales.desviacionEstandar;
            analisis.coeficienteVariacion =
              estadisticasFinales.coeficienteVariacion;
            analisis.totalMediciones = estadisticasFinales.totalMediciones;

            // Guardar únicamente las 20 mediciones válidas
            // en el conjunto estadístico final
            analisis.mediciones = medicionesValidas.map((m) => ({
              fecha: m.fecha,
              valor: m.valor,
            }));

            // Guardar el resultado actualizado de Grubbs
            analisis.analisisGrubbs = resultadoGrubbs;

            analisis.estado = "completo";
          }
        } else {
          // Evitar completar análisis con más de 20 valores válidos
          analisis.estado = "pendiente_revision";
        }

        await analisis.save();
      }
    }

    return res.status(200).json({
      mensaje:
        decision === "excluir"
          ? "Medición excluida y documentada correctamente."
          : "Medición revisada y conservada correctamente.",
      medicion,
    });
  } catch (error) {
    console.error("Error al revisar medición:", error);

    return res.status(500).json({
      mensaje: "Error al revisar la medición.",
      error: error.message,
    });
  }
});

// Endpoint de bienvenida para comprobar que la API funciona
app.get("/", (req, res) => {
  res.json({
    mensaje: "API funcionando correctamente",
  });
});

// Endpoint para calcular los límites de control
app.post("/api/levey-jennings/calcular", (req, res) => {
  const { prueba, media, desviacionEstandar, resultados } = req.body;

  // Validar los parámetros estadísticos
  if (
    typeof media !== "number" ||
    !Number.isFinite(media) ||
    typeof desviacionEstandar !== "number" ||
    !Number.isFinite(desviacionEstandar) ||
    desviacionEstandar <= 0
  ) {
    return res.status(400).json({
      error:
        "La media debe ser numérica y la desviación estándar debe ser mayor que cero.",
    });
  }

  // Validar los resultados recibidos
  if (
    !Array.isArray(resultados) ||
    resultados.length === 0 ||
    resultados.some(
      (r) =>
        !r ||
        typeof r.fecha !== "string" ||
        Number.isNaN(Date.parse(r.fecha)) ||
        typeof r.valor !== "number" ||
        !Number.isFinite(r.valor),
    )
  ) {
    return res.status(400).json({
      error: "Envía al menos un resultado con fecha válida y valor numérico.",
    });
  }

  // Calcular las líneas de control
  const limitesControl = {
    menos3DE: media - 3 * desviacionEstandar,
    menos2DE: media - 2 * desviacionEstandar,
    menos1DE: media - desviacionEstandar,
    media: media,
    mas1DE: media + desviacionEstandar,
    mas2DE: media + 2 * desviacionEstandar,
    mas3DE: media + 3 * desviacionEstandar,
  };

  // Ordenar los resultados cronológicamente
  const resultadosOrdenados = [...resultados].sort(
    (a, b) => Date.parse(a.fecha) - Date.parse(b.fecha),
  );

  // Calcular el Z-score de cada resultado
  const resultadosCalculados = resultadosOrdenados.map((r) => ({
    fecha: r.fecha,
    valor: r.valor,
    zScore: (r.valor - media) / desviacionEstandar,
  }));

  // Revisar las reglas de Westgard
  const alertas = [];

  // Regla 1_2s: advertencia si un resultado supera ±2 DE
  resultadosCalculados.forEach((r) => {
    if (Math.abs(r.zScore) >= 2 && Math.abs(r.zScore) < 3) {
      alertas.push({
        regla: "1_2s",
        nivel: "advertencia",
        tipoError: "no_determinado",
        fechas: [r.fecha],
        mensaje: "Un resultado supera ±2 desviaciones estándar.",
      });
    }

    // Regla 1_3s: un resultado supera ±3 DE
    if (Math.abs(r.zScore) >= 3) {
      alertas.push({
        regla: "1_3s",
        nivel: "rechazo",
        tipoError: "aleatorio",
        fechas: [r.fecha],
        mensaje: "Un resultado supera ±3 desviaciones estándar.",
      });
    }
  });

  // Revisar reglas que dependen de resultados consecutivos
  for (let i = 1; i < resultadosCalculados.length; i++) {
    const anterior = resultadosCalculados[i - 1];
    const actual = resultadosCalculados[i];

    // Regla 2_2s: dos resultados >2 DE en el mismo lado
    if (
      Math.abs(anterior.zScore) >= 2 &&
      Math.abs(actual.zScore) >= 2 &&
      Math.sign(anterior.zScore) === Math.sign(actual.zScore)
    ) {
      alertas.push({
        regla: "2_2s",
        nivel: "rechazo",
        tipoError: "sistematico",
        fechas: [anterior.fecha, actual.fecha],
        mensaje:
          "Dos resultados consecutivos superan 2 DE en el mismo lado de la media.",
      });
    }

    // Regla R_4s: uno supera +2 DE y otro -2 DE
    if (
      (anterior.zScore >= 2 && actual.zScore <= -2) ||
      (anterior.zScore <= -2 && actual.zScore >= 2)
    ) {
      alertas.push({
        regla: "R_4s",
        nivel: "rechazo",
        tipoError: "aleatorio",
        fechas: [anterior.fecha, actual.fecha],
        mensaje:
          "Dos resultados consecutivos presentan una diferencia de al menos 4 DE.",
      });
    }
  }

  // Regla 4_1s: cuatro resultados consecutivos más allá de 1 DE
  for (let i = 3; i < resultadosCalculados.length; i++) {
    const grupo = resultadosCalculados.slice(i - 3, i + 1);
    const todosPositivos = grupo.every((r) => r.zScore > 1);
    const todosNegativos = grupo.every((r) => r.zScore < -1);

    if (todosPositivos || todosNegativos) {
      alertas.push({
        regla: "4_1s",
        nivel: "rechazo",
        tipoError: "sistematico",
        fechas: grupo.map((r) => r.fecha),
        mensaje:
          "Cuatro resultados consecutivos superan 1 DE en el mismo lado de la media.",
      });
    }
  }

  // Regla 10x: diez resultados consecutivos al mismo lado de la media
  for (let i = 9; i < resultadosCalculados.length; i++) {
    const grupo = resultadosCalculados.slice(i - 9, i + 1);
    const todosPositivos = grupo.every((r) => r.zScore > 0);
    const todosNegativos = grupo.every((r) => r.zScore < 0);

    if (todosPositivos || todosNegativos) {
      alertas.push({
        regla: "10x",
        nivel: "rechazo",
        tipoError: "sistematico",
        fechas: grupo.map((r) => r.fecha),
        mensaje:
          "Diez resultados consecutivos están del mismo lado de la media.",
      });
    }
  }

  // Responder con cálculos y alertas
  res.json({
    prueba: prueba || "Sin especificar",
    media,
    desviacionEstandar,
    limitesControl,
    resultados: resultadosCalculados,
    alertas,
  });
});

// Endpoint para generar la gráfica Levey-Jennings
app.post("/api/levey-jennings/grafica", async (req, res) => {
  try {
    const {
      prueba,
      media,
      desviacionEstandar,
      resultados,
      alertas = [],
    } = req.body;

    // Validar media y desviación estándar
    if (
      typeof media !== "number" ||
      !Number.isFinite(media) ||
      typeof desviacionEstandar !== "number" ||
      !Number.isFinite(desviacionEstandar) ||
      desviacionEstandar <= 0
    ) {
      return res.status(400).json({
        error:
          "La media debe ser numérica y la desviación estándar debe ser mayor que cero.",
      });
    }

    // Validar resultados
    if (
      !Array.isArray(resultados) ||
      resultados.length === 0 ||
      resultados.some(
        (r) =>
          !r ||
          typeof r.fecha !== "string" ||
          Number.isNaN(Date.parse(r.fecha)) ||
          typeof r.valor !== "number" ||
          !Number.isFinite(r.valor),
      )
    ) {
      return res.status(400).json({
        error: "Envía al menos un resultado con fecha válida y valor numérico.",
      });
    }

    // Ordenar resultados por fecha
    const resultadosOrdenados = [...resultados].sort(
      (a, b) => Date.parse(a.fecha) - Date.parse(b.fecha),
    );

    // Generar imagen PNG
    const imagen = await generarGraficaLeveyJennings({
      prueba,
      media,
      desviacionEstandar,
      resultados: resultadosOrdenados,
      alertas,
    });

    // Enviar imagen al cliente
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="grafica-levey-jennings.png"',
    );

    res.send(imagen);
  } catch (error) {
    console.error("Error al generar gráfica:", error);

    res.status(500).json({
      error: "No fue posible generar la gráfica.",
    });
  }
});

// Endpoint para consultar el historial de mediciones con filtros

app.get("/api/control/historial", async (req, res) => {
  try {
    // Obtener filtros enviados desde la URL
    const { prueba, nivelControl, lote, equipo } = req.query;

    // Construir filtros para MongoDB
    const filtros = {};

    if (prueba) {
      filtros.prueba = prueba;
    }

    if (nivelControl) {
      filtros.nivelControl = nivelControl;
    }

    if (lote) {
      filtros.lote = lote;
    }

    if (equipo) {
      filtros.equipo = equipo;
    }

    // Consultar MongoDB aplicando los filtros
    const mediciones = await Medicion.find(filtros).sort({ fecha: 1 });

    res.status(200).json({
      mensaje: "Historial consultado correctamente",
      filtrosAplicados: filtros,
      total: mediciones.length,
      mediciones: mediciones,
    });
  } catch (error) {
    console.error("Error al consultar historial:", error);

    res.status(500).json({
      mensaje: "Error al consultar el historial",
      error: error.message,
    });
  }
});

// Endpoint para registrar parámetros de control

app.post("/api/control/parametros", async (req, res) => {
  try {
    const { prueba, nivelControl, lote, equipo, media, desviacionEstandar } =
      req.body;

    // Validar campos obligatorios
    if (
      !prueba ||
      !nivelControl ||
      !lote ||
      !equipo ||
      media === undefined ||
      desviacionEstandar === undefined
    ) {
      return res.status(400).json({
        mensaje: "Todos los campos son obligatorios",
      });
    }

    // Validar valores numéricos
    if (
      !Number.isFinite(media) ||
      !Number.isFinite(desviacionEstandar) ||
      desviacionEstandar <= 0
    ) {
      return res.status(400).json({
        mensaje:
          "La media debe ser numérica y la desviación estándar debe ser mayor que cero",
      });
    }

    // Crear parámetros
    const nuevoParametro = new ParametroControl({
      prueba,
      nivelControl,
      lote,
      equipo,
      media,
      desviacionEstandar,
    });

    await nuevoParametro.save();

    res.status(201).json({
      mensaje: "Parámetros de control registrados correctamente",
      parametro: nuevoParametro,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        mensaje: "Ya existen parámetros para esta prueba, nivel, lote y equipo",
      });
    }

    console.error("Error al registrar parámetros:", error);

    res.status(500).json({
      mensaje: "Error al registrar los parámetros",
      error: error.message,
    });
  }
});

// Endpoint para consultar parámetros de control con filtros

app.get("/api/control/parametros", async (req, res) => {
  try {
    const { prueba, nivelControl, lote, equipo } = req.query;

    // Construir filtros
    const filtros = {};

    if (prueba) filtros.prueba = prueba;
    if (nivelControl) filtros.nivelControl = nivelControl;
    if (lote) filtros.lote = lote;
    if (equipo) filtros.equipo = equipo;

    // Consultar MongoDB
    const parametros = await ParametroControl.find(filtros);

    res.status(200).json({
      mensaje: "Parámetros consultados correctamente",
      total: parametros.length,
      parametros,
    });
  } catch (error) {
    console.error("Error al consultar parámetros:", error);

    res.status(500).json({
      mensaje: "Error al consultar los parámetros",
      error: error.message,
    });
  }
});

//Endpoint para realizar análisis de control de calidad y aplicar reglas de Westgard

app.get("/api/control/analisis", async (req, res) => {
  try {
    const { prueba, nivelControl, lote, equipo } = req.query;

    // Validar que se reciban todos los filtros
    if (!prueba || !nivelControl || !lote || !equipo) {
      return res.status(400).json({
        mensaje: "Debes proporcionar prueba, nivelControl, lote y equipo",
      });
    }

    // Buscar los parámetros de control
    const parametros = await ParametroControl.findOne({
      prueba,
      nivelControl,
      lote,
      equipo,
    });

    if (!parametros) {
      return res.status(404).json({
        mensaje: "No se encontraron parámetros para esta combinación",
      });
    }

    const { media, desviacionEstandar } = parametros;

    // Recuperar las mediciones correspondientes
    const mediciones = await Medicion.find({
      prueba,
      nivelControl,
      lote,
      equipo,
    }).sort({ fecha: 1 });

    // Calcular el valor Z de cada medición
    const resultados = mediciones.map((medicion) => {
      const valorZ = (medicion.valor - media) / desviacionEstandar;

      return {
        id: medicion._id,
        prueba: medicion.prueba,
        nivelControl: medicion.nivelControl,
        lote: medicion.lote,
        equipo: medicion.equipo,
        fecha: medicion.fecha,
        valor: medicion.valor,
        valorZ: Number(valorZ.toFixed(3)),
      };
    });

    // Ejecutar Grubbs enviando fecha y valor de cada medición
    const analisisGrubbs = pruebaGrubbs(resultados);

    // Evaluación de reglas de Westgard
    const alertas = [];

    for (let i = 0; i < resultados.length; i++) {
      const actual = resultados[i];
      const z = actual.valorZ;

      // Regla 1_2s: advertencia
      if (Math.abs(z) >= 2) {
        alertas.push({
          regla: "1_2s",
          nivel: "advertencia",
          fecha: actual.fecha,
          valor: actual.valor,
          valorZ: z,
          mensaje: "Un resultado supera o alcanza ±2 DE.",
        });
      }

      // Regla 1_3s: rechazo
      if (Math.abs(z) >= 3) {
        alertas.push({
          regla: "1_3s",
          nivel: "rechazo",
          fecha: actual.fecha,
          valor: actual.valor,
          valorZ: z,
          mensaje: "Un resultado supera o alcanza ±3 DE.",
          tipoError: "Posible error aleatorio",
        });
      }

      // Regla 2_2s: dos resultados consecutivos
      if (i >= 1) {
        const anterior = resultados[i - 1];

        if (
          Math.abs(anterior.valorZ) >= 2 &&
          Math.abs(z) >= 2 &&
          Math.sign(anterior.valorZ) === Math.sign(z)
        ) {
          alertas.push({
            regla: "2_2s",
            nivel: "rechazo",
            fecha: actual.fecha,
            mensaje: "Dos resultados consecutivos superan 2 DE del mismo lado.",
            tipoError: "Posible error sistemático",
          });
        }
      }

      // Regla 4_1s: cuatro resultados consecutivos
      if (i >= 3) {
        const ultimosCuatro = resultados.slice(i - 3, i + 1);

        const todosPositivos = ultimosCuatro.every(
          (resultado) => resultado.valorZ > 1,
        );

        const todosNegativos = ultimosCuatro.every(
          (resultado) => resultado.valorZ < -1,
        );

        if (todosPositivos || todosNegativos) {
          alertas.push({
            regla: "4_1s",
            nivel: "rechazo",
            fecha: actual.fecha,
            mensaje:
              "Cuatro resultados consecutivos superan 1 DE del mismo lado.",
            tipoError: "Posible error sistemático",
          });
        }
      }

      // Regla 10x: diez resultados consecutivos del mismo lado
      if (i >= 9) {
        const ultimosDiez = resultados.slice(i - 9, i + 1);

        const todosPositivos = ultimosDiez.every(
          (resultado) => resultado.valorZ > 0,
        );

        const todosNegativos = ultimosDiez.every(
          (resultado) => resultado.valorZ < 0,
        );

        if (todosPositivos || todosNegativos) {
          alertas.push({
            regla: "10x",
            nivel: "rechazo",
            fecha: actual.fecha,
            mensaje:
              "Diez resultados consecutivos están del mismo lado de la media.",
            tipoError: "Posible error sistemático",
          });
        }
      }
    }

    // Calcular límites de control
    const limitesControl = {
      menos3DE: media - 3 * desviacionEstandar,
      menos2DE: media - 2 * desviacionEstandar,
      menos1DE: media - desviacionEstandar,
      media: media,
      mas1DE: media + desviacionEstandar,
      mas2DE: media + 2 * desviacionEstandar,
      mas3DE: media + 3 * desviacionEstandar,
    };

    res.status(200).json({
      mensaje: "Análisis realizado correctamente",

      parametros: {
        prueba,
        nivelControl,
        lote,
        equipo,
        media,
        desviacionEstandar,
      },

      limitesControl,
      totalMediciones: resultados.length,
      resultados,
      analisisGrubbs,
      totalAlertas: alertas.length,
      alertas,
    });
  } catch (error) {
    console.error("Error al realizar el análisis:", error);

    res.status(500).json({
      mensaje: "Error al realizar el análisis",
      error: error.message,
    });
  }
});

// Endpoint para generar la gráfica Levey-Jennings desde parámetros guardados en MongoDB

app.get("/api/control/grafica", async (req, res) => {
  try {
    const { prueba, nivelControl, lote, equipo } = req.query;

    // Validar parámetros obligatorios
    if (!prueba || !nivelControl || !lote || !equipo) {
      return res.status(400).json({
        mensaje: "Debes proporcionar prueba, nivelControl, lote y equipo.",
      });
    }

    // Buscar los parámetros de control
    const parametro = await ParametroControl.findOne({
      prueba,
      nivelControl,
      lote,
      equipo,
    });

    if (!parametro) {
      return res.status(404).json({
        mensaje: "No se encontraron los parámetros de control.",
      });
    }

    const { media, desviacionEstandar } = parametro;

    // Consultar mediciones en MongoDB
    const mediciones = await Medicion.find({
      prueba,
      nivelControl,
      lote,
      equipo,
    }).sort({ fecha: 1 });

    if (mediciones.length === 0) {
      return res.status(404).json({
        mensaje: "No existen mediciones para generar la gráfica.",
      });
    }

    // Preparar datos para la gráfica
    const datosGrafica = {
      prueba,
      media,
      desviacionEstandar,
      resultados: mediciones.map((medicion) => ({
        fecha: medicion.fecha,
        valor: medicion.valor,
      })),
    };

    // Generar imagen PNG
    const imagen = await generarGraficaLeveyJennings(datosGrafica);

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="levey-jennings.png"',
    );

    return res.send(imagen);
  } catch (error) {
    console.error("Error al generar gráfica:", error);

    return res.status(500).json({
      mensaje: "Error al generar la gráfica Levey-Jennings.",
    });
  }
});

const iniciarServidor = async () => {
  await conectarDB();

  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
};

iniciarServidor();
