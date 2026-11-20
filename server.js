const express = require("express");
const app = express();
app.use(express.json());
app.use(express.static("public"));

const { generarGraficaLeveyJennings } = require("./utils/grafica");
const { pruebaGrubbs } = require("./utils/grubbs");

const { generarFirmaConjunto } = require("./utils/firmaConjunto");

const Medicion = require("./models/medicion");
const ParametroControl = require("./models/parametroControl");
const { calcularEstadisticas } = require("./utils/estadisticas");
const Analisis = require("./models/analisis");
const CorridaControl = require("./models/corridaControl");

const mongoose = require("mongoose");

require("dotenv").config();

const conectarDB = require("./config/database");

const PORT = 3000;


/**
 * ==========================================
 * REGISTRO DE CORRIDAS DE CONTROL
 * ==========================================
 */

app.post("/api/control/registrar-corrida", async (req, res) => {
      let session = null;
  try {
    // Obtener los datos enviados desde la web
    const {
      prueba,
      lote,
      equipo,
      fechaCorrida,
      numeroNiveles,
      medicionesPorNivel,
      N,
      mediciones
    } = req.body || {};


    // ==========================================
    // VALIDAR DATOS GENERALES DE LA CORRIDA
    // ==========================================

    // Validar prueba, lote y equipo
    if (
      typeof prueba !== "string" ||
      !prueba.trim() ||
      typeof lote !== "string" ||
      !lote.trim() ||
      typeof equipo !== "string" ||
      !equipo.trim()
    ) {
      return res.status(400).json({
        mensaje: "Debes proporcionar prueba, lote y equipo."
      });
    }

    // Validar fecha de la corrida
    const fechaValida =
      typeof fechaCorrida === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(fechaCorrida) &&
      !Number.isNaN(
        Date.parse(`${fechaCorrida}T12:00:00.000Z`)
      ) &&
      new Date(`${fechaCorrida}T12:00:00.000Z`)
        .toISOString()
        .slice(0, 10) === fechaCorrida;

    if (!fechaValida) {
      return res.status(400).json({
        mensaje: "La fecha de la corrida no es válida."
      });
    }

    // Validar cantidad de niveles
    if (![2, 3].includes(numeroNiveles)) {
      return res.status(400).json({
        mensaje: "La corrida debe tener 2 o 3 niveles de control."
      });
    }

    // Validar mediciones por nivel
    if (![1, 2].includes(medicionesPorNivel)) {
      return res.status(400).json({
        mensaje: "Debe existir 1 o 2 mediciones por nivel."
      });
    }

    // Calcular N automáticamente
    const nCalculado = numeroNiveles * medicionesPorNivel;

    if (N !== nCalculado) {
      return res.status(400).json({
        mensaje: `El valor de N debe ser ${nCalculado}.`
      });
    }


    // ==========================================
    // VALIDAR MEDICIONES DE CADA NIVEL
    // ==========================================

    // Comprobar que recibimos exactamente N mediciones
    if (!Array.isArray(mediciones) || mediciones.length !== N) {
      return res.status(400).json({
        mensaje: `Debes enviar exactamente ${N} mediciones.`
      });
    }

    const nivelesEncontrados = new Map();

    for (let i = 0; i < mediciones.length; i++) {
      const medicion = mediciones[i];

      if (!medicion || typeof medicion !== "object") {
        return res.status(400).json({
          mensaje: `La medición ${i + 1} no es válida.`
        });
      }

      const {
        nivelControl,
        tipoNivel,
        numeroMedicion,
        fecha,
        valor
      } = medicion;

      // Validar el nombre del nivel
      const numeroNivel = Number(
        typeof nivelControl === "string"
          ? /^Nivel ([1-3])$/.exec(nivelControl)?.[1]
          : NaN
      );

      if (
        !Number.isInteger(numeroNivel) ||
        numeroNivel > numeroNiveles
      ) {
        return res.status(400).json({
          mensaje: `Nivel de control inválido en la medición ${i + 1}.`
        });
      }

      // Validar el tipo de nivel
      if (!["bajo", "normal", "alto"].includes(tipoNivel)) {
        return res.status(400).json({
          mensaje: `Tipo de nivel inválido en la medición ${i + 1}.`
        });
      }

      // Validar el número de medición
      if (
        !Number.isInteger(numeroMedicion) ||
        numeroMedicion < 1 ||
        numeroMedicion > medicionesPorNivel
      ) {
        return res.status(400).json({
          mensaje: `Número de medición inválido en la posición ${i + 1}.`
        });
      }

      // Validar el resultado numérico
      if (typeof valor !== "number" || !Number.isFinite(valor)) {
        return res.status(400).json({
          mensaje: `Resultado inválido en la medición ${i + 1}.`
        });
      }

      // Validar que la fecha coincida con la corrida
      if (fecha !== fechaCorrida) {
        return res.status(400).json({
          mensaje: `La fecha de la medición ${i + 1} no coincide con la corrida.`
        });
      }

      // Agrupar las mediciones por nivel
      if (!nivelesEncontrados.has(nivelControl)) {
        nivelesEncontrados.set(nivelControl, {
          tipo: tipoNivel,
          numeros: new Set()
        });
      }

      const nivel = nivelesEncontrados.get(nivelControl);

      // Un mismo nivel debe conservar su tipo
      if (nivel.tipo !== tipoNivel) {
        return res.status(400).json({
          mensaje: `El nivel ${nivelControl} tiene tipos diferentes.`
        });
      }

      // No permitir dos mediciones con el mismo número
      if (nivel.numeros.has(numeroMedicion)) {
        return res.status(400).json({
          mensaje: `La medición ${numeroMedicion} está duplicada en ${nivelControl}.`
        });
      }

      nivel.numeros.add(numeroMedicion);
    }

    // Comprobar que están presentes todos los niveles
    if (nivelesEncontrados.size !== numeroNiveles) {
      return res.status(400).json({
        mensaje: `Debes proporcionar los ${numeroNiveles} niveles configurados.`
      });
    }

    // Comprobar que cada nivel tenga todas sus mediciones
    for (let numero = 1; numero <= numeroNiveles; numero++) {
      const nombreNivel = `Nivel ${numero}`;
      const nivel = nivelesEncontrados.get(nombreNivel);

      if (
        !nivel ||
        nivel.numeros.size !== medicionesPorNivel
      ) {
        return res.status(400).json({
          mensaje: `${nombreNivel} debe contener ${medicionesPorNivel} mediciones.`
        });
      }
    }



   
    // ==========================================
    // GUARDAR CORRIDA Y MEDICIONES EN MONGODB
    // ==========================================

    // Preparar los niveles configurados
    const niveles = [];

    for (let numero = 1; numero <= numeroNiveles; numero++) {
      const nombre = `Nivel ${numero}`;

      niveles.push({
        nombre,
        tipo: nivelesEncontrados.get(nombre).tipo
      });
    }

    // Generar el identificador de la corrida
    const corridaId = new mongoose.Types.ObjectId();

    // Preparar los documentos de las mediciones
    const nuevasMediciones = mediciones.map((medicion) => ({
      prueba: prueba.trim(),
      lote: lote.trim(),
      equipo: equipo.trim(),
      nivelControl: medicion.nivelControl,
      valor: medicion.valor,
      fecha: new Date(`${medicion.fecha}T12:00:00.000Z`),
      corridaId,
      tipoMedicion: "inicial",
      estado: "valida"
    }));

    // Iniciar sesión y transacción
    session = await mongoose.startSession();
    session.startTransaction();

    // Guardar los datos generales de la corrida
    const [nuevaCorrida] = await CorridaControl.create(
      [{
        _id: corridaId,
        prueba: prueba.trim(),
        lote: lote.trim(),
        equipo: equipo.trim(),
        fechaCorrida: new Date(`${fechaCorrida}T12:00:00.000Z`),
        niveles,
        medicionesPorNivel,
        N,
        estado: "registrada"
      }],
      { session }
    );

    // Guardar las mediciones relacionadas
    const medicionesGuardadas = await Medicion.insertMany(
      nuevasMediciones,
      { session }
    );

    // Confirmar la transacción
    await confirmarTransaccion(session);

    return res.status(201).json({
      mensaje: "Corrida de control registrada correctamente.",
      corridaId: nuevaCorrida._id,
      prueba: nuevaCorrida.prueba,
      numeroNiveles,
      medicionesPorNivel,
      N,
      totalMedicionesGuardadas: medicionesGuardadas.length,
      estado: nuevaCorrida.estado
    });

 
  } catch (error) {
    console.error("Error al registrar la corrida:", error);

    if (session && session.inTransaction()) {
      await session.abortTransaction().catch(console.error);
    }

    return res.status(500).json({
      mensaje: "Error al procesar la corrida de control.",
      error: error.message
    });

  } finally {
    if (session) {
      if (session.inTransaction()) {
        await session.abortTransaction().catch(console.error);
      }

      await session.endSession();
    }
  }
});

// Endpoint para consultar las mediciones de un nivel específico de una corrida


/**
 * ==========================================
 * CONSULTAR MEDICIONES POR NIVEL DE CONTROL
 * ==========================================
 */

app.get("/api/control/mediciones-por-nivel", async (req, res) => {
  try {
    const { prueba, nivelControl, lote, equipo } = req.query;

    // ==========================================
    // 1. VALIDAR PARÁMETROS OBLIGATORIOS
    // ==========================================

    if (
      typeof prueba !== "string" ||
      !prueba.trim() ||
      typeof nivelControl !== "string" ||
      !nivelControl.trim() ||
      typeof lote !== "string" ||
      !lote.trim() ||
      typeof equipo !== "string" ||
      !equipo.trim()
    ) {
      return res.status(400).json({
        mensaje: "Debes proporcionar prueba, nivelControl, lote y equipo."
      });
    }

    // Limpiar espacios y saltos de línea
    const pruebaLimpia = prueba.trim();
    const nivelLimpio = nivelControl.trim();
    const loteLimpio = lote.trim();
    const equipoLimpio = equipo.trim();

    // ==========================================
    // 2. CONSULTAR MEDICIONES EN MONGODB
    // ==========================================

    // Buscar mediciones válidas que pertenezcan
    // a una corrida y no tengan análisis asignado

    const mediciones = await Medicion.find({
      prueba: pruebaLimpia,
      nivelControl: nivelLimpio,
      lote: loteLimpio,
      equipo: equipoLimpio,
      estado: "valida",
      corridaId: { $ne: null },
      analisisId: null
    })
      .sort({ fecha: 1, _id: 1 })
      .lean();

    // ==========================================
    // 3. CALCULAR PROGRESO PARA GRUBBS
    // ==========================================

    const totalMediciones = mediciones.length;
    const medicionesRequeridas = 20;

    const medicionesFaltantes = Math.max(
      0,
      medicionesRequeridas - totalMediciones
    );

    const conjuntoCompleto =
      totalMediciones >= medicionesRequeridas;

    // ==========================================
    // 4. PREPARAR CONJUNTO DE 20 MEDICIONES
    // ==========================================

    // Seleccionar únicamente las primeras 20
    const medicionesParaGrubbs = mediciones.slice(
      0,
      medicionesRequeridas
    );

    // Verificar si tenemos 20 mediciones
    const listoParaGrubbs =
      medicionesParaGrubbs.length === medicionesRequeridas;

    // Preparar los datos para la prueba de Grubbs
    const datosParaGrubbs = medicionesParaGrubbs.map(
      (medicion) => ({
        id: medicion._id,
        fecha: medicion.fecha,
        valor: medicion.valor
      })
    );

    // ==========================================
    // 5. CONTROL DE EJECUCIÓN DE GRUBBS
    // ==========================================

    let estadoGrubbs = "incompleto";
    let mensajeGrubbs = "";

    if (listoParaGrubbs) {
      estadoGrubbs = "listo";

      mensajeGrubbs =
        "Se completaron las 20 mediciones. " +
        "El conjunto está listo para ejecutar Grubbs.";

    } else {
      estadoGrubbs = "incompleto";

      mensajeGrubbs =
        `Faltan ${medicionesFaltantes} mediciones ` +
        "para completar el conjunto de Grubbs.";
    }

    // ==========================================
    // 6. DEVOLVER RESULTADOS
    // ==========================================

    return res.status(200).json({
      mensaje: "Mediciones consultadas correctamente.",

      prueba: pruebaLimpia,
      nivelControl: nivelLimpio,
      lote: loteLimpio,
      equipo: equipoLimpio,

      totalMediciones,

      progresoGrubbs: {
        medicionesRequeridas,
        medicionesAcumuladas: totalMediciones,
        medicionesFaltantes,
        conjuntoCompleto,
        listoParaGrubbs,
        totalSeleccionadas: medicionesParaGrubbs.length
      },

      datosParaGrubbs,

      controlGrubbs: {
        estado: estadoGrubbs,
        mensaje: mensajeGrubbs
      },

      mediciones
    });

  } catch (error) {
    console.error(
      "Error al consultar mediciones por nivel:",
      error
    );

    return res.status(500).json({
      mensaje: "Error al consultar las mediciones.",
      error: error.message
    });
  }
});


// Endpoint para registrar una medición individual


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

// Enpoint para iniciar un nuevo registro de analito sin necesidad de enviar las 20 mediciones
app.post("/api/control/iniciar-analito", async (req, res) => {
  try {
    const { prueba, nivelControl, lote, equipo, fecha, valor } = req.body || {};

    // Validar los datos de identificación
    const campos = [prueba, nivelControl, lote, equipo];

    if (campos.some((campo) => typeof campo !== "string" || !campo.trim())) {
      return res.status(400).json({
        mensaje: "Debes proporcionar prueba, nivelControl, lote y equipo.",
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

    const identificacion = {
      prueba: prueba.trim(),
      nivelControl: nivelControl.trim(),
      lote: lote.trim(),
      equipo: equipo.trim(),
    };

    // Evitar iniciar otro análisis inicial activo
    // para la misma combinación.
    const analisisExistente = await Analisis.findOne({
      ...identificacion,
      estado: {
        $in: ["en_recopilacion", "pendiente_revision", "requiere_reemplazo"],
      },
    });

    if (analisisExistente) {
      return res.status(409).json({
        mensaje: "Ya existe un análisis inicial activo para este control.",
        analisisId: analisisExistente._id,
      });
    }

    // Crear un identificador para relacionar ambos registros
    const analisisId = new mongoose.Types.ObjectId();

    // Crear el análisis inicial
    const analisis = await Analisis.create({
      _id: analisisId,
      ...identificacion,
      estado: "en_recopilacion",
      medicionesRequeridas: 20,
      totalMedicionesValidas: 1,
      totalMediciones: 1,
      mediciones: [
        {
          fecha: new Date(`${fecha}T12:00:00.000Z`),
          valor,
        },
      ],
    });

    try {
      // Guardar la primera medición
      const medicion = await Medicion.create({
        ...identificacion,
        fecha: new Date(`${fecha}T12:00:00.000Z`),
        valor,
        tipoMedicion: "inicial",
        analisisId: analisis._id,
        estado: "valida",
      });

      return res.status(201).json({
        mensaje: "Analito iniciado y primera medición registrada.",
        analisisId: analisis._id,
        analisis,
        medicion,
        progreso: {
          registradas: 1,
          requeridas: 20,
          faltantes: 19,
        },
      });
    } catch (errorMedicion) {
      // Evitar dejar un análisis sin su primera medición
      await Analisis.findByIdAndDelete(analisis._id);
      throw errorMedicion;
    }
  } catch (error) {
    console.error("Error al iniciar analito:", error);

    return res.status(500).json({
      mensaje: "Error al iniciar el registro del analito.",
      error: error.message,
    });
  }
});

/**
 * Agregar una medición inicial diaria
 * a un análisis existente.
 */
app.post("/api/control/registrar-diario/:analisisId", async (req, res) => {
  try {
    const { analisisId } = req.params;
    const { fecha, valor } = req.body || {};

    // Validar ID
    if (!mongoose.Types.ObjectId.isValid(analisisId)) {
      return res.status(400).json({
        mensaje: "El ID del análisis no es válido.",
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

    // Buscar análisis
    const analisis = await Analisis.findById(analisisId);

    if (!analisis) {
      return res.status(404).json({
        mensaje: "No se encontró el análisis.",
      });
    }

    if (analisis.estado !== "en_recopilacion") {
      return res.status(409).json({
        mensaje: "El análisis no está en etapa de recopilación.",
      });
    }

    // Consultar mediciones iniciales relacionadas
    const mediciones = await Medicion.find({
      analisisId: analisis._id,
      tipoMedicion: "inicial",
    });

    const requeridas = analisis.medicionesRequeridas || 20;

    if (mediciones.length >= requeridas) {
      return res.status(409).json({
        mensaje:
          "Ya se registraron las 20 mediciones iniciales. Corresponde realizar la evaluación de Grubbs.",
      });
    }

    const fechaMedicion = new Date(`${fecha}T12:00:00.000Z`);


    // Iniciar una sesión de MongoDB
    session = await mongoose.startSession();

    // Iniciar una transacción para proteger el reemplazo
    session.startTransaction();


    // Consultar nuevamente el análisis dentro de la transacción
    const analisisEnTransaccion = await Analisis.findById(
      analisisId
    ).session(session);

    if (!analisisEnTransaccion) {
      throw new Error(
        "El análisis ya no existe al iniciar la transacción."
      );
    }

    // Utilizar el documento consultado dentro de la transacción
analisis = analisisEnTransaccion;


    // Comprobar nuevamente el estado del análisis
    // dentro de la transacción
    if (analisis.estado !== "requiere_reemplazo") {
      await session.abortTransaction();

      return res.status(409).json({
        mensaje:
          "El análisis ya no está esperando mediciones de reemplazo.",
        estadoActual: analisis.estado
      });
    }




    // Registrar nueva medición


    // Registrar la medición dentro de la transacción
    const [nuevaMedicion] = await Medicion.create(
      [
        {
          // Identificación del analito
          prueba: analisis.prueba,
          nivelControl: analisis.nivelControl,
          lote: analisis.lote,
          equipo: analisis.equipo,

          // Datos de la medición
          fecha: new Date(`${fecha}T12:00:00.000Z`),
          valor,

          // Pertenece al conjunto inicial
          tipoMedicion: "inicial",

          // Relación con el análisis
          analisisId: analisis._id,

          // Pendiente de evaluación mediante Grubbs
          estado: "pendiente_revision",
        },
      ],
      { session }
    );


    // Actualizar el análisis
    analisis.mediciones.push({
      fecha: fechaMedicion,
      valor,
    });

    analisis.totalMediciones = mediciones.length + 1;
    analisis.totalMedicionesValidas = mediciones.length + 1;

    // Cuando se completen las 20 mediciones,
    // ejecutar automáticamente la prueba de Grubbs.
    if (analisis.totalMediciones === requeridas) {
      // Consultar las 20 mediciones iniciales
      const medicionesIniciales = await Medicion.find({
        analisisId: analisis._id,
        tipoMedicion: "inicial",
      }).sort({ fecha: 1, _id: 1 });

      // Ejecutar Grubbs con fecha y valor
      const resultadoGrubbs = pruebaGrubbs(
        medicionesIniciales.map((medicion) => ({
          fecha: medicion.fecha,
          valor: medicion.valor,
        })),
      );

      // Guardar el resultado de Grubbs
      analisis.analisisGrubbs = resultadoGrubbs;

      if (resultadoGrubbs.esAtipico === true) {
        // Identificar el documento sospechoso
        const medicionSospechosa =
          medicionesIniciales[resultadoGrubbs.indiceSospechoso];

        if (!medicionSospechosa) {
          throw new Error("No se pudo identificar la medición sospechosa.");
        }

        // Marcar la medición para investigación
        medicionSospechosa.estado = "pendiente_revision";
        await medicionSospechosa.save();

        // Contar las mediciones que siguen aceptadas provisionalmente
        const totalValidas = await Medicion.countDocuments({
          analisisId: analisis._id,
          tipoMedicion: "inicial",
          estado: "valida",
        });

        // El análisis requiere revisar el valor sospechoso
        analisis.estado = "pendiente_revision";
        analisis.totalMedicionesValidas = totalValidas;
      } else if (resultadoGrubbs.hayEmpate === true) {
        // El resultado requiere revisión antes de finalizar
       analisis.estado = "requiere_revision_empate";
      } else {
        // Calcular las estadísticas del conjunto inicial
        const valores = medicionesIniciales.map((medicion) => medicion.valor);

        const estadisticas = calcularEstadisticas(valores);

        analisis.media = estadisticas.media;
        analisis.desviacionEstandar = estadisticas.desviacionEstandar;
        analisis.coeficienteVariacion = estadisticas.coeficienteVariacion;

        analisis.estado = "completo";
      }
    }

    await analisis.save();

    return res.status(201).json({
      mensaje: "Medición diaria registrada correctamente.",
      analisisId: analisis._id,
      medicion: nuevaMedicion,
      progreso: {
        registradas: mediciones.length + 1,
        requeridas,
        faltantes: requeridas - (mediciones.length + 1),
      },
    });
  } catch (error) {
    console.error("Error al registrar medición diaria:", error);

    return res.status(500).json({
      mensaje: "Error al registrar la medición diaria.",
      error: error.message,
    });
  }
});

/**
 * Consultar el progreso de un análisis diario.
 */
app.get("/api/control/progreso-diario/:analisisId", async (req, res) => {
  try {
    const { analisisId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(analisisId)) {
      return res.status(400).json({
        mensaje: "El ID del análisis no es válido.",
      });
    }

    const analisis = await Analisis.findById(analisisId);

    if (!analisis) {
      return res.status(404).json({
        mensaje: "No se encontró el análisis.",
      });
    }

    const mediciones = await Medicion.find({
      analisisId: analisis._id,
      tipoMedicion: "inicial",
    }).sort({ fecha: 1, _id: 1 });

    const requeridas = analisis.medicionesRequeridas || 20;

    const validas = mediciones.filter(
      (medicion) => medicion.estado === "valida",
    ).length;

    const pendientes = mediciones.filter(
      (medicion) => medicion.estado === "pendiente_revision",
    ).length;

    const excluidas = mediciones.filter(
      (medicion) => medicion.estado === "excluida",
    ).length;

    return res.status(200).json({
      mensaje: "Progreso consultado correctamente.",
      analisisId: analisis._id,
      prueba: analisis.prueba,
      nivelControl: analisis.nivelControl,
      lote: analisis.lote,
      equipo: analisis.equipo,
      estado: analisis.estado,

      progreso: {
        registradas: mediciones.length,
        validas,
        pendientesRevision: pendientes,
        excluidas,
        requeridas,
        faltantes: Math.max(0, requeridas - validas),
      },

      estadisticas: {
        media: analisis.media,
        desviacionEstandar: analisis.desviacionEstandar,
        coeficienteVariacion: analisis.coeficienteVariacion,
      },

      analisisGrubbs: analisis.analisisGrubbs,

      mediciones: mediciones.map((medicion) => ({
        id: medicion._id,
        fecha: medicion.fecha,
        valor: medicion.valor,
        estado: medicion.estado,
      })),
    });
  } catch (error) {
    console.error("Error al consultar progreso:", error);

    return res.status(500).json({
      mensaje: "Error al consultar el progreso del análisis.",
      error: error.message,
    });
  }
});


app.post("/api/control/registrar-lote", async (req, res) => {
  let session = null;

  try {
    const {
      prueba,
      nivelControl,
      lote,
      equipo,
      mediciones
    } = req.body || {};

    // 1. Validar identificación del control
    const identificacion = {
      prueba,
      nivelControl,
      lote,
      equipo
    };

    if (
      Object.values(identificacion).some(
        campo => typeof campo !== "string" || !campo.trim()
      )
    ) {
      return res.status(400).json({
        mensaje:
          "Debes proporcionar prueba, nivelControl, lote y equipo."
      });
    }

    // 2. Validar exactamente 20 mediciones
    if (!Array.isArray(mediciones) || mediciones.length !== 20) {
      return res.status(400).json({
        mensaje: "Debes enviar exactamente 20 mediciones."
      });
    }

    const fechas = new Set();

    for (let i = 0; i < mediciones.length; i++) {
      const { fecha, valor } = mediciones[i] || {};

      const fechaValida =
        typeof fecha === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
        Number.isFinite(Date.parse(fecha)) &&
        new Date(`${fecha}T12:00:00.000Z`)
          .toISOString()
          .slice(0, 10) === fecha;

      if (
        !fechaValida ||
        typeof valor !== "number" ||
        !Number.isFinite(valor)
      ) {
        return res.status(400).json({
          mensaje: `La medición ${i + 1} contiene datos inválidos.`
        });
      }

      if (fechas.has(fecha)) {
        return res.status(400).json({
          mensaje: `La fecha ${fecha} está duplicada.`
        });
      }

      fechas.add(fecha);
    }

    // 3. Normalizar identificación
    for (const campo of Object.keys(identificacion)) {
      identificacion[campo] = identificacion[campo].trim();
    }

    // 4. Ordenar cronológicamente
    const medicionesOrdenadas = [...mediciones].sort(
      (a, b) => a.fecha.localeCompare(b.fecha)
    );

    const datosGrubbs = medicionesOrdenadas.map(m => ({
      fecha: new Date(`${m.fecha}T12:00:00.000Z`),
      valor: m.valor
    }));

    // 5. Ejecutar Grubbs
    const resultadoGrubbs = pruebaGrubbs(datosGrubbs);

    if (resultadoGrubbs.error) {
      return res.status(422).json({
        mensaje: "No fue posible calcular Grubbs.",
        error: resultadoGrubbs.error
      });
    }

    const hayAtipico = resultadoGrubbs.esAtipico === true;
    const hayEmpate = resultadoGrubbs.hayEmpate === true;

    if (
      hayAtipico &&
      (
        !Number.isInteger(resultadoGrubbs.indiceSospechoso) ||
        resultadoGrubbs.indiceSospechoso < 0 ||
        resultadoGrubbs.indiceSospechoso >= 20
      )
    ) {
      return res.status(422).json({
        mensaje:
          "Grubbs detectó un atípico, pero no identificó su posición."
      });
    }

    // Un empate ambiguo debe resolverse antes de registrar
    // el lote para evitar una revisión sin medición identificada.
    if (hayEmpate) {
      return res.status(422).json({
        mensaje:
          "Grubbs detectó un empate que requiere revisión.",
        analisisGrubbs: resultadoGrubbs
      });
    }

    // 6. Preparar mediciones
    const analisisId = new mongoose.Types.ObjectId();

    const nuevasMediciones = datosGrubbs.map((m, indice) => ({
      ...identificacion,
      analisisId,
      tipoMedicion: "inicial",
      fecha: m.fecha,
      valor: m.valor,
      estado:
        hayAtipico &&
        indice === resultadoGrubbs.indiceSospechoso
          ? "pendiente_revision"
          : "valida"
    }));

    const totalValidas = nuevasMediciones.filter(
      m => m.estado === "valida"
    ).length;

    // 7. Solo calcular estadísticas definitivas
    // cuando no existan mediciones pendientes.
    const estadisticas = hayAtipico
      ? null
      : calcularEstadisticas(
          nuevasMediciones.map(m => m.valor)
        );

    const estado = hayAtipico
      ? "pendiente_revision"
      : "completo";

    // 8. Guardar análisis y mediciones en una transacción
    session = await mongoose.startSession();
    session.startTransaction();


const analisisActivo = await Analisis.findOne({
    ...identificacion,
    estado: {
        $in: [
            "en_recopilacion",
            "pendiente_revision",
            "requiere_reemplazo",
            "requiere_revision_empate"
        ]
    }
}).session(session);


    if (analisisActivo) {
      await session.abortTransaction();

      return res.status(409).json({
        mensaje:
          "Ya existe un análisis inicial activo para este control.",
        analisisId: analisisActivo._id
      });
    }

    const resultadoMediciones = await Medicion.insertMany(
      nuevasMediciones,
      { session }
    );

    const [nuevoAnalisis] = await Analisis.create(
      [{
        _id: analisisId,
        ...identificacion,

        media: estadisticas?.media ?? null,
        desviacionEstandar:
          estadisticas?.desviacionEstandar ?? null,
        coeficienteVariacion:
          estadisticas?.coeficienteVariacion ?? null,

        totalMediciones: 20,
        medicionesRequeridas: 20,
        totalMedicionesValidas: totalValidas,

        analisisGrubbs: resultadoGrubbs,
        estado,

        mediciones: hayAtipico
          ? []
          : resultadoMediciones.map(m => ({
              fecha: m.fecha,
              valor: m.valor
            }))
      }],
      { session }
    );

    await confirmarTransaccion(session);

    const medicionSospechosa = hayAtipico
      ? resultadoMediciones[resultadoGrubbs.indiceSospechoso]
      : null;

    return res.status(201).json({
      mensaje:
        "Las 20 mediciones se registraron y analizaron correctamente.",

      analisisId: nuevoAnalisis._id,
      prueba: nuevoAnalisis.prueba,
      estado: nuevoAnalisis.estado,

      resumen: {
        totalRegistradas: 20,
        totalValidas,
        totalPendientes: hayAtipico ? 1 : 0,
        totalExcluidas: 0,
        medicionesRequeridas: 20
      },

      analisisGrubbs: resultadoGrubbs,

      medicionSospechosa: medicionSospechosa
        ? {
            id: medicionSospechosa._id,
            fecha: medicionSospechosa.fecha,
            valor: medicionSospechosa.valor,
            estado: medicionSospechosa.estado
          }
        : null
    });

  } catch (error) {
    console.error("Error al registrar lote:", error);

    const confirmacionDesconocida =
      typeof error.hasErrorLabel === "function" &&
      error.hasErrorLabel("UnknownTransactionCommitResult");

    if (
      !confirmacionDesconocida &&
      session?.inTransaction()
    ) {
      try {
        await session.abortTransaction();
      } catch (errorAbort) {
        console.error("Error al revertir:", errorAbort);
      }
    }

    if (confirmacionDesconocida) {
      return res.status(503).json({
        mensaje:
          "No se pudo confirmar si el lote quedó registrado.",
        accion:
          "Consulta MongoDB antes de repetir la petición."
      });
    }

    return res.status(500).json({
      mensaje: "Error al registrar las mediciones.",
      error: error.message
    });

  } finally {
    if (session) {
      await session.endSession();
    }
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
    let analisis = await Analisis.findById(analisisId);

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


app.post("/api/control/finalizar-analisis/:analisisId", async (req, res) => {
  let session = null;

  try {
    const { analisisId } = req.params;

    if (!mongoose.isValidObjectId(analisisId)) {
      return res.status(400).json({
        mensaje: "El ID del análisis no es válido."
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const analisis = await Analisis.findById(analisisId)
      .session(session);

    if (!analisis) {
      await session.abortTransaction();
      return res.status(404).json({
        mensaje: "No se encontró el análisis."
      });
    }

    if (analisis.estado !== "pendiente_revision") {
      await session.abortTransaction();
      return res.status(409).json({
        mensaje: "El análisis no está pendiente de revisión."
      });
    }

    const mediciones = await Medicion.find({
      analisisId: analisis._id,
      tipoMedicion: "inicial"
    })
      .sort({ fecha: 1, _id: 1 })
      .session(session);

    const validas = mediciones.filter(
      m => m.estado === "valida"
    );

    const pendientes = mediciones.filter(
      m => m.estado === "pendiente_revision"
    );

    const excluidas = mediciones.filter(
      m => m.estado === "excluida"
    );

    const requeridas = analisis.medicionesRequeridas || 20;

    // Recuperación controlada: exactamente una pendiente
    // y 19 mediciones válidas.
    if (
      pendientes.length !== 1 ||
      validas.length !== requeridas - 1 ||
      excluidas.length < 1
    ) {
      await session.abortTransaction();

      return res.status(409).json({
        mensaje: "El análisis no cumple las condiciones de recuperación.",
        totalValidas: validas.length,
        totalPendientes: pendientes.length,
        totalExcluidas: excluidas.length
      });
    }

    const pendiente = pendientes[0];

    // Este procedimiento solo se aplica al reemplazo
    // específico que quedó pendiente por el error anterior.
    if (
      String(pendiente._id) !==
      "6afc8a8b6261f25db769a089"
    ) {
      await session.abortTransaction();

      return res.status(409).json({
        mensaje: "La medición pendiente no corresponde al reemplazo esperado."
      });
    }

    const candidatas = mediciones.filter(
      m => m.estado !== "excluida"
    );

    if (candidatas.length !== requeridas) {
      await session.abortTransaction();

      return res.status(409).json({
        mensaje: "No existen exactamente 20 mediciones candidatas."
      });
    }

    const resultadoGrubbs = pruebaGrubbs(
      candidatas.map(m => ({
        fecha: m.fecha,
        valor: m.valor
      }))
    );

    if (
      !resultadoGrubbs ||
      resultadoGrubbs.error ||
      resultadoGrubbs.hayEmpate ||
      resultadoGrubbs.esAtipico
    ) {
      await session.abortTransaction();

      return res.status(422).json({
        mensaje: "Grubbs no permite finalizar automáticamente este análisis.",
        resultadoGrubbs
      });
    }

    // Proteger la recuperación frente a escrituras simultáneas
    const bloqueo = await Analisis.updateOne(
      {
        _id: analisis._id,
        estado: "pendiente_revision",
        versionReemplazos: analisis.versionReemplazos
      },
      {
        $inc: { versionReemplazos: 1 }
      },
      { session }
    );

    if (bloqueo.modifiedCount !== 1) {
      throw new Error("No se pudo bloquear el análisis.");
    }

    // Confirmar la medición de reemplazo
    pendiente.estado = "valida";
    await pendiente.save({ session });

    const estadisticas = calcularEstadisticas(
      candidatas.map(m => m.valor)
    );

    analisis.media = estadisticas.media;
    analisis.desviacionEstandar =
      estadisticas.desviacionEstandar;
    analisis.coeficienteVariacion =
      estadisticas.coeficienteVariacion;

    analisis.mediciones = candidatas.map(m => ({
      fecha: m.fecha,
      valor: m.valor
    }));

    analisis.analisisGrubbs = resultadoGrubbs;
    analisis.totalMediciones = requeridas;
    analisis.totalMedicionesValidas = requeridas;
    analisis.estado = "completo";
    analisis.versionReemplazos += 1;

    await analisis.save({ session });

    await confirmarTransaccion(session);

    return res.status(200).json({
      mensaje: "Análisis recuperado y finalizado correctamente.",
      analisisId: analisis._id,
      estado: analisis.estado,
      estadisticas: {
        media: analisis.media,
        desviacionEstandar: analisis.desviacionEstandar,
        coeficienteVariacion: analisis.coeficienteVariacion
      },
      analisisGrubbs: resultadoGrubbs,
      resumen: {
        totalRegistradas: mediciones.length,
        totalValidas: requeridas,
        totalExcluidas: excluidas.length,
        totalPendientes: 0
      }
    });

  } catch (error) {
    console.error("Error al finalizar análisis:", error);

    if (session && session.inTransaction()) {
      await session.abortTransaction().catch(console.error);
    }

    const conflicto =
      error.code === 112 ||
      error.codeName === "WriteConflict" ||
      (typeof error.hasErrorLabel === "function" &&
        error.hasErrorLabel("TransientTransactionError"));

    if (conflicto) {
      return res.status(409).json({
        mensaje: "El análisis fue modificado simultáneamente. Consulta su estado."
      });
    }

    if (
      typeof error.hasErrorLabel === "function" &&
      error.hasErrorLabel("UnknownTransactionCommitResult")
    ) {
      return res.status(503).json({
        mensaje: "No se pudo confirmar el resultado de la transacción.",
        accion: "Consulta el progreso antes de intentar nuevamente."
      });
    }

    return res.status(500).json({
      mensaje: "Error al finalizar el análisis.",
      error: error.message
    });

  } finally {
    if (session) {
      if (session.inTransaction()) {
        await session.abortTransaction().catch(console.error);
      }

      await session.endSession();
    }
  }
});



// Funcion para confirmar una transaccion 
async function confirmarTransaccion(session) {
  const maxIntentos = 3;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      await session.commitTransaction();
      return;
    } catch (error) {
      const confirmacionDesconocida =
        typeof error.hasErrorLabel === "function" &&
        error.hasErrorLabel("UnknownTransactionCommitResult");

      if (!confirmacionDesconocida) {
        throw error;
      }

      console.warn(
        `Confirmación desconocida. Intento ${intento} de ${maxIntentos}.`
      );

      if (intento === maxIntentos) {
        throw error;
      }
    }
  }
}



app.post("/api/control/agregar-reemplazo/:analisisId", async (req, res) => {
  let session = null;

  try {
    const { analisisId } = req.params;
    const { fecha, valor } = req.body || {};

    // 1. Validar los datos recibidos
    if (!mongoose.isValidObjectId(analisisId)) {
      return res.status(400).json({
        mensaje: "El ID del análisis no es válido."
      });
    }

    const fechaValida =
      typeof fecha === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
      !Number.isNaN(Date.parse(`${fecha}T12:00:00.000Z`)) &&
      new Date(`${fecha}T12:00:00.000Z`)
        .toISOString()
        .slice(0, 10) === fecha;

    if (
      !fechaValida ||
      typeof valor !== "number" ||
      !Number.isFinite(valor)
    ) {
      return res.status(400).json({
        mensaje: "Proporciona una fecha YYYY-MM-DD y un valor numérico válido."
      });
    }

    // 2. Iniciar la transacción antes de consultar o modificar
    session = await mongoose.startSession();
    session.startTransaction();

    const analisis = await Analisis.findById(analisisId)
      .session(session);

    if (!analisis) {
      await session.abortTransaction();
      return res.status(404).json({
        mensaje: "No se encontró el análisis."
      });
    }

    const requeridas = analisis.medicionesRequeridas || 20;

    if (analisis.estado !== "requiere_reemplazo") {
      await session.abortTransaction();
      return res.status(409).json({
        mensaje: "El análisis no está esperando un reemplazo."
      });
    }

    // 3. Consultar todas las mediciones del análisis
    const mediciones = await Medicion.find({
      analisisId: analisis._id,
      tipoMedicion: "inicial"
    }).session(session);

    const validas = mediciones.filter(
      m => m.estado === "valida"
    );

    const excluidas = mediciones.filter(
      m => m.estado === "excluida"
    );

    const pendientes = mediciones.filter(
      m => m.estado === "pendiente_revision"
    );

    if (pendientes.length > 0) {
      await session.abortTransaction();
      return res.status(409).json({
        mensaje: "Primero debes resolver las mediciones pendientes."
      });
    }

    if (
      excluidas.length === 0 ||
      validas.length >= requeridas
    ) {
      await session.abortTransaction();
      return res.status(409).json({
        mensaje: "Este análisis no necesita reemplazos."
      });
    }

    // 4. Bloqueo de escritura para evitar reemplazos simultáneos
    const bloqueo = await Analisis.updateOne(
      {
        _id: analisis._id,
        estado: "requiere_reemplazo",
        versionReemplazos: analisis.versionReemplazos
      },
      {
        $inc: { versionReemplazos: 1 }
      },
      { session }
    );

    if (bloqueo.modifiedCount !== 1) {
      await session.abortTransaction();
      return res.status(409).json({
        mensaje: "El análisis fue modificado. Consulta su estado nuevamente."
      });
    }

    // 5. Crear la medición de reemplazo
    const [nuevaMedicion] = await Medicion.create(
      [{
        prueba: analisis.prueba,
        nivelControl: analisis.nivelControl,
        lote: analisis.lote,
        equipo: analisis.equipo,
        fecha: new Date(`${fecha}T12:00:00.000Z`),
        valor,
        tipoMedicion: "inicial",
        analisisId: analisis._id,
        estado: "pendiente_revision"
      }],
      { session }
    );

    // 6. Recuperar las mediciones candidatas
    const candidatas = await Medicion.find({
      analisisId: analisis._id,
      tipoMedicion: "inicial",
      estado: { $ne: "excluida" }
    })
      .sort({ fecha: 1, _id: 1 })
      .session(session);

    if (candidatas.length > requeridas) {
      throw new Error(
        "El conjunto supera las mediciones requeridas."
      );
    }

    // 7. Si todavía faltan candidatas, seguir recopilando
    if (candidatas.length < requeridas) {
      nuevaMedicion.estado = "valida";
      await nuevaMedicion.save({ session });

      analisis.totalMedicionesValidas = candidatas.length;
      analisis.totalMediciones = candidatas.length;
      analisis.estado = "requiere_reemplazo";
      analisis.media = null;
      analisis.desviacionEstandar = null;
      analisis.coeficienteVariacion = null;
      analisis.mediciones = [];

      // Evitar sobrescribir la versión actualizada
      analisis.versionReemplazos += 1;
      await analisis.save({ session });

      await confirmarTransaccion(session);

      return res.status(201).json({
        mensaje: "Reemplazo registrado. Todavía faltan mediciones.",
        analisisId: analisis._id,
        medicion: nuevaMedicion,
        resumen: {
          totalCandidatas: candidatas.length,
          faltantes: requeridas - candidatas.length,
          estado: analisis.estado
        }
      });
    }

    // 8. Reevaluar Grubbs con exactamente 20 candidatas
    const datosGrubbs = candidatas.map(m => ({
      fecha: m.fecha,
      valor: m.valor
    }));

    const resultadoGrubbs = pruebaGrubbs(datosGrubbs);

    if (
      !resultadoGrubbs ||
      resultadoGrubbs.error ||
      resultadoGrubbs.hayEmpate
    ) {
      await session.abortTransaction();

      return res.status(422).json({
        mensaje: "No se pudo completar la evaluación de Grubbs.",
        motivo: resultadoGrubbs?.error ||
          "Se requiere revisar un empate estadístico.",
        reemplazoRegistrado: false
      });
    }

    analisis.analisisGrubbs = resultadoGrubbs;

    let sospechosa = null;

    // 9. Revisar si Grubbs encontró un nuevo atípico
    if (resultadoGrubbs.esAtipico) {
      const indice = resultadoGrubbs.indiceSospechoso;

      if (
        !Number.isInteger(indice) ||
        indice < 0 ||
        indice >= candidatas.length
      ) {
        throw new Error(
          "No se pudo identificar la medición sospechosa."
        );
      }

      sospechosa = candidatas[indice];

      const firmaActual = generarFirmaConjunto(candidatas);

      const yaInvestigada =
        sospechosa.decisionRevision === "conservar" &&
        sospechosa.investigacion?.fechaRevision != null &&
        sospechosa.firmaConjuntoRevision === firmaActual;

      if (!yaInvestigada) {
        // El nuevo reemplazo es válido provisionalmente
        // si otra medición resultó sospechosa
        if (
          String(sospechosa._id) !==
          String(nuevaMedicion._id)
        ) {
          nuevaMedicion.estado = "valida";
          await nuevaMedicion.save({ session });
        }

        sospechosa.estado = "pendiente_revision";
        await sospechosa.save({ session });
      }
    }

        // Si Grubbs no detectó valores atípicos,
    // aceptar el reemplazo antes de contar pendientes.
    if (!resultadoGrubbs.esAtipico) {
      nuevaMedicion.estado = "valida";
      await nuevaMedicion.save({ session });
    }

    // 10. Aceptar el conjunto cuando no haya revisión pendiente
    const pendientesFinales = await Medicion.countDocuments({
      analisisId: analisis._id,
      tipoMedicion: "inicial",
      estado: "pendiente_revision"
    }).session(session);

    if (pendientesFinales === 0) {
      nuevaMedicion.estado = "valida";
      await nuevaMedicion.save({ session });

      const estadisticas = calcularEstadisticas(
        candidatas.map(m => m.valor)
      );

      analisis.media = estadisticas.media;
      analisis.desviacionEstandar =
        estadisticas.desviacionEstandar;
      analisis.coeficienteVariacion =
        estadisticas.coeficienteVariacion;

      analisis.mediciones = candidatas.map(m => ({
        fecha: m.fecha,
        valor: m.valor
      }));

      analisis.estado = "completo";
    } else {
      analisis.estado = "pendiente_revision";
      analisis.media = null;
      analisis.desviacionEstandar = null;
      analisis.coeficienteVariacion = null;
      analisis.mediciones = [];
    }

    // 11. Actualizar los conteos
    const totalValidas = await Medicion.countDocuments({
      analisisId: analisis._id,
      tipoMedicion: "inicial",
      estado: "valida"
    }).session(session);

    const totalExcluidas = await Medicion.countDocuments({
      analisisId: analisis._id,
      tipoMedicion: "inicial",
      estado: "excluida"
    }).session(session);

    analisis.totalMedicionesValidas = totalValidas;
    analisis.totalMediciones = candidatas.length;
    analisis.versionReemplazos += 1;

    if (
      analisis.estado === "completo" &&
      (totalValidas !== requeridas || pendientesFinales !== 0)
    ) {
      throw new Error(
        "No se puede completar un análisis con mediciones faltantes."
      );
    }

    await analisis.save({ session });

    // 12. Confirmar la transacción
    await confirmarTransaccion(session);

    return res.status(201).json({
      mensaje: "Medición de reemplazo registrada y evaluada correctamente.",
      analisisId: analisis._id,
      medicion: nuevaMedicion,
      analisisGrubbs: resultadoGrubbs,
      medicionSospechosa: sospechosa
        ? {
            id: sospechosa._id,
            fecha: sospechosa.fecha,
            valor: sospechosa.valor,
            estado: sospechosa.estado
          }
        : null,
      resumen: {
        totalRegistradas:
          totalValidas + totalExcluidas + pendientesFinales,
        totalValidas,
        totalExcluidas,
        totalPendientes: pendientesFinales,
        medicionesRequeridas: requeridas,
        estado: analisis.estado
      }
    });

  } catch (error) {
    console.error("Error al registrar reemplazo:", error);

    if (session && session.inTransaction()) {
      await session.abortTransaction().catch(console.error);
    }

    const conflicto =
      error.code === 112 ||
      error.codeName === "WriteConflict" ||
      (typeof error.hasErrorLabel === "function" &&
        error.hasErrorLabel("TransientTransactionError"));

    if (conflicto) {
      return res.status(409).json({
        mensaje: "Otro proceso modificó el análisis.",
        accion: "Consulta el progreso antes de reintentar."
      });
    }

    if (
      typeof error.hasErrorLabel === "function" &&
      error.hasErrorLabel("UnknownTransactionCommitResult")
    ) {
      return res.status(503).json({
        mensaje: "No se pudo confirmar el resultado de la transacción.",
        accion: "Consulta el historial antes de reintentar."
      });
    }

    return res.status(500).json({
      mensaje: "Error al registrar el reemplazo.",
      error: error.message
    });

  } finally {
    if (session) {
      if (session.inTransaction()) {
        await session.abortTransaction().catch(console.error);
      }
      await session.endSession();
    }
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

    // Verificar que pertenezca al conjunto inicial
    if (medicion.tipoMedicion !== "inicial") {
      return res.status(409).json({
        mensaje:
          "Este endpoint solo permite revisar mediciones iniciales. Las mediciones de seguimiento se evalúan mediante Levey-Jennings y Westgard.",
      });
    }

    // Verificar que esté vinculada a un análisis
    if (!medicion.analisisId) {
      return res.status(409).json({
        mensaje: "La medición inicial no está vinculada a un análisis.",
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
      // Registrar la decisión de excluir
      medicion.estado = "excluida";
      medicion.decisionRevision = "excluir";

      // Documentar la exclusión
      medicion.exclusion = {
        motivo: motivo.trim(),
        autorizadoPor: autorizadoPor.trim(),
        fechaExclusion: new Date(),
      };
    } else {
      // Conservar la medición después de investigarla
      medicion.estado = "valida";
      medicion.decisionRevision = "conservar";

      // Consultar el conjunto inicial que fue investigado
      const medicionesConjunto = await Medicion.find({
        analisisId: medicion.analisisId,
        tipoMedicion: "inicial",
        estado: { $ne: "excluida" },
      });

      // Generar una firma de las mediciones evaluadas
      medicion.firmaConjuntoRevision = generarFirmaConjunto(medicionesConjunto);
    }

    await medicion.save();

    // Actualizar el análisis relacionado con la medición
    if (medicion.analisisId) {
      const analisis = await Analisis.findById(medicion.analisisId);

      if (analisis) {
        // Consultar únicamente las mediciones iniciales
        // relacionadas con este análisis
        const medicionesAnalisis = await Medicion.find({
          analisisId: analisis._id,
          tipoMedicion: "inicial",
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

          if (
            resultadoGrubbs.error ||
            resultadoGrubbs.esAtipico ||
            resultadoGrubbs.hayEmpate
          ) {
            analisis.estado = "pendiente_revision";
            analisis.analisisGrubbs = resultadoGrubbs;

            if (resultadoGrubbs.esAtipico === true) {
              const medicionSospechosa =
                medicionesValidas[resultadoGrubbs.indiceSospechoso];

              if (!medicionSospechosa) {
                throw new Error(
                  "No se pudo identificar la medición sospechosa.",
                );
              }

              // Generar la firma del conjunto actual de mediciones
              const firmaActual = generarFirmaConjunto(medicionesValidas);

              // Comprobar que la investigación corresponde
              // exactamente al conjunto que estamos evaluando
              const yaFueInvestigada =
                medicionSospechosa.decisionRevision === "conservar" &&
                medicionSospechosa.investigacion?.fechaRevision != null &&
                medicionSospechosa.firmaConjuntoRevision != null &&
                medicionSospechosa.firmaConjuntoRevision === firmaActual;

              if (yaFueInvestigada) {
                // Mantener la medición investigada y conservada
                medicionSospechosa.estado = "valida";

                await medicionSospechosa.save();

                // Calcular las estadísticas con las 20 mediciones aceptadas
                const valoresValidos = medicionesValidas.map((m) => m.valor);

                const estadisticasFinales =
                  calcularEstadisticas(valoresValidos);

                // Guardar los resultados estadísticos
                analisis.media = estadisticasFinales.media;

                analisis.desviacionEstandar =
                  estadisticasFinales.desviacionEstandar;

                analisis.coeficienteVariacion =
                  estadisticasFinales.coeficienteVariacion;

                analisis.totalMediciones = estadisticasFinales.totalMediciones;

                analisis.totalMedicionesValidas = medicionesValidas.length;

                // Guardar las 20 mediciones aceptadas
                analisis.mediciones = medicionesValidas.map((m) => ({
                  fecha: m.fecha,
                  valor: m.valor,
                }));

                // Conservar el resultado de Grubbs,
                // incluso cuando esAtipico sea true
                analisis.analisisGrubbs = resultadoGrubbs;

                // Finalizar los cálculos iniciales
                analisis.estado = "completo";
              } else {
                // El resultado necesita una investigación
                medicionSospechosa.estado = "pendiente_revision";

                await medicionSospechosa.save();

                analisis.totalMedicionesValidas = medicionesValidas.length - 1;
              }
            }
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


app.patch("/api/control/parametros/:id/validar", async (req, res) => {
  try {
    const { id } = req.params;

    // Validar identificador de MongoDB
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        mensaje: "El ID del parámetro no es válido."
      });
    }

    // Buscar los parámetros registrados
    const parametro = await ParametroControl.findById(id);

    if (!parametro) {
      return res.status(404).json({
        mensaje: "No se encontraron los parámetros de control."
      });
    }

    // Evitar validar nuevamente
    if (parametro.estado === "validado") {
      return res.status(409).json({
        mensaje: "Estos parámetros ya están validados."
      });
    }

    // Solo se permiten parámetros pendientes
    if (parametro.estado !== "pendiente_validacion") {
      return res.status(409).json({
        mensaje: "Los parámetros no están pendientes de validación."
      });
    }

    // Comprobar que los valores sean válidos
    if (
      !Number.isFinite(parametro.media) ||
      !Number.isFinite(parametro.desviacionEstandar) ||
      parametro.desviacionEstandar <= 0
    ) {
      return res.status(400).json({
        mensaje: "La media o desviación estándar no son válidas."
      });
    }

    // Actualizar de forma condicional para evitar
    // validar un registro cuyo estado haya cambiado
    const parametroValidado =
      await ParametroControl.findOneAndUpdate(
        {
          _id: id,
          estado: "pendiente_validacion"
        },
        {
          $set: {
            estado: "validado"
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

    if (!parametroValidado) {
      return res.status(409).json({
        mensaje: "El estado cambió durante la validación."
      });
    }

    return res.status(200).json({
      mensaje: "Parámetros de control validados correctamente.",
      parametro: parametroValidado
    });

  } catch (error) {
    console.error("Error al validar parámetros:", error);

    return res.status(500).json({
      mensaje: "Error al validar los parámetros de control.",
      error: error.message
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


    // Buscar el análisis completo correspondiente
    const analisis = await Analisis.findOne({
      prueba,
      nivelControl,
      lote,
      equipo,
      estado: "completo"
    }).sort({ createdAt: -1 });

    if (!analisis) {
      return res.status(404).json({
        mensaje: "No se encontró un análisis completo para esta combinación."
      });
    }


    // Recuperar únicamente las mediciones válidas del análisis
    const mediciones = await Medicion.find({
      analisisId: analisis._id,
      estado: "valida"
    }).sort({ fecha: 1, _id: 1 });

    const requeridas = analisis.medicionesRequeridas || 20;

    if (mediciones.length !== requeridas) {
      return res.status(409).json({
        mensaje: "El análisis no tiene la cantidad requerida de mediciones válidas.",
        encontradas: mediciones.length,
        requeridas
      });
    }

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

/**
 * GET /api/control/analisis-guardado/:analisisId
 *
 * Recupera un análisis guardado en MongoDB
 * junto con todas sus mediciones.
 */

// Endpoint para recuperar un análisis guardado y sus mediciones

app.get("/api/control/analisis-guardado/:analisisId", async (req, res) => {
  try {
    const { analisisId } = req.params;

    // Validar el identificador de MongoDB
    if (!mongoose.Types.ObjectId.isValid(analisisId)) {
      return res.status(400).json({
        mensaje: "El identificador del análisis no es válido.",
      });
    }

    // Buscar el análisis guardado
    const analisis = await Analisis.findById(analisisId);

    if (!analisis) {
      return res.status(404).json({
        mensaje: "No se encontró el análisis solicitado.",
      });
    }

    // Recuperar todas las mediciones relacionadas
    const mediciones = await Medicion.find({
      analisisId: analisis._id,
    }).sort({
      fecha: 1,
      _id: 1,
    });

    // Contar las mediciones por estado
    const totalValidas = mediciones.filter(
      (medicion) => medicion.estado === "valida",
    ).length;

    const totalExcluidas = mediciones.filter(
      (medicion) => medicion.estado === "excluida",
    ).length;

    const totalPendientes = mediciones.filter(
      (medicion) => medicion.estado === "pendiente_revision",
    ).length;

    // Enviar la información a la página web
    return res.status(200).json({
      mensaje: "Análisis recuperado correctamente.",

      analisis: analisis,

      resumen: {
        totalRegistradas: mediciones.length,
        totalValidas: totalValidas,
        totalExcluidas: totalExcluidas,
        totalPendientes: totalPendientes,
        medicionesRequeridas: analisis.medicionesRequeridas,
      },

      mediciones: mediciones,
    });
  } catch (error) {
    console.error("Error al recuperar el análisis:", error);

    return res.status(500).json({
      mensaje: "Error al recuperar el análisis.",
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



app.get("/api/control/levey-jennings/:analisisId/grafica", async (req, res) => {
  try {
    const { analisisId } = req.params;

    // 1. Validar identificador
    if (!mongoose.isValidObjectId(analisisId)) {
      return res.status(400).json({
        mensaje: "El ID del análisis no es válido."
      });
    }

    // 2. Recuperar análisis
    const analisis = await Analisis.findById(analisisId);

    if (!analisis) {
      return res.status(404).json({
        mensaje: "No se encontró el análisis."
      });
    }

    // 3. Solo permitir análisis completos
    if (analisis.estado !== "completo") {
      return res.status(409).json({
        mensaje: "El análisis debe estar completo para generar la gráfica."
      });
    }

    // 4. Buscar parámetros objetivo validados
    const parametros = await ParametroControl.findOne({
      prueba: analisis.prueba,
      nivelControl: analisis.nivelControl,
      lote: analisis.lote,
      equipo: analisis.equipo,
      estado: "validado"
    });

    if (!parametros) {
      return res.status(404).json({
        mensaje: "No existen parámetros objetivo validados para este análisis."
      });
    }

    if (
      !Number.isFinite(parametros.media) ||
      !Number.isFinite(parametros.desviacionEstandar) ||
      parametros.desviacionEstandar <= 0
    ) {
      return res.status(422).json({
        mensaje: "Los parámetros objetivo no son válidos."
      });
    }

    // 5. Recuperar únicamente las mediciones válidas
  const mediciones = await Medicion.find({
  analisisId: analisis._id,
  estado: "valida"
}).sort({ fecha: 1, _id: 1 });

    const requeridas = analisis.medicionesRequeridas || 20;

    if (mediciones.length !== requeridas) {
      return res.status(409).json({
        mensaje: "No existen exactamente las mediciones válidas requeridas.",
        encontradas: mediciones.length,
        requeridas
      });
    }

    // 6. Preparar los puntos de la gráfica
    const resultados = mediciones.map(m => ({
      fecha: m.fecha.toISOString(),
      valor: m.valor
    }));

    // 7. Generar la imagen usando parámetros objetivo
    const imagen = await generarGraficaLeveyJennings({
      prueba: analisis.prueba,
      media: parametros.media,
      desviacionEstandar: parametros.desviacionEstandar,
      resultados,
      alertas: []
    });

    // 8. Enviar imagen PNG
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="levey-jennings.png"');
    res.setHeader("Cache-Control", "no-store");

    return res.send(imagen);

  } catch (error) {
    console.error("Error al generar Levey-Jennings automático:", error);

    return res.status(500).json({
      mensaje: "Error al generar la gráfica de Levey-Jennings.",
      error: error.message
    });
  }
});


// Endpoint para buscar análisis por nombre de prueba

app.get("/api/control/buscar-analisis", async (req, res) => {
  try {
    const nombre = String(req.query.prueba || "").trim();

    if (nombre.length < 2) {
      return res.status(400).json({
        mensaje: "Introduce al menos 2 caracteres.",
      });
    }

    // Escapar caracteres especiales de expresiones regulares
    const nombreSeguro = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const analisis = await Analisis.find({
      prueba: {
        $regex: nombreSeguro,
        $options: "i",
      },
    })
      .select(
        "_id prueba estado createdAt " +
          "totalMedicionesValidas medicionesRequeridas",
      )
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return res.status(200).json({
      mensaje: "Búsqueda realizada correctamente.",
      total: analisis.length,
      analisis,
    });
  } catch (error) {
    console.error("Error al buscar análisis:", error);

    return res.status(500).json({
      mensaje: "Error al buscar análisis.",
    });
  }
});

// Endpoint para generar la gráfica Levey-Jennings desde un análisis guardado en MongoDB

app.get("/api/control/grafica-analisis/:analisisId", async (req, res) => {
  try {
    const { analisisId } = req.params;

    // Validar el identificador de MongoDB
    if (!mongoose.Types.ObjectId.isValid(analisisId)) {
      return res.status(400).json({
        mensaje: "El ID del análisis no es válido.",
      });
    }

    // Recuperar el análisis guardado
    const analisis = await Analisis.findById(analisisId);

    if (!analisis) {
      return res.status(404).json({
        mensaje: "No se encontró el análisis.",
      });
    }

    // Solo generar la gráfica con análisis completos
    if (analisis.estado !== "completo") {
      return res.status(409).json({
        mensaje:
          "El análisis todavía no está completo. " +
          "Se requieren 20 mediciones válidas.",
      });
    }

    // Recuperar exclusivamente las mediciones válidas
    const mediciones = await Medicion.find({
      analisisId: analisis._id,
      estado: "valida",
    }).sort({ fecha: 1, _id: 1 });

    if (mediciones.length !== 20) {
      return res.status(409).json({
        mensaje:
          "El análisis no contiene exactamente " + "20 mediciones válidas.",
      });
    }

    // Validar los parámetros estadísticos
    if (
      !Number.isFinite(analisis.media) ||
      !Number.isFinite(analisis.desviacionEstandar) ||
      analisis.desviacionEstandar <= 0
    ) {
      return res.status(409).json({
        mensaje:
          "No se puede generar la gráfica porque " +
          "la media o desviación estándar no son válidas.",
      });
    }

    const resultados = mediciones.map((medicion) => ({
      fecha: medicion.fecha,
      valor: medicion.valor,
    }));

    // Generar la gráfica PNG
    const imagen = await generarGraficaLeveyJennings({
      prueba: analisis.prueba,
      media: analisis.media,
      desviacionEstandar: analisis.desviacionEstandar,
      resultados,
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");

    return res.send(imagen);
  } catch (error) {
    console.error("Error al generar gráfica del análisis:", error);

    return res.status(500).json({
      mensaje: "Error al generar la gráfica de Levey-Jennings.",
    });
  }
});


/* ==========================================
   REGISTRO DIARIO DE MEDICIONES
========================================== */

app.post("/api/control/registrar-diario", async (req, res) => {

    let session = null;

    try {

        const {
            prueba,
            nivelControl,
            lote,
            equipo,
            fecha,
            valor
        } = req.body || {};

        // Validar identificación
        const identificacion = {
            prueba,
            nivelControl,
            lote,
            equipo
        };

        if (
            Object.values(identificacion).some(
                campo =>
                    typeof campo !== "string" ||
                    !campo.trim()
            )
        ) {
            return res.status(400).json({
                mensaje:
                    "Debes proporcionar prueba, nivelControl, lote y equipo."
            });
        }

        // Validar valor
        if (
            typeof valor !== "number" ||
            !Number.isFinite(valor)
        ) {
            return res.status(400).json({
                mensaje: "El valor debe ser un número válido."
            });
        }

        // Validar fecha
        const fechaValida =
            typeof fecha === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
            Number.isFinite(Date.parse(fecha)) &&
            new Date(`${fecha}T12:00:00.000Z`)
                .toISOString()
                .slice(0, 10) === fecha;

        if (!fechaValida) {
            return res.status(400).json({
                mensaje: "La fecha no es válida."
            });
        }

        // Normalizar identificación
        for (const campo of Object.keys(identificacion)) {
            identificacion[campo] =
                identificacion[campo].trim();
        }

        session = await mongoose.startSession();

        session.startTransaction();

        // Buscar análisis en recopilación
        let analisis = await Analisis.findOne({
            ...identificacion,
            estado: "en_recopilacion"
        }).session(session);

        // Evitar crear otro análisis si ya existe
        // uno pendiente de revisión o reemplazo.
        if (!analisis) {

           
const analisisBloqueado = await Analisis.findOne({
    ...identificacion,
    estado: {
        $in: [
            "pendiente_revision",
            "requiere_reemplazo",
            "requiere_revision_empate"
        ]
    }
}).session(session);


            if (analisisBloqueado) {

                await session.abortTransaction();

                return res.status(409).json({
                   mensaje:
    "Existe un análisis activo pendiente de revisión, reemplazo o resolución de empate.",
                    analisisId: analisisBloqueado._id
                });
            }

            // Crear nuevo análisis
            const nuevosAnalisis = await Analisis.create(
                [{
                    ...identificacion,
                    estado: "en_recopilacion",
                    medicionesRequeridas: 20,
                    totalMediciones: 0,
                    totalMedicionesValidas: 0,
                    mediciones: []
                }],
                { session }
            );

            analisis = nuevosAnalisis[0];
        }

        // Consultar mediciones iniciales existentes
        const medicionesExistentes = await Medicion.find({
            analisisId: analisis._id,
            tipoMedicion: "inicial"
        }).session(session);

        if (medicionesExistentes.length >= 20) {

            await session.abortTransaction();

            return res.status(409).json({
                mensaje:
                    "El análisis ya tiene 20 mediciones iniciales."
            });
        }

        // Evitar fechas duplicadas
        const fechaNormalizada =
            new Date(`${fecha}T12:00:00.000Z`);

        const fechaDuplicada = medicionesExistentes.some(
            medicion =>
                medicion.fecha.toISOString().slice(0, 10) === fecha
        );

        if (fechaDuplicada) {

            await session.abortTransaction();

            return res.status(409).json({
                mensaje:
                    `Ya existe una medición registrada para la fecha ${fecha}.`
            });
        }

        // Guardar medición individual
        const nuevasMediciones = await Medicion.create(
            [{
                ...identificacion,
                analisisId: analisis._id,
                tipoMedicion: "inicial",
                fecha: fechaNormalizada,
                valor,
                estado: "valida"
            }],
            { session }
        );

      
    // Actualizar progreso con control de concurrencia
    const totalAnterior = medicionesExistentes.length;
    const totalRegistradas = totalAnterior + 1;

    const actualizacion = await Analisis.updateOne(
        {
            _id: analisis._id,
            estado: "en_recopilacion",
            totalMediciones: totalAnterior
        },
        {
            $set: {
                totalMediciones: totalRegistradas,
                totalMedicionesValidas: totalRegistradas
            }
        },
        { session }
    );

    if (actualizacion.modifiedCount !== 1) {
        const error = new Error(
            "El análisis fue modificado por otra solicitud. Intenta nuevamente."
        );
        error.statusCode = 409;
        throw error;
    }


    // Recargar el análisis después de la actualización
    // condicional para trabajar con su versión actual.
    const analisisActualizado = await Analisis.findById(
        analisis._id
    ).session(session);

    if (!analisisActualizado) {
        throw new Error(
            "No se encontró el análisis después de actualizarlo."
        );
    }

    analisis = analisisActualizado;


    analisis.totalMediciones = totalRegistradas;
    analisis.totalMedicionesValidas = totalRegistradas;



// Identificar si se completaron las 20 mediciones iniciales

const esUltimaMedicion = totalRegistradas === 20;


if (esUltimaMedicion) {

    // 1. Recuperar las 19 mediciones anteriores
    // y agregar la medición número 20.
    const datosGrubbs = [
        ...medicionesExistentes.map(m => ({
            fecha: m.fecha,
            valor: m.valor
        })),
        {
            fecha: nuevasMediciones[0].fecha,
            valor: nuevasMediciones[0].valor
        }
    ];

    // 2. Ordenar las mediciones cronológicamente.
    datosGrubbs.sort(
        (a, b) => a.fecha.getTime() - b.fecha.getTime()
    );

    // 3. Verificar que existan exactamente 20 mediciones.
    if (datosGrubbs.length !== 20) {
        throw new Error(
            "Se requieren exactamente 20 mediciones para ejecutar Grubbs."
        );
    }

    console.log(
        "Mediciones preparadas para Grubbs:",
        datosGrubbs.length
    );

    // 4. Ejecutar la prueba de Grubbs.
    const resultadoGrubbs = pruebaGrubbs(datosGrubbs);

    // 5. Validar el resultado.
    if (resultadoGrubbs.error) {
        throw new Error(
            `No fue posible calcular Grubbs: ${resultadoGrubbs.error}`
        );
    }

    // 6. Validar G calculado y G crítico.
    const gCalculado = resultadoGrubbs.estadisticoG;
    const gCritico = resultadoGrubbs.valorCritico;

    if (
        typeof gCalculado !== "number" ||
        typeof gCritico !== "number" ||
        !Number.isFinite(gCalculado) ||
        !Number.isFinite(gCritico) ||
        gCalculado < 0 ||
        gCritico <= 0
    ) {
        throw new Error(
            "La prueba de Grubbs produjo valores estadísticos inválidos."
        );
    }

    // 7. Guardar los resultados de Grubbs.
    analisis.analisisGrubbs = resultadoGrubbs;

    console.log("Resultado de Grubbs:", {
        estadisticoG: gCalculado,
        valorCritico: gCritico,
        esAtipico: resultadoGrubbs.esAtipico,
        hayEmpate: resultadoGrubbs.hayEmpate
    });

    // ==================================================
    // CASO 1: NO SE DETECTARON VALORES ATÍPICOS
    // ==================================================

    if (gCalculado <= gCritico) {

        // Calcular las estadísticas definitivas.
        const estadisticas = calcularEstadisticas(
            datosGrubbs.map(m => m.valor)
        );

        analisis.media = estadisticas.media;
        analisis.desviacionEstandar =
            estadisticas.desviacionEstandar;
        analisis.coeficienteVariacion =
            estadisticas.coeficienteVariacion;

        // Guardar las 20 mediciones ordenadas.
        analisis.mediciones = datosGrubbs.map(m => ({
            fecha: m.fecha,
            valor: m.valor
        }));

        analisis.totalMediciones = 20;
        analisis.totalMedicionesValidas = 20;

        analisis.estado = "completo";

        console.log(
            "Análisis diario completado sin valores atípicos:",
            analisis._id
        );

    }

    // ==================================================
    // CASO 2: SE DETECTÓ UN POSIBLE VALOR ATÍPICO
    // ==================================================

    else if (
        gCalculado > gCritico &&
        resultadoGrubbs.hayEmpate === false
    ) {

        const indice = resultadoGrubbs.indiceSospechoso;

        // Verificar que el índice sea válido.
        if (
            !Number.isInteger(indice) ||
            indice < 0 ||
            indice >= datosGrubbs.length
        ) {
            throw new Error(
                "Grubbs detectó un atípico, pero no identificó su posición."
            );
        }

        const medicionSospechosa = datosGrubbs[indice];

        // Marcar la medición como pendiente de revisión.
        const medicionActualizada =
            await Medicion.findOneAndUpdate(
                {
                    analisisId: analisis._id,
                    tipoMedicion: "inicial",
                    fecha: medicionSospechosa.fecha,
                    valor: medicionSospechosa.valor
                },
                {
                    $set: {
                        estado: "pendiente_revision"
                    }
                },
                {
                    new: true,
                    session
                }
            );

        if (!medicionActualizada) {
            throw new Error(
                "No se encontró la medición sospechosa para revisión."
            );
        }

        analisis.estado = "pendiente_revision";

        analisis.totalMediciones = 20;
        analisis.totalMedicionesValidas = 19;

        // Todavía no existen estadísticas definitivas.
        analisis.media = null;
        analisis.desviacionEstandar = null;
        analisis.coeficienteVariacion = null;
        analisis.mediciones = [];

        console.log(
            "Posible valor atípico detectado:",
            medicionSospechosa.valor,
            medicionSospechosa.fecha
        );

    }

    // ==================================================
    // CASO 3: EMPATE ESTADÍSTICAMENTE SIGNIFICATIVO
    // ==================================================

    else if (
        gCalculado > gCritico &&
        resultadoGrubbs.hayEmpate === true
    ) {

        // No seleccionar arbitrariamente una medición.
        analisis.estado = "requiere_revision_empate";

        analisis.totalMediciones = 20;
        analisis.totalMedicionesValidas = 20;

        // Mantener las estadísticas finales pendientes.
        analisis.media = null;
        analisis.desviacionEstandar = null;
        analisis.coeficienteVariacion = null;
        analisis.mediciones = [];

        console.warn(
            "Empate significativo en Grubbs. Requiere revisión:",
            analisis._id
        );

    }

    // ==================================================
    // CASO 4: RESULTADO INESPERADO
    // ==================================================

    else {
        throw new Error(
            "No fue posible determinar el estado del análisis con los resultados de Grubbs."
        );
    }

} // FIN DE if (esUltimaMedicion)


if (!esUltimaMedicion) {
    analisis.media = null;
    analisis.desviacionEstandar = null;
    analisis.coeficienteVariacion = null;
}

// Guardar el análisis.
await analisis.save({ session });

// Confirmar la transacción.
await confirmarTransaccion(session);

// Responder a Postman.
return res.status(201).json({
    mensaje: "Medición diaria registrada correctamente.",
    analisisId: analisis._id,
    estado: analisis.estado,
    medicion: nuevasMediciones[0],

    resumen: {
        totalRegistradas,
        medicionesRequeridas: 20,
        faltantes: Math.max(0, 20 - totalRegistradas),
        totalMedicionesValidas: analisis.totalMedicionesValidas,
        analisisCompleto: analisis.estado === "completo",
        requiereRevision: [
            "pendiente_revision",
            "requiere_revision_empate"
        ].includes(analisis.estado)
    },

    resultadoGrubbs:
        esUltimaMedicion
            ? analisis.analisisGrubbs
            : null
});

} catch (error) {

    console.error("Error en registro diario:", error);

    const confirmacionDesconocida =
        typeof error.hasErrorLabel === "function" &&
        error.hasErrorLabel("UnknownTransactionCommitResult");

    if (
        !confirmacionDesconocida &&
        session?.inTransaction()
    ) {
        try {
            await session.abortTransaction();
        } catch (errorAbort) {
            console.error(
                "Error al revertir transacción:",
                errorAbort
            );
        }
    }

    if (confirmacionDesconocida) {
        return res.status(503).json({
            mensaje:
                "No se pudo confirmar si la medición quedó registrada.",
            accion:
                "Consulta MongoDB antes de repetir la petición."
        });
    }

    const conflictoEscritura =
        typeof error.hasErrorLabel === "function" &&
        error.hasErrorLabel("TransientTransactionError");

    if (
        error.statusCode === 409 ||
        conflictoEscritura ||
        error.code === 11000
    ) {
        return res.status(409).json({
            mensaje:
                "El análisis fue modificado por otra solicitud " +
                "o ya existe un registro equivalente.",
            accion:
                "Consulta las mediciones guardadas antes de volver a intentar."
        });
    }

    return res.status(500).json({
        mensaje: "Error al registrar la medición diaria.",
        error: error.message
    });

} finally {

    if (session) {
        await session.endSession();
    }

}

}); // FIN DEL ENDPOINT registrar-diario




const iniciarServidor = async () => {
  await conectarDB();

  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
};

iniciarServidor();