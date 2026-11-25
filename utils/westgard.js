const {
    calcularZScoreDecimal,
    compararLimiteZ
} = require("./precisionEstadistica");


function evaluarWestgard({
  media,
  desviacionEstandar,
  resultados,
  corridaId = null,
}) {
  // validar la media objetivo
  if (typeof media !== "number" || !Number.isFinite(media)) {
    throw new Error("La media objetivo debe ser un número válido.");
  }

  // validar la desviación estándar objetivo
  if (
    typeof desviacionEstandar !== "number" ||
    !Number.isFinite(desviacionEstandar) ||
    desviacionEstandar <= 0
  ) {
    throw new Error("La desviación estándar debe ser mayor que cero.");
  }

  // validar las mediciones
  if (!Array.isArray(resultados) || resultados.length === 0) {
    throw new Error("Debes proporcionar mediciones para evaluar Westgard.");
  }

  // preparar el resultado de las reglas
  const alertas = [];

  // calcular la distancia de cada medición respecto a la media
  const medicionesEvaluadas = resultados.map((medicion, indice) => {
    if (
      !medicion ||
      typeof medicion.valor !== "number" ||
      !Number.isFinite(medicion.valor)
    ) {
      throw new Error(`La medición ${indice + 1} no es válida.`);
    }

    const zScore = calcularZScoreDecimal(medicion.valor, media, desviacionEstandar).toNumber();
    if (!Number.isFinite(zScore)) throw new Error("Z-score fuera del rango numérico.");

    return {
      numero: indice + 1,
      fecha: medicion.fecha,
      valor: medicion.valor,
      zScore,
    };
  });

  // evaluar la regla 1-2s
  for (const medicion of medicionesEvaluadas) {
    if ((compararLimiteZ(medicion.valor, media, desviacionEstandar, 2) >= 0 || compararLimiteZ(medicion.valor, media, desviacionEstandar, -2) <= 0)) {
      alertas.push({
        regla: "1-2s",
        tipo: "advertencia",
        numeroMedicion: medicion.numero,
        fecha: medicion.fecha,
        valor: medicion.valor,
        zScore: medicion.zScore,
        mensaje: `La medición ${medicion.numero} supera el límite de ±2 DE.`,
      });
    }
  }

  // evaluar la regla 1-3s
  for (const medicion of medicionesEvaluadas) {
    if ((compararLimiteZ(medicion.valor, media, desviacionEstandar, 3) >= 0 || compararLimiteZ(medicion.valor, media, desviacionEstandar, -3) <= 0)) {
      alertas.push({
        regla: "1-3s",
        tipo: "rechazo",
        numeroMedicion: medicion.numero,
        fecha: medicion.fecha,
        valor: medicion.valor,
        zScore: medicion.zScore,
        tipoError: "aleatorio",
        mensaje: `La medición ${medicion.numero} supera el límite de ±3 DE.`,
      });
    }
  }

  // evaluar la regla 2-2s
  for (let i = 1; i < medicionesEvaluadas.length; i++) {
    // obtener dos mediciones consecutivas
    const anterior = medicionesEvaluadas[i - 1];
    const actual = medicionesEvaluadas[i];

    // comprobar si ambas superan +2 DE
    const ambasSuperiores = compararLimiteZ(anterior.valor, media, desviacionEstandar, 2) >= 0 && compararLimiteZ(actual.valor, media, desviacionEstandar, 2) >= 0;

    // comprobar si ambas superan -2 DE
    const ambasInferiores = compararLimiteZ(anterior.valor, media, desviacionEstandar, -2) <= 0 && compararLimiteZ(actual.valor, media, desviacionEstandar, -2) <= 0;

    // detectar la regla 2-2s
    if (ambasSuperiores || ambasInferiores) {
      alertas.push({
        regla: "2-2s",
        tipo: "rechazo",
        tipoError: "sistemático",
        mediciones: [
          {
            numero: anterior.numero,
            fecha: anterior.fecha,
            valor: anterior.valor,
            zScore: anterior.zScore,
          },
          {
            numero: actual.numero,
            fecha: actual.fecha,
            valor: actual.valor,
            zScore: actual.zScore,
          },
        ],
        mensaje:
          `Las mediciones ${anterior.numero} y ${actual.numero} ` +
          "superan consecutivamente el límite de ±2 DE " +
          "del mismo lado de la media.",
      });
    }
  }

  // devolver los resultados del análisis

  return {
    metodo: "Reglas de Westgard",
    corridaId,
    mediaObjetivo: media,
    desviacionEstandarObjetivo: desviacionEstandar,
    totalMediciones: medicionesEvaluadas.length,
    medicionesEvaluadas,
    alertas,

    estado: alertas.some((alerta) => alerta.tipo === "rechazo")
      ? "rechazo"
      : alertas.length > 0
        ? "advertencia"
        : "sin_alertas",
  };
}

function prepararCorridaWestgard({ corridaId, controles }) {
  // Validar el identificador de la corrida.
  if (!corridaId) {
    throw new Error("Debes proporcionar el identificador de la corrida.");
  }

  // Permitir uno, dos o tres niveles de control.
  if (
    !Array.isArray(controles) ||
    controles.length < 1 ||
    controles.length > 3
  ) {
    throw new Error("La corrida debe contener 1, 2 o 3 niveles de control.");
  }

  const medicionesNormalizadas = [];

  // Evitar niveles duplicados.
  const nivelesRegistrados = new Set();

  // Verificar que todos los niveles tengan
  // la misma cantidad de mediciones.
  let cantidadMedicionesPorNivel = null;

  for (const control of controles) {
    if (!control || typeof control !== "object") {
      throw new Error("Control inválido.");
    }

    const { nivelControl, media, desviacionEstandar, resultados } = control;

    // Validar la identidad del nivel.
    if (typeof nivelControl !== "string" || !nivelControl.trim()) {
      throw new Error("Cada control debe tener un nivel identificado.");
    }

    const nombreNivel = nivelControl.trim();

    // Evitar registrar dos veces el mismo nivel.
    if (nivelesRegistrados.has(nombreNivel)) {
      throw new Error(`El nivel ${nombreNivel} está duplicado.`);
    }

    nivelesRegistrados.add(nombreNivel);

    // Validar los parámetros objetivo.
    if (
      !Number.isFinite(media) ||
      !Number.isFinite(desviacionEstandar) ||
      desviacionEstandar <= 0
    ) {
      throw new Error(`Parámetros inválidos para ${nombreNivel}.`);
    }

    // Validar la cantidad de mediciones.
    if (
      !Array.isArray(resultados) ||
      resultados.length < 1 ||
      resultados.length > 2
    ) {
      throw new Error(`El nivel ${nombreNivel} debe tener 1 o 2 mediciones.`);
    }

    // Comprobar que todos los niveles tengan
    // la misma cantidad de mediciones.
    if (cantidadMedicionesPorNivel === null) {
      cantidadMedicionesPorNivel = resultados.length;
    } else if (resultados.length !== cantidadMedicionesPorNivel) {
      throw new Error(
        "Todos los niveles deben tener la misma cantidad de mediciones.",
      );
    }

    // Normalizar cada medición.
    for (const medicion of resultados) {
      if (!medicion || !Number.isFinite(medicion.valor)) {
        throw new Error(`Medición inválida en ${nombreNivel}.`);
      }

      // Calcular puntuación Z.
      const zScore = calcularZScoreDecimal(medicion.valor, media, desviacionEstandar).toNumber();
    if (!Number.isFinite(zScore)) throw new Error("Z-score fuera del rango numérico.");

      if (!Number.isFinite(zScore)) {
        throw new Error(`Puntuación Z inválida en ${nombreNivel}.`);
      }

      medicionesNormalizadas.push({
        corridaId,
        nivelControl: nombreNivel,
        fecha: medicion.fecha,
        valor: medicion.valor,
        mediaObjetivo: media,
        desviacionEstandarObjetivo: desviacionEstandar,
        zScore,
      });
    }
  }

  return {
    corridaId,
    totalNiveles: controles.length,
    totalMediciones: medicionesNormalizadas.length,
    mediciones: medicionesNormalizadas,
  };
}

function evaluarReglaR4s(corrida) {
  // Validar los datos de la corrida
  if (
    !corrida ||
    !corrida.corridaId ||
    !Array.isArray(corrida.mediciones) ||
    corrida.mediciones.length < 2
  ) {
    throw new Error(
      "La corrida debe contener al menos dos mediciones válidas.",
    );
  }

  const alertas = [];

  const mediciones = corrida.mediciones;

  // Comprobar que todas pertenecen a la misma corrida
  for (const medicion of mediciones) {
    if (
      medicion.corridaId !== corrida.corridaId ||
      !Number.isFinite(medicion.zScore)
    ) {
      throw new Error(
        "Las mediciones deben pertenecer a la misma corrida y tener un Z-score válido.",
      );
    }
  }

  // Comparar cada pareja de mediciones de la misma corrida
  for (let i = 0; i < mediciones.length - 1; i++) {
    for (let j = i + 1; j < mediciones.length; j++) {
      const primera = mediciones[i];
      const segunda = mediciones[j];

      const rangoDE = obtenerZDecimalWestgard(primera).minus(obtenerZDecimalWestgard(segunda)).abs().toNumber();

      // Una medición debe estar en +2 DE o más
      // y la otra en -2 DE o menos
      const ladosOpuestos =
        (compararMedicionWestgard(primera, 2) >= 0 && compararMedicionWestgard(segunda, -2) <= 0) ||
        (compararMedicionWestgard(primera, -2) <= 0 && compararMedicionWestgard(segunda, 2) >= 0);

      // Aplicar la regla R-4s
      if (ladosOpuestos) {
        alertas.push({
          regla: "R-4s",
          tipo: "rechazo",
          tipoError: "aleatorio",
          corridaId: corrida.corridaId,
          rangoDE,
          mediciones: [
            {
              nivelControl: primera.nivelControl,
              valor: primera.valor,
              zScore: primera.zScore,
            },
            {
              nivelControl: segunda.nivelControl,
              valor: segunda.valor,
              zScore: segunda.zScore,
            },
          ],
          mensaje:
            "Regla R-4s detectada: dos mediciones de la misma " +
            "corrida alcanzan o superan +2 DE y -2 DE, respectivamente, " +
            "en lados opuestos de sus medias (rango de al menos 4 DE).",
        });
      }
    }
  }

  return {
    metodo: "Regla R-4s de Westgard",
    corridaId: corrida.corridaId,
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0 ? "rechazo" : "sin_alertas_r4s",
  };
}

// Los parámetros originales son la fuente de verdad. Solo las llamadas
// antiguas sin ambos parámetros pueden utilizar un Z-score ya calculado.
function compararMedicionWestgard(medicion, limite) {
    if (!medicion || !Number.isFinite(medicion.zScore)) {
        throw new Error("La medición debe tener un Z-score válido.");
    }
    if (!("mediaObjetivo" in medicion) && !("desviacionEstandarObjetivo" in medicion)) {
        return medicion.zScore < limite ? -1 : medicion.zScore > limite ? 1 : 0;
    }
    return compararLimiteZ(medicion.valor, medicion.mediaObjetivo,
        medicion.desviacionEstandarObjetivo, limite);
}

function obtenerZDecimalWestgard(medicion) {
    if (!("mediaObjetivo" in medicion) && !("desviacionEstandarObjetivo" in medicion)) {
        return calcularZScoreDecimal(medicion.zScore, 0, 1);
    }
    return calcularZScoreDecimal(medicion.valor, medicion.mediaObjetivo,
        medicion.desviacionEstandarObjetivo);
}

function evaluarCorridaWestgard(corrida) {
  // Validar la corrida.
  if (!corrida || !corrida.corridaId || !Array.isArray(corrida.mediciones)) {
    throw new Error("Debes proporcionar una corrida válida.");
  }

  // Identificar la configuración correspondiente.
  const configuracion = obtenerConfiguracionWestgard(
    corrida.totalNiveles,
    corrida.totalMediciones,
  );

  const mediciones = corrida.mediciones;

  if (mediciones.length !== corrida.totalMediciones) {
    throw new Error("El total de mediciones no coincide con la corrida.");
  }

  if (
    mediciones.some(
      (m) =>
        !m || m.corridaId !== corrida.corridaId || !Number.isFinite(m.zScore),
    )
  ) {
    throw new Error(
      "Las mediciones deben pertenecer a la misma corrida y tener Z-scores válidos.",
    );
  }

  const alertas = [];

  const reglasEvaluadas = new Set();

  const reglasConfiguradas = [
    configuracion.advertencia,
    ...configuracion.reglas,
  ];

  // Reglas individuales.
  reglasEvaluadas.add("1-2s");

  if (configuracion.reglas.includes("1-3s")) {
    reglasEvaluadas.add("1-3s");
  }

  for (const medicion of mediciones) {
  const z = medicion.zScore;

const alcanzaLimite2DE =
    compararMedicionWestgard(medicion, 2) >= 0 ||
    compararMedicionWestgard(medicion, -2) <= 0;

const alcanzaLimite3DE =
    compararMedicionWestgard(medicion, 3) >= 0 ||
    compararMedicionWestgard(medicion, -3) <= 0;

// Regla 1-2s: advertencia.
if (alcanzaLimite2DE) {
      alertas.push({
        regla: "1-2s",
        tipo: "advertencia",
        nivelControl: medicion.nivelControl,
        fecha: medicion.fecha,
        valor: medicion.valor,
        zScore: z,
      });
    }

    // Regla 1-3s: rechazo.
   if (
    configuracion.reglas.includes("1-3s") &&
    alcanzaLimite3DE
) {
      alertas.push({
        regla: "1-3s",
        tipo: "rechazo",
        tipoError: "posible error aleatorio o sistemático",
        nivelControl: medicion.nivelControl,
        fecha: medicion.fecha,
        valor: medicion.valor,
        zScore: z,
      });
    }
  }

  // Regla 2-2s dentro de la misma corrida.
  if (configuracion.reglas.includes("2-2s") && mediciones.length >= 2) {
    reglasEvaluadas.add("2-2s");

    for (let i = 0; i < mediciones.length - 1; i++) {
      const primera = mediciones[i];
      const segunda = mediciones[i + 1];

    const superiores =
    compararMedicionWestgard(primera, 2) >= 0 &&
    compararMedicionWestgard(segunda, 2) >= 0;


     
const inferiores =
    compararMedicionWestgard(primera, -2) <= 0 &&
    compararMedicionWestgard(segunda, -2) <= 0;

      if (superiores || inferiores) {
        alertas.push({
          regla: "2-2s",
          tipo: "rechazo",
          tipoError: "sistemático",
          corridaId: corrida.corridaId,
          mediciones: [primera, segunda],
          mensaje: "Regla 2-2s detectada.",
        });
      }
    }
  }

  // Regla 2de3-2s.
  if (configuracion.reglas.includes("2de3-2s") && mediciones.length >= 3) {
    const resultado = evaluarRegla2de3_2s(mediciones);

    alertas.push(...resultado.alertas);

    reglasEvaluadas.add("2de3-2s");
  }

  // Regla R-4s dentro de la misma corrida.
  if (configuracion.reglas.includes("R-4s") && mediciones.length >= 2) {
    const resultado = evaluarReglaR4s(corrida);

    alertas.push(...resultado.alertas);

    reglasEvaluadas.add("R-4s");
  }

  // Identificar reglas no evaluadas en esta etapa.
  const reglasNoEvaluadas = reglasConfiguradas.filter(
    (regla) => !reglasEvaluadas.has(regla),
  );

  // Determinar el resultado de la evaluación parcial.
  const estado = alertas.some((a) => a.tipo === "rechazo")
    ? "rechazo"
    : alertas.length > 0
      ? "advertencia"
      : "sin_alertas";

  return {
    metodo: "Evaluación de Westgard por corrida",

    corridaId: corrida.corridaId,

    totalNiveles: corrida.totalNiveles,

    totalMediciones: corrida.totalMediciones,

    reglasConfiguradas,

    reglasEvaluadas: [...reglasEvaluadas],

    reglasNoEvaluadas,

    medicionesEvaluadas: mediciones,

    alertas,

    estado,

    requiereEvaluacionHistorica: true,

    evaluacionCompleta: false,
  };
}

function obtenerSecuenciasWestgard(mediciones) {
  if (!Array.isArray(mediciones)) {
    throw new Error("Las mediciones deben ser un arreglo.");
  }

  const secuencias = [];
  let secuenciaActual = [];

  for (const medicion of mediciones) {
    if (
      typeof medicion.zScore !== "number" ||
      !Number.isFinite(medicion.zScore)
    ) {
      throw new Error("Todas las mediciones deben tener un zScore válido.");
    }

    const lado =
      compararMedicionWestgard(medicion, 0) > 0
        ? "superior"
        : compararMedicionWestgard(medicion, 0) < 0
          ? "inferior"
          : "media";

    if (lado === "media") {
      if (secuenciaActual.length > 0) {
        secuencias.push(secuenciaActual);
      }

      secuenciaActual = [];
      continue;
    }

    if (secuenciaActual.length === 0) {
      secuenciaActual.push(medicion);
      continue;
    }

    const ultimo = secuenciaActual[secuenciaActual.length - 1];

    const mismoLado =
      (compararMedicionWestgard(ultimo, 0) > 0 && compararMedicionWestgard(medicion, 0) > 0) ||
      (compararMedicionWestgard(ultimo, 0) < 0 && compararMedicionWestgard(medicion, 0) < 0);

    if (mismoLado) {
      secuenciaActual.push(medicion);
    } else {
      secuencias.push(secuenciaActual);
      secuenciaActual = [medicion];
    }
  }

  if (secuenciaActual.length > 0) {
    secuencias.push(secuenciaActual);
  }

  return secuencias;
}

function evaluarRegla22sHistorica(mediciones, corridaIdActual) {
  if (!Array.isArray(mediciones)) {
    throw new Error("Las mediciones deben ser un arreglo.");
  }

  if (!corridaIdActual) {
    throw new Error(
      "Debes proporcionar el identificador de la corrida actual.",
    );
  }

  const alertas = [];

  // Obtener secuencias del mismo lado de la media.
  const secuencias = obtenerSecuenciasWestgard(mediciones);

  for (const secuencia of secuencias) {
    for (let i = 0; i < secuencia.length - 1; i++) {
      const primera = secuencia[i];
      const segunda = secuencia[i + 1];

      // Verificar los identificadores.
      if (!primera.corridaId || !segunda.corridaId) {
        continue;
      }

      // Ambas mediciones deben ser del mismo nivel.
      if (
        !primera.nivelControl ||
        primera.nivelControl !== segunda.nivelControl
      ) {
        continue;
      }

      // Deben pertenecer a corridas diferentes.
      if (String(primera.corridaId) === String(segunda.corridaId)) {
        continue;
      }

      // La segunda medición debe pertenecer
      // a la corrida que estamos evaluando.
      if (String(segunda.corridaId) !== String(corridaIdActual)) {
        continue;
      }

      // Dos resultados superiores a +2 DE.
      const superiores = compararMedicionWestgard(primera, 2) >= 0 && compararMedicionWestgard(segunda, 2) >= 0;

      // Dos resultados inferiores a -2 DE.
      const inferiores = compararMedicionWestgard(primera, -2) <= 0 && compararMedicionWestgard(segunda, -2) <= 0;

      if (superiores || inferiores) {
        alertas.push({
          regla: "2-2s",
          tipo: "rechazo",
          tipoError: "sistemático",
          alcance: "historico",
          corridaId: corridaIdActual,
          nivelControl: segunda.nivelControl,
          lado: superiores ? "superior" : "inferior",
          mediciones: [primera, segunda],
          mensaje:
            "Regla histórica 2-2s detectada entre corridas consecutivas.",
        });
      }
    }
  }

  return {
    regla: "2-2s",
    alcance: "historico",
    corridaId: corridaIdActual,
    detectada: alertas.length > 0,
    alertas,
  };
}

function evaluarRegla41s(mediciones) {
  if (!Array.isArray(mediciones)) {
    throw new Error("Las mediciones deben ser un arreglo.");
  }

  const alertas = [];

  // Obtener secuencias del mismo lado de la media
  const secuencias = obtenerSecuenciasWestgard(mediciones);

  for (const secuencia of secuencias) {
    if (secuencia.length < 4) {
      continue;
    }

    // Evaluar ventanas consecutivas de 4 mediciones
    for (let i = 0; i <= secuencia.length - 4; i++) {
      const grupo = secuencia.slice(i, i + 4);

      const cuatroSuperiores = grupo.every((medicion) => compararMedicionWestgard(medicion, 1) >= 0);

      const cuatroInferiores = grupo.every((medicion) => compararMedicionWestgard(medicion, -1) <= 0);

      if (cuatroSuperiores || cuatroInferiores) {
        alertas.push({
          regla: "4-1s",
          tipo: "rechazo",
          tipoError: "sistemático",
          mediciones: grupo.map((medicion) => ({
            nivelControl: medicion.nivelControl ?? null,
            fecha: medicion.fecha ?? null,
            valor: medicion.valor,
            zScore: medicion.zScore,
          })),
          mensaje:
            "Regla 4-1s detectada: cuatro mediciones " +
            "consecutivas alcanzan o superan 1 DE " +
            "del mismo lado de la media.",
        });
      }
    }
  }

  return {
    metodo: "Regla 4-1s de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0 ? "rechazo" : "sin_alertas_41s",
  };
}

function evaluarRegla10x(mediciones) {
  if (!Array.isArray(mediciones)) {
    throw new Error("Las mediciones deben ser un arreglo.");
  }

  const alertas = [];

  // Obtener secuencias del mismo lado de la media
  const secuencias = obtenerSecuenciasWestgard(mediciones);

  for (const secuencia of secuencias) {
    if (secuencia.length < 10) {
      continue;
    }

    // Evaluar ventanas consecutivas de 10 mediciones
    for (let i = 0; i <= secuencia.length - 10; i++) {
      const grupo = secuencia.slice(i, i + 10);

      const diezSuperiores = grupo.every((medicion) => compararMedicionWestgard(medicion, 0) > 0);

      const diezInferiores = grupo.every((medicion) => compararMedicionWestgard(medicion, 0) < 0);

      if (diezSuperiores || diezInferiores) {
        alertas.push({
          regla: "10x",
          tipo: "rechazo",
          tipoError: "sistemático",
          mediciones: grupo.map((medicion) => ({
            nivelControl: medicion.nivelControl ?? null,
            fecha: medicion.fecha ?? null,
            valor: medicion.valor,
            zScore: medicion.zScore,
          })),
          mensaje:
            "Regla 10x detectada: diez mediciones " +
            "consecutivas se encuentran del mismo " +
            "lado de la media.",
        });
      }
    }
  }

  return {
    metodo: "Regla 10x de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0 ? "rechazo" : "sin_alertas_10x",
  };
}

function prepararHistorialWestgard(mediciones) {
  if (!Array.isArray(mediciones)) {
    throw new Error("El historial debe ser un arreglo.");
  }

  const historial = mediciones.map((medicion, indice) => {
    if (
      typeof medicion.zScore !== "number" ||
      !Number.isFinite(medicion.zScore)
    ) {
      throw new Error(`La medición ${indice + 1} tiene un zScore inválido.`);
    }

    const fecha = new Date(medicion.fecha);

    if (Number.isNaN(fecha.getTime())) {
      throw new Error(`La medición ${indice + 1} tiene una fecha inválida.`);
    }

    return {
      ...medicion,
      fecha: fecha.toISOString(),
    };
  });

  // Ordenar cronológicamente sin modificar el arreglo original
  historial.sort((a, b) => {
    return new Date(a.fecha) - new Date(b.fecha);
  });

  return {
    totalMediciones: historial.length,
    mediciones: historial,
  };
}

function evaluarHistorialWestgard(mediciones) {
  // Validar y ordenar las mediciones
  const historial = prepararHistorialWestgard(mediciones);

  // Evaluar la regla 4-1s
  const resultado41s = evaluarRegla41s(historial.mediciones);

  // Evaluar la regla 10x
  const resultado10x = evaluarRegla10x(historial.mediciones);

  // Reunir las alertas de ambas reglas
  const alertas = [...resultado41s.alertas, ...resultado10x.alertas];

  // Determinar el estado general
  const estado = alertas.some((alerta) => alerta.tipo === "rechazo")
    ? "rechazo"
    : "sin_alertas";

  return {
    metodo: "Evaluación histórica de Westgard",
    totalMediciones: historial.totalMediciones,
    medicionesEvaluadas: historial.mediciones,
    reglasEvaluadas: ["4-1s", "10x"],
    alertas,
    estado,
  };
}

function evaluarRegla31s(mediciones) {
  const alertas = [];

  for (let i = 0; i <= mediciones.length - 3; i++) {
    const grupo = mediciones.slice(i, i + 3);

    const positivos = grupo.every((medicion) => compararMedicionWestgard(medicion, 1) >= 0);

    const negativos = grupo.every((medicion) => compararMedicionWestgard(medicion, -1) <= 0);

    if (positivos || negativos) {
      alertas.push({
        regla: "3-1s",
        tipo: "rechazo",
        tipoError: "sistemático",
        mediciones: grupo,
        mensaje:
          "Regla 3-1s detectada: tres mediciones consecutivas alcanzan o superan 1 DE del mismo lado de la media.",
      });
    }
  }

  return {
    metodo: "Regla 3-1s de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0 ? "rechazo" : "sin_alertas_31s",
  };
}

function evaluarRegla2de3_2s(mediciones) {
  const alertas = [];

  for (let i = 0; i <= mediciones.length - 3; i++) {
    const grupo = mediciones.slice(i, i + 3);

    const positivos = grupo.filter(
    medicion => compararMedicionWestgard(medicion, 2) >= 0
);

const negativos = grupo.filter(
    medicion => compararMedicionWestgard(medicion, -2) <= 0
);

    if (positivos.length >= 2 || negativos.length >= 2) {
      const lado = positivos.length >= 2 ? "superior" : "inferior";

      alertas.push({
        regla: "2de3-2s",
        tipo: "rechazo",
        tipoError: "sistemático",
        lado,
        mediciones: grupo,
        mensaje:
          "Regla 2de3-2s detectada: al menos dos de tres mediciones consecutivas alcanzan o superan 2 DE del mismo lado de la media.",
      });
    }
  }

  return {
    metodo: "Regla 2de3-2s de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0 ? "rechazo" : "sin_alertas_2de3_2s",
  };
}

function obtenerConfiguracionWestgard(totalNiveles, totalMediciones) {
  const configuraciones = {
    // Un nivel y una medición
    "1-1": ["1-3s", "2-2s", "4-1s", "10x"],

    // Un nivel y dos mediciones
    "1-2": ["1-3s", "2-2s", "R-4s", "4-1s", "10x"],

    // Dos niveles y una medición por nivel
    "2-2": ["1-3s", "2-2s", "R-4s", "4-1s", "10x"],

    // Dos niveles y dos mediciones por nivel
    "2-4": ["1-3s", "2-2s", "R-4s", "4-1s", "10x"],

    // Tres niveles y una medición por nivel
    "3-3": ["1-3s", "2de3-2s", "R-4s", "3-1s", "12x"],

    // Tres niveles y dos mediciones por nivel
    "3-6": ["1-3s", "2de3-2s", "R-4s", "3-1s", "12x"],
  };

  const clave = `${totalNiveles}-${totalMediciones}`;

  if (!configuraciones[clave]) {
    throw new Error("Configuración de Westgard no admitida.");
  }

  return {
    totalNiveles,
    totalMediciones,
    reglas: configuraciones[clave],
    advertencia: "1-2s",
  };
}


function obtenerConfiguracionDiariaWestgard(
    totalNiveles,
    totalMediciones
) {

    // Permitir uno, dos o tres niveles.
    if (![1, 2, 3].includes(totalNiveles)) {
        throw new Error(
            "El control diario debe contener 1, 2 o 3 niveles."
        );
    }

    // Permitir una sola medición por nivel.
    if (totalMediciones !== totalNiveles) {
        throw new Error(
            "El control diario requiere una medición por nivel."
        );
    }

    // Reutilizar las configuraciones existentes.
    const configuracion = obtenerConfiguracionWestgard(
        totalNiveles,
        totalMediciones
    );

    return {
        ...configuracion,
        medicionesPorNivel: 1,
        modalidad: "control_diario"
    };
}


function evaluarRegla12x(mediciones) {
  const alertas = [];

  for (let i = 0; i <= mediciones.length - 12; i++) {
    const grupo = mediciones.slice(i, i + 12);

    const positivos = grupo.every((medicion) => compararMedicionWestgard(medicion, 0) > 0);

    const negativos = grupo.every((medicion) => compararMedicionWestgard(medicion, 0) < 0);

    if (positivos || negativos) {
      alertas.push({
        regla: "12x",
        tipo: "rechazo",
        tipoError: "sistemático",
        mediciones: grupo,
        mensaje:
          "Regla 12x detectada: doce mediciones consecutivas se encuentran del mismo lado de la media.",
      });
    }
  }

  return {
    metodo: "Regla 12x de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0 ? "rechazo" : "sin_alertas_12x",
  };
}

function obtenerReglasHistoricasWestgard(totalNiveles, totalMediciones) {
  // Obtener la configuración correspondiente.
  const configuracion = obtenerConfiguracionWestgard(
    totalNiveles,
    totalMediciones,
  );

  // Reglas que pueden requerir mediciones históricas.
  const reglasHistoricasDisponibles = ["2-2s", "4-1s", "10x", "3-1s", "12x"];

  // Seleccionar las reglas históricas correspondientes
  // a la configuración de la corrida.
  const reglas = configuracion.reglas.filter((regla) =>
    reglasHistoricasDisponibles.includes(regla),
  );

  return {
    totalNiveles,
    totalMediciones,
    reglasHistoricas: reglas,
  };
}


function validarOrdenCronologicoWestgard(mediciones) {

    // Validar que exista un historial.
    if (
        !Array.isArray(mediciones) ||
        mediciones.length === 0
    ) {
        throw new Error(
            "Debes proporcionar mediciones para validar el orden cronológico."
        );
    }

    let fechaAnterior = null;

    for (const medicion of mediciones) {

        // Validar que exista una fecha.
        if (
            !medicion ||
            (
                typeof medicion.fecha !== "string" &&
                !(medicion.fecha instanceof Date)
            )
        ) {
            throw new Error(
                "Todas las mediciones deben tener una fecha válida."
            );
        }

        const fecha = new Date(medicion.fecha);

        // Validar que la fecha pueda interpretarse.
        if (!Number.isFinite(fecha.getTime())) {
            throw new Error(
                "Todas las mediciones deben tener una fecha válida."
            );
        }

        // Obtener únicamente la fecha del registro.
        const fechaActual = fecha.toISOString().slice(0, 10);

        // Evitar fechas de calendario inexistentes.
        if (
            typeof medicion.fecha === "string" &&
            medicion.fecha.slice(0, 10) !== fechaActual
        ) {
            throw new Error(
                "La fecha de la medición no es válida."
            );
        }

        // Validar el orden cronológico.
        if (
            fechaAnterior !== null &&
            fechaActual < fechaAnterior
        ) {
            throw new Error(
                "Las mediciones deben estar en orden cronológico ascendente."
            );
        }

        // No permitir dos mediciones del mismo
        // conjunto de control en una misma fecha.
        if (fechaActual === fechaAnterior) {
            throw new Error(
                "Existe más de una medición del mismo conjunto de control en la misma fecha."
            );
        }

        fechaAnterior = fechaActual;
    }

    return true;
}


function validarIdentidadHistorialWestgard(mediciones) {

    // Validar el historial recibido.
    if (!Array.isArray(mediciones) || mediciones.length === 0) {
        throw new Error(
            "Debes proporcionar las mediciones del historial."
        );
    }

    // Campos obligatorios para identificar
    // cada conjunto de control.
    const camposObligatorios = [
        "prueba",
        "nivelControl",
        "lote",
        "equipo",
        "versionParametros"
    ];

    // Validar los campos de todas las mediciones.
    for (const medicion of mediciones) {

        for (const campo of camposObligatorios) {

            if (
                !medicion ||
                typeof medicion[campo] !== "string" ||
                !medicion[campo].trim()
            ) {
                throw new Error(
                    `Todas las mediciones deben proporcionar un valor válido para ${campo}.`
                );
            }
        }
    }

    // Obtener el analito y equipo de referencia.
    const prueba = mediciones[0].prueba;
    const equipo = mediciones[0].equipo;

    const conjuntosPorNivel = new Map();

    for (const medicion of mediciones) {

        // Evitar mezclar diferentes analitos.
        if (medicion.prueba !== prueba) {
            throw new Error(
                "No se pueden mezclar mediciones de diferentes analitos."
            );
        }

        // Evitar mezclar diferentes equipos.
        if (medicion.equipo !== equipo) {
            throw new Error(
                "No se pueden mezclar mediciones de diferentes equipos."
            );
        }

        const nivelControl = medicion.nivelControl;

        // Registrar el conjunto de referencia
        // correspondiente a cada nivel.
        if (!conjuntosPorNivel.has(nivelControl)) {

            conjuntosPorNivel.set(nivelControl, {
                prueba,
                nivelControl,
                lote: medicion.lote,
                equipo,
                versionParametros: medicion.versionParametros
            });

            continue;
        }

        const conjunto = conjuntosPorNivel.get(nivelControl);

        // Validar el lote dentro del mismo nivel.
        if (medicion.lote !== conjunto.lote) {
            throw new Error(
                `No se pueden mezclar diferentes lotes en ${nivelControl}.`
            );
        }

        // Validar la versión de parámetros
        // dentro del mismo nivel.
        if (
            medicion.versionParametros !==
            conjunto.versionParametros
        ) {
            throw new Error(
                `No se pueden mezclar diferentes versiones de parámetros en ${nivelControl}.`
            );
        }
    }

    return {
        prueba,
        equipo,
        totalNiveles: conjuntosPorNivel.size,
        conjuntosControl: Array.from(
            conjuntosPorNivel.values()
        )
    };
}



function agruparHistorialWestgardPorNivel(mediciones) {

    // Validar el historial recibido.
    if (!Array.isArray(mediciones) || mediciones.length === 0) {
        throw new Error(
            "Debes proporcionar las mediciones del historial."
        );
    }

    const grupos = new Map();

    // Recorrer todas las mediciones.
    for (const medicion of mediciones) {

        if (
            !medicion ||
            typeof medicion.nivelControl !== "string" ||
            !medicion.nivelControl.trim() ||
            !medicion.corridaId ||
            !Number.isFinite(medicion.zScore)
        ) {
            throw new Error(
                "Todas las mediciones deben tener un nivel, una corrida y un Z-score válido."
            );
        }

        const nivelControl = medicion.nivelControl;

        // Crear el grupo si todavía no existe.
        if (!grupos.has(nivelControl)) {
            grupos.set(nivelControl, []);
        }

        // Agregar la medición al nivel correspondiente.
        grupos.get(nivelControl).push(medicion);
    }

    const historialPorNivel = [];

    // Validar el orden cronológico de cada nivel.
    for (const [nivelControl, medicionesNivel] of grupos) {

        validarOrdenCronologicoWestgard(medicionesNivel);

        historialPorNivel.push({
            nivelControl,
            totalMediciones: medicionesNivel.length,
            mediciones: medicionesNivel
        });
    }

    return historialPorNivel;
}


function validarIdentificadoresCorridasWestgard(mediciones) {

    if (
        !Array.isArray(mediciones) ||
        mediciones.length === 0
    ) {

        throw new Error(
            "Debes proporcionar mediciones para validar los identificadores de corridas."
        );
    }

    // Almacenar las corridas identificadas.
    const corridas = new Map();

    for (const medicion of mediciones) {

        // Validar la existencia del identificador.
        if (
            !medicion ||
            !medicion.corridaId
        ) {

            throw new Error(
                "Todas las mediciones deben tener un identificador de corrida válido."
            );
        }

        const corridaId =
            String(medicion.corridaId);

        if (!corridaId.trim()) {

            throw new Error(
                "Todas las mediciones deben tener un identificador de corrida válido."
            );
        }

        // Validar el tipo de fecha.
        if (
            typeof medicion.fecha !== "string" &&
            !(medicion.fecha instanceof Date)
        ) {

            throw new Error(
                `La corrida ${corridaId} contiene una fecha inválida.`
            );
        }

        const fecha =
            new Date(medicion.fecha);

        if (!Number.isFinite(fecha.getTime())) {

            throw new Error(
                `La corrida ${corridaId} contiene una fecha inválida.`
            );
        }

        const fechaCorrida =
            fecha.toISOString().slice(0, 10);

        // Registrar una corrida nueva.
        if (!corridas.has(corridaId)) {

            corridas.set(corridaId, {

                corridaId,

                fechaCorrida,

                totalMediciones: 0,

                niveles: new Set()
            });
        }

        const corrida =
            corridas.get(corridaId);

        // Comprobar que el identificador
        // corresponda a una sola fecha.
        if (
            corrida.fechaCorrida !==
            fechaCorrida
        ) {

            throw new Error(
                `La corrida ${corridaId} contiene mediciones de diferentes fechas.`
            );
        }

        // Validar el nivel de control.
        if (
            typeof medicion.nivelControl !== "string" ||
            !medicion.nivelControl.trim()
        ) {

            throw new Error(
                `La corrida ${corridaId} contiene un nivel de control inválido.`
            );
        }

        // Registrar el nivel y la medición.
        corrida.niveles.add(
            medicion.nivelControl
        );

        corrida.totalMediciones++;
    }

    // Preparar el resumen de corridas.
    const corridasValidadas =
        Array.from(corridas.values()).map(
            corrida => ({

                corridaId:
                    corrida.corridaId,

                fechaCorrida:
                    corrida.fechaCorrida,

                totalMediciones:
                    corrida.totalMediciones,

                totalNiveles:
                    corrida.niveles.size,

                niveles:
                    Array.from(corrida.niveles)
            })
        );

    // Ordenar cronológicamente.
    corridasValidadas.sort(
        (a, b) =>
            a.fechaCorrida.localeCompare(
                b.fechaCorrida
            )
    );

    // Identificar fechas que contienen
    // más de una corrida independiente.
    const corridasPorFecha = new Map();

    for (const corrida of corridasValidadas) {

        const cantidad =
            corridasPorFecha.get(
                corrida.fechaCorrida
            ) || 0;

        corridasPorFecha.set(
            corrida.fechaCorrida,
            cantidad + 1
        );
    }

    const fechasConMultiplesCorridas =
        Array.from(corridasPorFecha.entries())
            .filter(
                ([fecha, cantidad]) =>
                    cantidad > 1
            )
            .map(
                ([fecha]) => fecha
            );

    return {

        metodo:
            "Validación de identificadores de corridas de Westgard",

        totalMediciones:
            mediciones.length,

        totalCorridas:
            corridasValidadas.length,

        corridas:
            corridasValidadas,

        fechasConMultiplesCorridas,

        ordenEntreCorridasDeterminado:
            fechasConMultiplesCorridas.length === 0,

        identificadoresValidados:
            true
    };
}


function prepararHistorialMultinivelWestgard(mediciones) {

    // Validar la identidad de los conjuntos de control.
    const identidad =
        validarIdentidadHistorialWestgard(mediciones);

    // Validar los parámetros estadísticos y Z-score.
    const validacionEstadistica =
        validarParametrosEstadisticosWestgard(
            mediciones
        );

    // Agrupar las mediciones por nivel
    // y validar su orden cronológico.
    const historialPorNivel =
        agruparHistorialWestgardPorNivel(mediciones);

    // Validar la cantidad de niveles.
    if (
        ![1, 2, 3].includes(
            identidad.totalNiveles
        )
    ) {

        throw new Error(
            "El historial debe contener entre 1 y 3 niveles de control."
        );
    }

    // NUEVO:
    // Validar la consistencia de los identificadores
    // de todas las corridas históricas.
    const validacionCorridas =
        validarIdentificadoresCorridasWestgard(
            mediciones
        );


    // Validar que exista una sola corrida
    // diaria para el mismo analito y equipo.
    if (
        validacionCorridas
            .fechasConMultiplesCorridas.length > 0
    ) {

        const fechas =
            validacionCorridas
                .fechasConMultiplesCorridas
                .join(", ");

        throw new Error(
            `Solo se permite una corrida diaria por analito y equipo. ` +
            `Se encontraron múltiples corridas de ${identidad.prueba} ` +
            `en las siguientes fechas: ${fechas}.`
        );
    }


    // Preparar el historial de cada nivel.
    const niveles = historialPorNivel.map(grupo => {

        const conjuntoControl =
            identidad.conjuntosControl.find(
                conjunto =>
                    conjunto.nivelControl ===
                    grupo.nivelControl
            );

        if (!conjuntoControl) {

            throw new Error(
                `No se encontró el conjunto de control para ${grupo.nivelControl}.`
            );
        }

        // Obtener los parámetros estadísticos
        // correspondientes al nivel.
        const parametrosObjetivo =
            validacionEstadistica.parametrosPorNivel.find(
                parametro =>
                    parametro.nivelControl ===
                    grupo.nivelControl
            );

        if (!parametrosObjetivo) {

            throw new Error(
                `No se encontraron los parámetros objetivo para ${grupo.nivelControl}.`
            );
        }

        return {

            nivelControl:
                grupo.nivelControl,

            conjuntoControl,

            parametrosObjetivo,

            totalMediciones:
                grupo.totalMediciones,

            fechaInicial:
                grupo.mediciones[0].fecha,

            fechaFinal:
                grupo.mediciones[
                    grupo.mediciones.length - 1
                ].fecha,

            mediciones:
                grupo.mediciones
        };
    });

    return {

        metodo:
            "Preparación histórica multinivel de Westgard",

        prueba:
            identidad.prueba,

        equipo:
            identidad.equipo,

        totalNivelesHistoricos:
            identidad.totalNiveles,

        totalMedicionesHistoricas:
            mediciones.length,

        // NUEVO:
        // Cantidad de corridas históricas.
        totalCorridasHistoricas:
            validacionCorridas.totalCorridas,

        conjuntosControl:
            identidad.conjuntosControl,

        validacionEstadistica,

        // NUEVO:
        // Resultado completo de la validación
        // de identificadores.
        validacionCorridas,

        // NUEVO:
        // Fechas con diferentes corridas.
        fechasConMultiplesCorridas:
            validacionCorridas.fechasConMultiplesCorridas,

        // NUEVO:
        // Indicar si conocemos el orden
        // cronológico entre las corridas.
        ordenEntreCorridasDeterminado:
            validacionCorridas.ordenEntreCorridasDeterminado,

        niveles,

        parametrosValidados:
            validacionEstadistica.parametrosValidados,

        // NUEVO:
        identificadoresValidados:
            validacionCorridas.identificadoresValidados,

        historialValidado:
            true
    };
}




function validarCorridaActualWestgard({
    totalNiveles,
    totalMediciones,
    mediciones,
    corridaIdActual
}) {

    // Validar el identificador de la corrida actual.
    if (!corridaIdActual) {
        throw new Error(
            "Debes proporcionar el identificador de la corrida actual."
        );
    }

    // Obtener la configuración diaria correspondiente.
    const configuracion =
        obtenerConfiguracionDiariaWestgard(
            totalNiveles,
            totalMediciones
        );

    // Preparar y validar el historial multinivel.
    const historial =
        prepararHistorialMultinivelWestgard(mediciones);

    // Identificar las mediciones de la corrida actual.
    const medicionesActuales = mediciones.filter(
        medicion =>
            String(medicion.corridaId) ===
            String(corridaIdActual)
    );

    // Verificar que exista la corrida actual.
    if (medicionesActuales.length === 0) {
        throw new Error(
            "No se encontraron mediciones de la corrida actual."
        );
    }

    // Validar la cantidad de mediciones.
    if (medicionesActuales.length !== totalMediciones) {
        throw new Error(
            "Las mediciones de la corrida actual no coinciden con la configuración."
        );
    }

    // Identificar los niveles de la corrida actual.
    const nivelesActuales = [
        ...new Set(
            medicionesActuales.map(
                medicion => medicion.nivelControl
            )
        )
    ];

    // Validar la cantidad de niveles.
    if (nivelesActuales.length !== totalNiveles) {
        throw new Error(
            "Los niveles de la corrida actual no coinciden con la configuración."
        );
    }

    // Obtener la fecha de la corrida actual.
    const fechaCorrida = new Date(
        medicionesActuales[0].fecha
    ).toISOString().slice(0, 10);

    // Todas las mediciones actuales deben
    // pertenecer a la misma fecha.
    const fechasDiferentes = medicionesActuales.some(
        medicion =>
            new Date(medicion.fecha)
                .toISOString()
                .slice(0, 10) !== fechaCorrida
    );

    if (fechasDiferentes) {
        throw new Error(
            "Todas las mediciones de la corrida actual deben pertenecer a la misma fecha."
        );
    }

    // Separar las mediciones anteriores.
    const medicionesAnteriores = mediciones.filter(
        medicion =>
            String(medicion.corridaId) !==
            String(corridaIdActual)
    );

    // Evitar utilizar mediciones futuras o de
    // otras corridas de la misma fecha.
    const historialInvalido = medicionesAnteriores.some(
        medicion =>
            new Date(medicion.fecha)
                .toISOString()
                .slice(0, 10) >= fechaCorrida
    );

    if (historialInvalido) {
        throw new Error(
            "El historial contiene mediciones de otras corridas en la fecha actual o en fechas posteriores."
        );
    }

    return {
        metodo: "Validación de corrida actual de Westgard",
        corridaId: corridaIdActual,
        fechaCorrida,
        prueba: historial.prueba,
        equipo: historial.equipo,
        configuracion,
        totalNiveles,
        totalMediciones,
        nivelesActuales,
        medicionesActuales,
        medicionesAnteriores,
        totalMedicionesAnteriores:
            medicionesAnteriores.length,
        historialPorNivel: historial.niveles,
        corridaValidada: true
    };
}


function obtenerReglasHistoricasPorNivelWestgard(
    totalNiveles,
    totalMediciones
) {

    // Obtener la configuración de la corrida actual.
    const configuracion =
        obtenerConfiguracionDiariaWestgard(
            totalNiveles,
            totalMediciones
        );

    // Definir las reglas que pueden evaluarse
    // históricamente dentro de un mismo nivel.
    const reglasHistoricasDisponibles = [
        "2-2s",
        "4-1s",
        "10x",
        "3-1s",
        "12x"
    ];

    // Definir las mediciones necesarias
    // para evaluar cada regla.
    const medicionesRequeridas = {
        "2-2s": 2,
        "4-1s": 4,
        "10x": 10,
        "3-1s": 3,
        "12x": 12
    };

    // Seleccionar las reglas correspondientes
    // a la configuración de la corrida actual.
    const reglasHistoricas =
        configuracion.reglas.filter(
            regla =>
                reglasHistoricasDisponibles.includes(regla)
        );

    // Preparar el detalle de cada regla.
    const detalleReglas = reglasHistoricas.map(
        regla => ({
            regla,
            medicionesRequeridas:
                medicionesRequeridas[regla],
            alcance: "historico_por_nivel"
        })
    );

    return {
        metodo: "Configuración histórica por nivel de Westgard",
        totalNiveles,
        totalMediciones,
        medicionesPorNivel:
            configuracion.medicionesPorNivel,
        reglasHistoricas,
        detalleReglas
    };
}


function evaluarHistorialPorNivelWestgard({
    totalNiveles,
    totalMediciones,
    mediciones,
    corridaIdActual
}) {

    // Validar la corrida actual y su historial.
    const corrida = validarCorridaActualWestgard({
        totalNiveles,
        totalMediciones,
        mediciones,
        corridaIdActual
    });

    // Obtener las reglas históricas correspondientes
    // a la configuración de la corrida actual.
    const configuracion =
        obtenerReglasHistoricasPorNivelWestgard(
            totalNiveles,
            totalMediciones
        );

    // Asociar cada regla con su función estadística.
    const funciones = {
        "2-2s": evaluarRegla22sHistorica,
        "4-1s": evaluarRegla41s,
        "10x": evaluarRegla10x,
        "3-1s": evaluarRegla31s,
        "12x": evaluarRegla12x
    };

    const resultadosPorNivel = [];
    const alertasGenerales = [];

    // Evaluar solamente los niveles procesados
    // en la corrida actual.
    for (const nivelControl of corrida.nivelesActuales) {

        const grupo = corrida.historialPorNivel.find(
            nivel => nivel.nivelControl === nivelControl
        );

        if (!grupo) {
            throw new Error(
                `No se encontró el historial de ${nivelControl}.`
            );
        }

        const historialNivel = grupo.mediciones;

        const alertasNivel = [];
        const reglasEvaluadas = [];
        const reglasNoEvaluadas = [];
        const detalleReglas = [];

        // Evaluar las reglas correspondientes al nivel.
        for (const detalle of configuracion.detalleReglas) {

            const regla = detalle.regla;

            const minimo =
                detalle.medicionesRequeridas;

            // Comprobar si existe suficiente historial.
            if (historialNivel.length < minimo) {

                reglasNoEvaluadas.push(regla);

                detalleReglas.push({
                    regla,
                    estado: "sin_ventana_historica",
                    medicionesRequeridas: minimo,
                    medicionesDisponibles:
                        historialNivel.length,
                    medicionesFaltantes:
                        minimo - historialNivel.length,
                    alcance: "historico_por_nivel"
                });

                continue;
            }

            // Obtener únicamente las últimas mediciones
            // necesarias para evaluar la regla.
            const ventana = historialNivel.slice(-minimo);

            // Garantizar que la ventana termine
            // en la corrida actual.
            const ultimaMedicion =
                ventana[ventana.length - 1];

            if (
                String(ultimaMedicion.corridaId) !==
                String(corridaIdActual)
            ) {
                throw new Error(
                    `La ventana histórica de ${nivelControl} no termina en la corrida actual.`
                );
            }

            // Ejecutar la función estadística.
            const resultado = funciones[regla](
                ventana,
                corridaIdActual
            );

            // Complementar las alertas con la identidad
            // del conjunto de control evaluado.
            const alertasRegla = resultado.alertas.map(
                alerta => ({
                    ...alerta,
                    alcance: "historico_por_nivel",
                    corridaId: corridaIdActual,
                    nivelControl,
                    conjuntoControl: grupo.conjuntoControl,
                    mediciones: ventana
                })
            );

            reglasEvaluadas.push(regla);

            alertasNivel.push(...alertasRegla);

            detalleReglas.push({
                regla,
                estado:
                    alertasRegla.length > 0
                        ? "rechazo"
                        : "sin_alertas",
                medicionesRequeridas: minimo,
                medicionesDisponibles:
                    historialNivel.length,
                medicionesFaltantes: 0,
                ventanasEvaluadas: 1,
                alcance: "historico_por_nivel"
            });
        }

        // Determinar el estado histórico del nivel.
        const estadoNivel =
            alertasNivel.length > 0
                ? "rechazo"
                : reglasNoEvaluadas.length > 0
                    ? "evaluacion_parcial"
                    : "sin_alertas";

        resultadosPorNivel.push({
            nivelControl,
            conjuntoControl: grupo.conjuntoControl,
            totalMedicionesHistoricas:
                historialNivel.length,
            reglasConfiguradas:
                configuracion.reglasHistoricas,
            reglasEvaluadas,
            reglasNoEvaluadas,
            detalleReglas,
            alertas: alertasNivel,
            estado: estadoNivel,
            evaluacionCompleta:
                reglasNoEvaluadas.length === 0
        });

        alertasGenerales.push(...alertasNivel);
    }

    // Comprobar si todos los niveles completaron
    // sus evaluaciones históricas independientes.
    const evaluacionCompleta =
        resultadosPorNivel.every(
            nivel => nivel.evaluacionCompleta
        );

    // Determinar el resultado histórico general.
    const estadoGeneral =
        alertasGenerales.length > 0
            ? "rechazo"
            : !evaluacionCompleta
                ? "evaluacion_parcial"
                : "sin_alertas";

    return {
        metodo: "Evaluación histórica independiente por nivel de Westgard",
        alcance: "historico_por_nivel",
        corridaId: corridaIdActual,
        fechaCorrida: corrida.fechaCorrida,
        prueba: corrida.prueba,
        equipo: corrida.equipo,
        totalNiveles,
        totalMediciones,
        nivelesEvaluados: corrida.nivelesActuales,
        reglasConfiguradas:
            configuracion.reglasHistoricas,
        resultadosPorNivel,
        totalAlertas: alertasGenerales.length,
        alertas: alertasGenerales,
        estado: estadoGeneral,
        evaluacionCompleta
    };
}


function agruparHistorialWestgardPorCorrida(mediciones) {

    // Validar la identidad y el historial por nivel.
    const historial =
        prepararHistorialMultinivelWestgard(mediciones);

    const grupos = new Map();

    for (const medicion of mediciones) {

        const corridaId = String(medicion.corridaId);

        const fecha = new Date(medicion.fecha)
            .toISOString()
            .slice(0, 10);

        // Crear la corrida si todavía no existe.
        if (!grupos.has(corridaId)) {

            grupos.set(corridaId, {
                corridaId,
                fechaCorrida: fecha,
                prueba: medicion.prueba,
                equipo: medicion.equipo,
                mediciones: []
            });
        }

        const corrida = grupos.get(corridaId);

        // Una corrida no puede contener
        // mediciones de diferentes fechas.
        if (corrida.fechaCorrida !== fecha) {

            throw new Error(
                `La corrida ${corridaId} contiene mediciones de diferentes fechas.`
            );
        }

        // Agregar la medición a su corrida.
        corrida.mediciones.push(medicion);
    }

    const corridas = [];

    for (const corrida of grupos.values()) {

        const niveles = [
            ...new Set(
                corrida.mediciones.map(
                    medicion => medicion.nivelControl
                )
            )
        ];

        const totalNiveles = niveles.length;

        const totalMediciones =
            corrida.mediciones.length;

        // Validar la configuración diaria.
        const configuracion =
            obtenerConfiguracionDiariaWestgard(
                totalNiveles,
                totalMediciones
            );

        corridas.push({
            ...corrida,
            niveles,
            totalNiveles,
            totalMediciones,
            configuracion
        });
    }

    // Organizar las corridas por fecha ascendente.
    corridas.sort(
        (a, b) =>
            a.fechaCorrida.localeCompare(b.fechaCorrida)
    );

    // Identificar fechas con más de una corrida.
    const corridasPorFecha = new Map();

    for (const corrida of corridas) {

        const fecha = corrida.fechaCorrida;

        const cantidad =
            corridasPorFecha.get(fecha) || 0;

        corridasPorFecha.set(fecha, cantidad + 1);
    }

    const fechasConMultiplesCorridas = [
        ...corridasPorFecha.entries()
    ]
        .filter(([fecha, cantidad]) => cantidad > 1)
        .map(([fecha]) => fecha);

    return {
        metodo: "Agrupación histórica por corrida de Westgard",
        prueba: historial.prueba,
        equipo: historial.equipo,
        totalCorridas: corridas.length,
        totalMediciones: mediciones.length,
        conjuntosControl: historial.conjuntosControl,
        fechasConMultiplesCorridas,
        ordenEntreCorridasDeterminado:
            fechasConMultiplesCorridas.length === 0,
        corridas,
        historialAgrupado: true
    };
}


function prepararVentanasCombinadasWestgard({
    totalNiveles,
    totalMediciones,
    mediciones,
    corridaIdActual
}) {

    // Validar la corrida actual.
    const corridaActual =
        validarCorridaActualWestgard({
            totalNiveles,
            totalMediciones,
            mediciones,
            corridaIdActual
        });

    // Agrupar el historial por corrida.
    const historial =
        agruparHistorialWestgardPorCorrida(
            mediciones
        );

    // Configuraciones de ventanas combinadas.
    const configuraciones = {
        1: [],
        2: [
            {
                regla: "4-1s",
                corridasRequeridas: 2,
                medicionesRequeridas: 4
            },
            {
                regla: "10x",
                corridasRequeridas: 5,
                medicionesRequeridas: 10
            }
        ],
        3: [
            {
                regla: "3-1s",
                corridasRequeridas: 1,
                medicionesRequeridas: 3
            },
            {
                regla: "12x",
                corridasRequeridas: 4,
                medicionesRequeridas: 12
            }
        ]
    };

    const reglasCombinadas =
        configuraciones[totalNiveles].filter(
            detalle =>
                corridaActual.configuracion.reglas
                    .includes(detalle.regla)
        );

    // Identificar los niveles actuales.
    const nivelesActuales =
        [...corridaActual.nivelesActuales].sort();

    const ventanasDisponibles = [];
    const ventanasNoDisponibles = [];

    // Preparar una ventana para cada regla.
    for (const detalle of reglasCombinadas) {

        const corridasRequeridas =
            detalle.corridasRequeridas;

        // Tomar las últimas corridas sin omitir
        // corridas intermedias.
        const corridasVentana =
            historial.corridas.slice(
                -corridasRequeridas
            );

        const medicionesDisponibles =
            corridasVentana.reduce(
                (total, corrida) =>
                    total + corrida.totalMediciones,
                0
            );

        const datosVentana = {
            regla: detalle.regla,
            alcance:
                corridasRequeridas === 1
                    ? "combinado_intracorrida"
                    : "historico_combinado",
            corridasRequeridas,
            medicionesRequeridas:
                detalle.medicionesRequeridas,
            corridasDisponibles:
                corridasVentana.length,
            medicionesDisponibles
        };

        // Comprobar si existen suficientes corridas.
        if (
            corridasVentana.length <
            corridasRequeridas
        ) {

            ventanasNoDisponibles.push({
                ...datosVentana,
                estado: "historial_insuficiente",
                corridasFaltantes:
                    corridasRequeridas -
                    corridasVentana.length
            });

            continue;
        }

        // Comprobar que la ventana termine
        // en la corrida actual.
        const ultimaCorrida =
            corridasVentana[
                corridasVentana.length - 1
            ];

        if (
            ultimaCorrida.corridaId !==
            String(corridaIdActual)
        ) {
            throw new Error(
                "La ventana combinada debe terminar en la corrida actual."
            );
        }

        // Comprobar que no existan corridas
        // con orden cronológico indeterminado
        // dentro de las fechas de la ventana.
        const fechaInicial =
            corridasVentana[0].fechaCorrida;

        const fechaFinal =
            ultimaCorrida.fechaCorrida;

        const ordenIndeterminado =
            historial.fechasConMultiplesCorridas.some(
                fecha =>
                    fecha >= fechaInicial &&
                    fecha <= fechaFinal
            );

        if (ordenIndeterminado) {

            ventanasNoDisponibles.push({
                ...datosVentana,
                estado: "orden_indeterminado"
            });

            continue;
        }

        // Verificar que todas las corridas
        // tengan exactamente los mismos niveles.
        const nivelesCompatibles =
            corridasVentana.every(corrida => {

                const nivelesCorrida =
                    [...corrida.niveles].sort();

                return (
                    corrida.totalNiveles ===
                        totalNiveles &&
                    corrida.totalMediciones ===
                        totalMediciones &&
                    JSON.stringify(nivelesCorrida) ===
                        JSON.stringify(nivelesActuales)
                );
            });

        if (!nivelesCompatibles) {

            ventanasNoDisponibles.push({
                ...datosVentana,
                estado: "configuracion_incompatible"
            });

            continue;
        }

        // Reunir las mediciones de las corridas.
        const medicionesVentana =
            corridasVentana.flatMap(
                corrida => corrida.mediciones
            );

        if (
            medicionesVentana.length !==
            detalle.medicionesRequeridas
        ) {
            throw new Error(
                "La cantidad de mediciones de la ventana combinada no es correcta."
            );
        }

        // Registrar la ventana disponible.
        ventanasDisponibles.push({
            ...datosVentana,
            estado: "disponible",
            fechaInicial,
            fechaFinal,
            niveles: nivelesActuales,
            corridas: corridasVentana.map(
                corrida => ({
                    corridaId: corrida.corridaId,
                    fechaCorrida:
                        corrida.fechaCorrida,
                    niveles: corrida.niveles
                })
            ),
            mediciones: medicionesVentana
        });
    }

    return {
        metodo: "Preparación de ventanas combinadas de Westgard",
        corridaId: corridaIdActual,
        fechaCorrida: corridaActual.fechaCorrida,
        prueba: corridaActual.prueba,
        equipo: corridaActual.equipo,
        totalNiveles,
        totalMediciones,
        nivelesActuales,
        totalCorridasHistoricas:
            historial.totalCorridas,
        reglasCombinadas:
            reglasCombinadas.map(
                detalle => detalle.regla
            ),
        ventanasDisponibles,
        ventanasNoDisponibles,
        totalVentanasDisponibles:
            ventanasDisponibles.length,
        totalVentanasNoDisponibles:
            ventanasNoDisponibles.length,
        requiereEvaluacionCombinada:
            reglasCombinadas.length > 0,
        preparacionCompleta:
            ventanasNoDisponibles.length === 0
    };
}


function evaluarHistorialCombinadoWestgard({
    totalNiveles,
    totalMediciones,
    mediciones,
    corridaIdActual
}) {

    // Preparar las ventanas estadísticas.
    const preparacion =
        prepararVentanasCombinadasWestgard({
            totalNiveles,
            totalMediciones,
            mediciones,
            corridaIdActual
        });

    // Límites estadísticos de cada regla.
    const criterios = {
        "4-1s": {
            limite: 1,
            inclusivo: true
        },
        "10x": {
            limite: 0,
            inclusivo: false
        },
        "3-1s": {
            limite: 1,
            inclusivo: true
        },
        "12x": {
            limite: 0,
            inclusivo: false
        }
    };

    const alertas = [];
    const reglasEvaluadas = [];
    const reglasNoEvaluadas = [];
    const detalleReglas = [];

    // Evaluar cada ventana disponible.
    for (
        const ventana of
        preparacion.ventanasDisponibles
    ) {

        const regla = ventana.regla;
        const criterio = criterios[regla];

        if (!criterio) {

            throw new Error(
                `No existe un criterio estadístico para la regla ${regla}.`
            );
        }

        const medicionesVentana =
            ventana.mediciones;

        // Validar las mediciones de la ventana.
        if (
            medicionesVentana.length !==
                ventana.medicionesRequeridas ||
            medicionesVentana.some(
                medicion =>
                    !Number.isFinite(medicion.zScore)
            )
        ) {

            throw new Error(
                `La ventana de la regla ${regla} contiene mediciones inválidas.`
            );
        }

        // Comprobar el lado superior.
        const superiores =
            medicionesVentana.every(medicion => {

                return criterio.inclusivo
                    ? compararMedicionWestgard(medicion, criterio.limite) >= 0
                    : compararMedicionWestgard(medicion, criterio.limite) > 0;
            });

        // Comprobar el lado inferior.
        const inferiores =
            medicionesVentana.every(medicion => {

                return criterio.inclusivo
                    ? compararMedicionWestgard(medicion, -criterio.limite) <= 0
                    : compararMedicionWestgard(medicion, -criterio.limite) < 0;
            });

        const detectada =
            superiores || inferiores;

        const lado = superiores
            ? "superior"
            : inferiores
                ? "inferior"
                : null;

        reglasEvaluadas.push(regla);

        // Generar una alerta si existe infracción.
        if (detectada) {

            const referencia =
                criterio.limite === 0
                    ? "la media"
                    : lado === "superior"
                        ? "+1 DE"
                        : "-1 DE";

            const direccion =
                lado === "superior"
                    ? "superior"
                    : "inferior";

            const mensaje =
                `Regla combinada ${regla} detectada: ` +
                `${medicionesVentana.length} mediciones ` +
                `en el lado ${direccion} respecto a ` +
                `${referencia}, cumpliendo el límite de la regla.`;

            alertas.push({
                regla,
                tipo: "rechazo",
                tipoError: "sistemático",
                alcance: ventana.alcance,
                corridaId: corridaIdActual,
                prueba: preparacion.prueba,
                equipo: preparacion.equipo,
                nivelesControl: ventana.niveles,
                lado,
                limiteZ: criterio.limite,
                limiteInclusivo: criterio.inclusivo,
                fechaInicial: ventana.fechaInicial,
                fechaFinal: ventana.fechaFinal,
                totalCorridas: ventana.corridas.length,
                totalMediciones:
                    medicionesVentana.length,
                corridas: ventana.corridas,
                mediciones: medicionesVentana,
                mensaje
            });
        }

        // Documentar el resultado de la regla.
        detalleReglas.push({
            regla,
            alcance: ventana.alcance,
            estado: detectada
                ? "rechazo"
                : "sin_alertas",
            detectada,
            lado,
            limiteZ: criterio.limite,
            limiteInclusivo: criterio.inclusivo,
            corridasRequeridas:
                ventana.corridasRequeridas,
            medicionesRequeridas:
                ventana.medicionesRequeridas,
            corridasEvaluadas:
                ventana.corridas.length,
            medicionesEvaluadas:
                medicionesVentana.length,
            ventanasEvaluadas: 1,
            fechaInicial: ventana.fechaInicial,
            fechaFinal: ventana.fechaFinal
        });
    }

    // Documentar las reglas que todavía
    // no pueden evaluarse.
    for (
        const ventana of
        preparacion.ventanasNoDisponibles
    ) {

        reglasNoEvaluadas.push(ventana.regla);

        detalleReglas.push({
            ...ventana,
            detectada: null,
            lado: null,
            ventanasEvaluadas: 0
        });
    }

    // Mantener el orden de las reglas configuradas.
    detalleReglas.sort(
        (a, b) =>
            preparacion.reglasCombinadas.indexOf(a.regla) -
            preparacion.reglasCombinadas.indexOf(b.regla)
    );

    // Determinar si la evaluación está completa.
    const evaluacionCompleta =
        reglasNoEvaluadas.length === 0;

    // Determinar el estado general.
    let estado;

    if (alertas.length > 0) {

        estado = "rechazo";

    } else if (
        !preparacion.requiereEvaluacionCombinada
    ) {

        estado = "no_aplica";

    } else if (!evaluacionCompleta) {

        estado = "evaluacion_parcial";

    } else {

        estado = "sin_alertas";
    }

    return {
        metodo:
            "Evaluación estadística combinada de Westgard",

        alcance: "combinado",

        corridaId: corridaIdActual,

        fechaCorrida:
            preparacion.fechaCorrida,

        prueba: preparacion.prueba,

        equipo: preparacion.equipo,

        totalNiveles,

        totalMediciones,

        nivelesEvaluados:
            preparacion.nivelesActuales,

        totalCorridasHistoricas:
            preparacion.totalCorridasHistoricas,

        reglasConfiguradas:
            preparacion.reglasCombinadas,

        reglasEvaluadas,

        reglasNoEvaluadas,

        detalleReglas,

        totalAlertas: alertas.length,

        alertas,

        requiereEvaluacionCombinada:
            preparacion.requiereEvaluacionCombinada,

        estado,

        evaluacionCompleta
    };
}


function validarParametrosEstadisticosWestgard(mediciones) {

    if (
        !Array.isArray(mediciones) ||
        mediciones.length === 0
    ) {
        throw new Error(
            "Debes proporcionar mediciones para validar los parámetros estadísticos."
        );
    }

    // Tolerancia para pequeñas diferencias
    // de precisión numérica.
    const tolerancia = 0.00000001;

    const parametrosPorNivel = new Map();

    for (const medicion of mediciones) {

        if (
            !medicion ||
            typeof medicion.nivelControl !== "string" ||
            !medicion.nivelControl.trim()
        ) {
            throw new Error(
                "Todas las mediciones deben tener un nivel de control válido."
            );
        }

        const {
            nivelControl,
            valor,
            mediaObjetivo,
            desviacionEstandarObjetivo,
            zScore
        } = medicion;

        // Validar el valor de la medición.
        if (!Number.isFinite(valor)) {

            throw new Error(
                `El valor de la medición de ${nivelControl} no es válido.`
            );
        }

        // Validar la media objetivo.
        if (!Number.isFinite(mediaObjetivo)) {

            throw new Error(
                `La media objetivo de ${nivelControl} no es válida.`
            );
        }

        // Validar la desviación estándar objetivo.
        if (
            !Number.isFinite(
                desviacionEstandarObjetivo
            ) ||
            desviacionEstandarObjetivo <= 0
        ) {

            throw new Error(
                `La desviación estándar objetivo de ${nivelControl} debe ser mayor que cero.`
            );
        }

        // Validar el Z-score recibido.
        if (!Number.isFinite(zScore)) {

            throw new Error(
                `El Z-score de ${nivelControl} no es válido.`
            );
        }

        // Calcular nuevamente el Z-score.
        const zScoreCalculado =
            calcularZScoreDecimal(valor, mediaObjetivo, desviacionEstandarObjetivo).toNumber();

        if (!Number.isFinite(zScoreCalculado)) {

            throw new Error(
                `No fue posible calcular un Z-score válido para ${nivelControl}.`
            );
        }

        // Comprobar la diferencia entre
        // el Z-score recibido y el calculado.
        const diferencia = Math.abs(
            zScore - zScoreCalculado
        );

        if (diferencia > tolerancia) {

            throw new Error(
                `El Z-score de ${nivelControl} no coincide con sus parámetros objetivo.`
            );
        }

        // El Z-score recibido es informativo: la clasificación se realiza
        // exclusivamente con valor, media y DE originales. La tolerancia
        // anterior solo comprueba consistencia numérica, no decide alertas.

        // Registrar los parámetros del nivel.
        if (!parametrosPorNivel.has(nivelControl)) {

            parametrosPorNivel.set(nivelControl, {
                nivelControl,
                mediaObjetivo,
                desviacionEstandarObjetivo
            });

            continue;
        }

        const parametros =
            parametrosPorNivel.get(nivelControl);

        // Comprobar que no cambie la media
        // dentro del mismo conjunto de control.
        if (
            parametros.mediaObjetivo !==
            mediaObjetivo
        ) {

            throw new Error(
                `No se pueden mezclar diferentes medias objetivo en ${nivelControl}.`
            );
        }

        // Comprobar que no cambie la DE.
        if (
            parametros.desviacionEstandarObjetivo !==
            desviacionEstandarObjetivo
        ) {

            throw new Error(
                `No se pueden mezclar diferentes desviaciones estándar objetivo en ${nivelControl}.`
            );
        }
    }

    return {
        metodo:
            "Validación de parámetros estadísticos de Westgard",

        totalMediciones:
            mediciones.length,

        totalNiveles:
            parametrosPorNivel.size,

        parametrosPorNivel:
            Array.from(
                parametrosPorNivel.values()
            ),

        toleranciaZScore:
            tolerancia,

        parametrosValidados:
            true
    };
}


function evaluarWestgardAutomatico({
    mediciones,
    corridaIdActual
}) {

    // 1. Validar las mediciones recibidas.
    if (
        !Array.isArray(mediciones) ||
        mediciones.length === 0
    ) {

        throw new Error(
            "Debes proporcionar mediciones para la evaluación automática de Westgard."
        );
    }

    // Validar el identificador de la corrida.
    if (
        !corridaIdActual ||
        !String(corridaIdActual).trim()
    ) {

        throw new Error(
            "Debes proporcionar el identificador de la corrida actual."
        );
    }

    // 2. Validar el historial completo.
    const historial =
        prepararHistorialMultinivelWestgard(
            mediciones
        );

    // 3. Normalizar los Z-score utilizando
    // los parámetros objetivo originales.
    const medicionesNormalizadas =
        mediciones.map(medicion => ({

            ...medicion,

            corridaId:
                String(medicion.corridaId),

            zScore:
                obtenerZDecimalWestgard(medicion).toNumber()
        }));

    const identificadorActual =
        String(corridaIdActual);

    // 4. Identificar las mediciones
    // correspondientes a la corrida actual.
    const medicionesActuales =
        medicionesNormalizadas.filter(
            medicion =>
                medicion.corridaId ===
                identificadorActual
        );

    if (medicionesActuales.length === 0) {

        throw new Error(
            "No se encontraron mediciones de la corrida actual."
        );
    }

    // 5. Identificar automáticamente
    // los niveles procesados.
    const nivelesActuales = [
        ...new Set(
            medicionesActuales.map(
                medicion =>
                    medicion.nivelControl
            )
        )
    ];

    const totalNiveles =
        nivelesActuales.length;

    const totalMediciones =
        medicionesActuales.length;

    // 6. Preparar los datos generales
    // de la evaluación.
    const datosEvaluacion = {

        totalNiveles,

        totalMediciones,

        mediciones:
            medicionesNormalizadas,

        corridaIdActual:
            identificadorActual
    };

    // 7. Validar la corrida actual.
    const corridaValidada =
        validarCorridaActualWestgard(
            datosEvaluacion
        );

    // Obtener la configuración automática.
    const configuracion =
        corridaValidada.configuracion;

    // 8. Evaluar las reglas intracorrida.
    const evaluacionIntracorrida =
        evaluarCorridaWestgard({

            corridaId:
                identificadorActual,

            totalNiveles,

            totalMediciones,

            mediciones:
                corridaValidada.medicionesActuales
        });

    // 9. Evaluar las reglas históricas
    // independientes por nivel.
    const evaluacionIndependiente =
        evaluarHistorialPorNivelWestgard(
            datosEvaluacion
        );

    // 10. Evaluar las reglas combinadas.
    const evaluacionCombinada =
        evaluarHistorialCombinadoWestgard(
            datosEvaluacion
        );

    // 11. Consolidar todas las alertas.
    const consolidacion =
        consolidarAlertasWestgard({

            evaluacionIntracorrida,

            evaluacionIndependiente,

            evaluacionCombinada
        });

    // 12. Obtener las reglas configuradas.
    const reglasConfiguradas = [
        ...new Set([
            configuracion.advertencia,
            ...configuracion.reglas
        ])
    ];

    // Comprobar que las alertas correspondan
    // a la configuración de la corrida.
    for (const alerta of consolidacion.alertas) {

        if (
            !reglasConfiguradas.includes(
                alerta.regla
            )
        ) {

            throw new Error(
                `La regla ${alerta.regla} no pertenece a la configuración de la corrida actual.`
            );
        }
    }

    // 13. Identificar las reglas evaluadas.
    const reglasEvaluadas = [
        ...new Set([

            ...evaluacionIntracorrida
                .reglasEvaluadas,

            ...evaluacionIndependiente
                .resultadosPorNivel
                .flatMap(
                    nivel =>
                        nivel.reglasEvaluadas
                ),

            ...evaluacionCombinada
                .reglasEvaluadas
        ])
    ];

    // 14. Identificar las reglas pendientes
    // según el alcance de la evaluación.
    const evaluacionesPendientes = [];

    // Reglas intracorrida aplicables.
    const reglasIntracorrida = [
        "1-2s",
        "1-3s"
    ];

    if (totalNiveles === 2) {

        reglasIntracorrida.push(
            "2-2s",
            "R-4s"
        );
    }

    if (totalNiveles === 3) {

        reglasIntracorrida.push(
            "2de3-2s",
            "R-4s"
        );
    }

    const reglasIntracorridaAplicables =
        reglasIntracorrida.filter(
            regla =>
                reglasConfiguradas.includes(regla)
        );

    for (
        const regla of reglasIntracorridaAplicables
    ) {

        if (
            !evaluacionIntracorrida
                .reglasEvaluadas.includes(regla)
        ) {

            evaluacionesPendientes.push({

                regla,

                origen:
                    "intracorrida",

                motivo:
                    "regla_no_evaluada"
            });
        }
    }

    // Reglas pendientes por nivel.
    for (
        const nivel of evaluacionIndependiente
            .resultadosPorNivel
    ) {

        for (
            const detalle of nivel.detalleReglas
        ) {

            if (
                nivel.reglasNoEvaluadas.includes(
                    detalle.regla
                )
            ) {

                evaluacionesPendientes.push({

                    ...detalle,

                    origen:
                        "historico_por_nivel",

                    nivelControl:
                        nivel.nivelControl,

                    motivo:
                        detalle.estado
                });
            }
        }
    }

    // Reglas combinadas pendientes.
    for (
        const detalle of evaluacionCombinada
            .detalleReglas
    ) {

        if (
            evaluacionCombinada
                .reglasNoEvaluadas.includes(
                    detalle.regla
                )
        ) {

            evaluacionesPendientes.push({

                ...detalle,

                origen:
                    "combinado",

                motivo:
                    detalle.estado
            });
        }
    }

    // Comprobar que ninguna regla configurada
    // haya quedado fuera de las evaluaciones.
    for (const regla of reglasConfiguradas) {

        const fueEvaluada =
            reglasEvaluadas.includes(regla);

        const estaPendiente =
            evaluacionesPendientes.some(
                pendiente =>
                    pendiente.regla === regla
            );

        if (!fueEvaluada && !estaPendiente) {

            evaluacionesPendientes.push({

                regla,

                origen:
                    "motor_general",

                motivo:
                    "regla_sin_evaluacion"
            });
        }
    }

    // Obtener las reglas pendientes distintas.
    const reglasPendientes = [
        ...new Set(
            evaluacionesPendientes.map(
                pendiente =>
                    pendiente.regla
            )
        )
    ];

    // 15. Determinar si todas las
    // evaluaciones aplicables están completas.
    const evaluacionCompleta =

        evaluacionesPendientes.length === 0 &&

        evaluacionIndependiente
            .evaluacionCompleta === true &&

        evaluacionCombinada
            .evaluacionCompleta === true;

    // 16. Determinar el estado general.
    const estadoGeneral =
        determinarEstadoGeneralWestgard({

            alertas:
                consolidacion.alertas,

            evaluacionCompleta
        });

    // 17. Generar la respuesta general.
    return {

        metodo:
            "Evaluación automática general de Westgard",

        versionEvaluacion:
            "1.0.0-desarrollo",

        corridaId:
            identificadorActual,

        fechaCorrida:
            corridaValidada.fechaCorrida,

        prueba:
            historial.prueba,

        equipo:
            historial.equipo,

        modalidad:
            "control_diario",

        totalNiveles,

        totalMediciones,

        nivelesEvaluados:
            nivelesActuales,

        totalNivelesHistoricos:
            historial.totalNivelesHistoricos,

        totalMedicionesHistoricas:
            historial.totalMedicionesHistoricas,

        totalCorridasHistoricas:
            historial.totalCorridasHistoricas,

        configuracion,

        conjuntosControl:
            historial.conjuntosControl,

        parametrosUtilizados:
            historial.validacionEstadistica
                .parametrosPorNivel
                .filter(
                    parametro =>
                        nivelesActuales.includes(
                            parametro.nivelControl
                        )
                ),

        medicionesEvaluadas:
            corridaValidada.medicionesActuales,

        reglasConfiguradas,

        reglasEvaluadas,

        reglasNoEvaluadas:
            reglasConfiguradas.filter(
                regla =>
                    !reglasEvaluadas.includes(regla)
            ),

        reglasPendientes,

        totalEvaluacionesPendientes:
            evaluacionesPendientes.length,

        evaluacionesPendientes,

        totalAlertas:
            consolidacion.totalAlertas,

        totalRechazos:
            consolidacion.totalRechazos,

        totalAdvertencias:
            consolidacion.totalAdvertencias,

        totalReglasDetectadas:
            consolidacion.totalReglasDetectadas,

        reglasDetectadas:
            consolidacion.reglasDetectadas,

        resumenPorOrigen:
            consolidacion.resumenPorOrigen,

        resumenPorRegla:
            consolidacion.resumenPorRegla,

        alertas:
            consolidacion.alertas,

        evaluacionIntracorrida,

        evaluacionIndependiente,

        evaluacionCombinada,

        estado:
            estadoGeneral.estado,

        tieneRechazos:
            estadoGeneral.tieneRechazos,

        tieneAdvertencias:
            estadoGeneral.tieneAdvertencias,

        evaluacionCompleta,

        mensaje:
            estadoGeneral.mensaje
    };
}



function consolidarAlertasWestgard({
    evaluacionIntracorrida,
    evaluacionIndependiente,
    evaluacionCombinada
}) {

    // Identificar las tres fuentes de alertas.
    const evaluaciones = [
        {
            origen: "intracorrida",
            resultado: evaluacionIntracorrida
        },
        {
            origen: "historico_por_nivel",
            resultado: evaluacionIndependiente
        },
        {
            origen: "combinado",
            resultado: evaluacionCombinada
        }
    ];

    // Reglas disponibles en nuestro motor.
    const tiposPorRegla = {
        "1-2s": "advertencia",
        "1-3s": "rechazo",
        "2-2s": "rechazo",
        "R-4s": "rechazo",
        "4-1s": "rechazo",
        "10x": "rechazo",
        "2de3-2s": "rechazo",
        "3-1s": "rechazo",
        "12x": "rechazo"
    };

    const alertas = [];

    const resumenPorOrigen = [];

    // Recorrer las tres evaluaciones.
    for (const evaluacion of evaluaciones) {

        const {
            origen,
            resultado
        } = evaluacion;

        // Validar el resultado recibido.
        if (
            !resultado ||
            !Array.isArray(resultado.alertas)
        ) {

            throw new Error(
                `La evaluación ${origen} no contiene un arreglo de alertas válido.`
            );
        }

        let totalRechazos = 0;

        let totalAdvertencias = 0;

        // Recorrer las alertas de cada evaluación.
        for (const alerta of resultado.alertas) {

            // Validar la estructura de la alerta.
            if (
                !alerta ||
                typeof alerta.regla !== "string" ||
                !Object.hasOwn(
                    tiposPorRegla,
                    alerta.regla
                )
            ) {

                throw new Error(
                    `Se encontró una regla de Westgard inválida en la evaluación ${origen}.`
                );
            }

            // Validar que el tipo de alerta
            // corresponda a la regla detectada.
            if (
                alerta.tipo !==
                tiposPorRegla[alerta.regla]
            ) {

                throw new Error(
                    `El tipo de alerta de la regla ${alerta.regla} no es válido.`
                );
            }

            // Crear una copia de la alerta
            // para conservar sus evidencias.
            const alertaConsolidada =
                structuredClone(alerta);

            // Identificar la evaluación de origen.
            alertaConsolidada.origen = origen;

            // Conservar el alcance original,
            // cuando esté disponible.
            alertaConsolidada.alcance =
                alerta.alcance || origen;

            // Asignar un identificador local
            // dentro del resultado consolidado.
            alertaConsolidada.numeroAlerta =
                alertas.length + 1;

            alertas.push(
                alertaConsolidada
            );

            // Clasificar las alertas.
            if (
                alerta.tipo === "rechazo"
            ) {

                totalRechazos++;

            } else {

                totalAdvertencias++;
            }
        }

        // Generar el resumen de cada evaluación.
        resumenPorOrigen.push({

            origen,

            totalAlertas:
                resultado.alertas.length,

            totalRechazos,

            totalAdvertencias
        });
    }

    // Identificar las reglas distintas detectadas.
    const reglasDetectadas = [
        ...new Set(
            alertas.map(
                alerta => alerta.regla
            )
        )
    ];

    // Agrupar las alertas por regla.
    const resumenPorRegla =
        reglasDetectadas.map(regla => {

            const alertasRegla =
                alertas.filter(
                    alerta =>
                        alerta.regla === regla
                );

            const origenes = [
                ...new Set(
                    alertasRegla.map(
                        alerta =>
                            alerta.origen
                    )
                )
            ];

            const alcances = [
                ...new Set(
                    alertasRegla.map(
                        alerta =>
                            alerta.alcance
                    )
                )
            ];

            return {

                regla,

                tipo:
                    tiposPorRegla[regla],

                totalAlertas:
                    alertasRegla.length,

                origenes,

                alcances,

                numerosAlertas:
                    alertasRegla.map(
                        alerta =>
                            alerta.numeroAlerta
                    )
            };
        });

    // Obtener las cantidades generales.
    const totalRechazos =
        alertas.filter(
            alerta =>
                alerta.tipo === "rechazo"
        ).length;

    const totalAdvertencias =
        alertas.filter(
            alerta =>
                alerta.tipo === "advertencia"
        ).length;

    return {

        metodo:
            "Consolidación de alertas y evidencias de Westgard",

        totalEvaluaciones:
            evaluaciones.length,

        totalAlertas:
            alertas.length,

        totalRechazos,

        totalAdvertencias,

        totalReglasDetectadas:
            reglasDetectadas.length,

        reglasDetectadas,

        resumenPorOrigen,

        resumenPorRegla,

        alertas,

        alertasConsolidadas:
            true
    };
}



function determinarEstadoGeneralWestgard({
    alertas,
    evaluacionCompleta
}) {

    // Validar el arreglo de alertas.
    if (!Array.isArray(alertas)) {

        throw new Error(
            "Las alertas de Westgard deben proporcionarse en un arreglo."
        );
    }

    // Validar el estado de completitud.
    if (typeof evaluacionCompleta !== "boolean") {

        throw new Error(
            "Debes indicar si la evaluación de Westgard está completa."
        );
    }

    // Validar todas las alertas recibidas.
    for (const alerta of alertas) {

        if (
            !alerta ||
            typeof alerta.regla !== "string" ||
            !alerta.regla.trim() ||
            !["advertencia", "rechazo"].includes(
                alerta.tipo
            )
        ) {

            throw new Error(
                "Se encontró una alerta de Westgard inválida."
            );
        }
    }

    // Identificar alertas de rechazo.
    const alertasRechazo =
        alertas.filter(
            alerta =>
                alerta.tipo === "rechazo"
        );

    // Identificar alertas de advertencia.
    const alertasAdvertencia =
        alertas.filter(
            alerta =>
                alerta.tipo === "advertencia"
        );

    const totalRechazos =
        alertasRechazo.length;

    const totalAdvertencias =
        alertasAdvertencia.length;

    let estado;
    let mensaje;

    // PRIORIDAD 1:
    // Rechazo.
    if (totalRechazos > 0) {

        estado = "rechazo";

        mensaje =
            "Se detectaron reglas de rechazo de Westgard.";

    // PRIORIDAD 2:
    // Advertencia.
    } else if (totalAdvertencias > 0) {

        estado = "advertencia";

        mensaje =
            "Se detectaron advertencias de Westgard sin reglas de rechazo.";

    // PRIORIDAD 3:
    // Evaluación parcial.
    } else if (!evaluacionCompleta) {

        estado = "evaluacion_parcial";

        mensaje =
            "No se detectaron alertas en las reglas evaluadas, pero existen evaluaciones pendientes.";

    // PRIORIDAD 4:
    // Sin alertas.
    } else {

        estado = "sin_alertas";

        mensaje =
            "No se detectaron alertas en las reglas de Westgard aplicables.";
    }

    return {

        metodo:
            "Determinación del estado general de Westgard",

        estado,

        totalAlertas:
            alertas.length,

        totalRechazos,

        totalAdvertencias,

        tieneRechazos:
            totalRechazos > 0,

        tieneAdvertencias:
            totalAdvertencias > 0,

        alertasRechazo,

        alertasAdvertencia,

        evaluacionCompleta,

        mensaje
    };
}







function evaluarReglasHistoricasAutomaticas({
  totalNiveles,
  totalMediciones,
  mediciones,
  corridaIdActual,
}) {
  // Validar el identificador de la corrida actual.
  if (!corridaIdActual) {
    throw new Error(
      "Debes proporcionar el identificador de la corrida actual.",
    );
  }

  // Obtener las reglas históricas configuradas.
  const configuracion = obtenerReglasHistoricasWestgard(
    totalNiveles,
    totalMediciones,
  );

  // Validar el historial recibido.
  if (!Array.isArray(mediciones) || mediciones.length === 0) {
    throw new Error("Debes proporcionar las mediciones del historial.");
  }

  // Por ahora, la nueva evaluación histórica
  // se limita a configuraciones de un solo nivel.
  if (totalNiveles !== 1) {
    throw new Error(
      "La evaluación histórica de múltiples niveles está pendiente de adaptación.",
    );
  }

  const nivelControl = mediciones[0]?.nivelControl;

  // Evitar mezclar niveles de control.
  if (
    typeof nivelControl !== "string" ||
    !nivelControl.trim() ||
    mediciones.some(
      (m) =>
        !m ||
        !m.corridaId ||
        m.nivelControl !== nivelControl ||
        !Number.isFinite(m.zScore),
    )
  ) {
    throw new Error(
      "El historial debe contener mediciones válidas del mismo nivel.",
    );
  }

  // Campos que identifican el conjunto de control.
  const camposConjunto = ["prueba", "lote", "equipo", "versionParametros"];

  // Validar que todas las mediciones tengan
  // los datos necesarios del conjunto de control.
  for (const campo of camposConjunto) {
    const campoInvalido = mediciones.some(
      (m) => typeof m[campo] !== "string" || !m[campo].trim(),
    );

    if (campoInvalido) {
      throw new Error(
        `Todas las mediciones deben proporcionar un valor válido para ${campo}.`,
      );
    }
  }

  // Obtener los datos del conjunto de referencia.
  const conjuntoControl = {
    prueba: mediciones[0].prueba,
    nivelControl,
    lote: mediciones[0].lote,
    equipo: mediciones[0].equipo,
    versionParametros: mediciones[0].versionParametros,
  };

  // Evitar mezclar conjuntos de control diferentes.
  for (const campo of camposConjunto) {
    const existeDiferencia = mediciones.some(
      (m) => m[campo] !== conjuntoControl[campo],
    );

    if (existeDiferencia) {
      throw new Error(
        `No se pueden mezclar mediciones con diferente ${campo}.`,
      );
    }
  }
// La estrategia actual contempla una sola
// medición diaria por nivel de control.
if (totalMediciones !== 1) {
    throw new Error(
        "La evaluación histórica diaria requiere una medición por nivel."
    );
}

// Validar el orden cronológico antes de
// ejecutar las reglas históricas.
validarOrdenCronologicoWestgard(mediciones);

// Conservar el orden original del historial.
const historial = [...mediciones];

  const esCorridaActual = (medicion) =>
    String(medicion.corridaId) === String(corridaIdActual);

  const medicionesActuales = historial.filter(esCorridaActual);

  if (medicionesActuales.length !== totalMediciones) {
    throw new Error(
      "Las mediciones de la corrida actual no coinciden con la configuración.",
    );
  }

  // La corrida actual debe estar al final del historial.
  if (!historial.slice(-totalMediciones).every(esCorridaActual)) {
    throw new Error(
      "La corrida actual debe encontrarse al final del historial.",
    );
  }

  // Cantidad mínima de mediciones por regla.
  const minimos = {
    "2-2s": 2,
    "4-1s": 4,
    "10x": 10,
    "3-1s": 3,
    "12x": 12,
  };

  const funciones = {
    "2-2s": evaluarRegla22sHistorica,
    "4-1s": evaluarRegla41s,
    "10x": evaluarRegla10x,
    "3-1s": evaluarRegla31s,
    "12x": evaluarRegla12x,
  };

  const alertas = [];
  const reglasEvaluadas = [];
  const reglasNoEvaluadas = [];
  const detalleReglas = [];

  // Ejecutar las reglas correspondientes.
  for (const regla of configuracion.reglasHistoricas) {
    const minimo = minimos[regla];

    let ventanasEvaluadas = 0;
    const alertasRegla = [];

    // Evaluar únicamente ventanas que terminan
    // en una medición de la corrida actual.
    for (
      let i = historial.length - totalMediciones;
      i < historial.length;
      i++
    ) {
      if (i + 1 < minimo) {
        continue;
      }

      const ventana = historial.slice(i + 1 - minimo, i + 1);

      // La regla histórica 2-2s requiere
      // mediciones de corridas diferentes.
      if (
        regla === "2-2s" &&
        String(ventana[0].corridaId) === String(ventana[1].corridaId)
      ) {
        continue;
      }

      const resultado = funciones[regla](ventana, corridaIdActual);

      ventanasEvaluadas++;

      alertasRegla.push(
        ...resultado.alertas.map((alerta) => ({
          ...alerta,
          alcance: "historico",
          corridaId: corridaIdActual,
          nivelControl,
          mediciones: ventana,
        })),
      );
    }

    if (ventanasEvaluadas === 0) {
      reglasNoEvaluadas.push(regla);

      detalleReglas.push({
        regla,
        estado: "sin_ventana_historica",
        medicionesRequeridas: minimo,
        medicionesDisponibles: historial.length,
      });

      continue;
    }

    reglasEvaluadas.push(regla);

    alertas.push(...alertasRegla);

    detalleReglas.push({
      regla,
      estado: alertasRegla.length > 0 ? "rechazo" : "sin_alertas",
      ventanasEvaluadas,
    });
  }

  return {
    metodo: "Evaluación automática histórica de Westgard",
    corridaId: corridaIdActual,
    conjuntoControl,
    totalNiveles,
    totalMedicionesConfiguracion: totalMediciones,
    totalMedicionesHistoricas: historial.length,
    reglasConfiguradas: configuracion.reglasHistoricas,
    reglasEvaluadas,
    reglasNoEvaluadas,
    detalleReglas,
    alertas,
    estado:
      alertas.length > 0
        ? "rechazo"
        : reglasNoEvaluadas.length > 0
          ? "evaluacion_parcial"
          : "sin_alertas",
    evaluacionCompleta: reglasNoEvaluadas.length === 0,
  };
}

module.exports = {
  evaluarWestgard,
  prepararCorridaWestgard,
  evaluarReglaR4s,
  evaluarCorridaWestgard,
  obtenerSecuenciasWestgard,
  evaluarRegla41s,
  evaluarRegla10x,
  prepararHistorialWestgard,
  evaluarHistorialWestgard,
  evaluarRegla31s,
  evaluarRegla2de3_2s,
  obtenerConfiguracionWestgard,
  evaluarRegla12x,
  evaluarRegla22sHistorica,
  obtenerReglasHistoricasWestgard,
  evaluarReglasHistoricasAutomaticas,
  validarOrdenCronologicoWestgard,
  obtenerConfiguracionDiariaWestgard,
  agruparHistorialWestgardPorNivel,
  validarIdentidadHistorialWestgard,
  prepararHistorialMultinivelWestgard,
  validarCorridaActualWestgard,
  obtenerReglasHistoricasPorNivelWestgard,
  evaluarHistorialPorNivelWestgard,
  agruparHistorialWestgardPorCorrida,
  prepararVentanasCombinadasWestgard,
  evaluarHistorialCombinadoWestgard,
  validarParametrosEstadisticosWestgard,
  validarIdentificadoresCorridasWestgard,
  determinarEstadoGeneralWestgard,
  consolidarAlertasWestgard,
  evaluarWestgardAutomatico,
};