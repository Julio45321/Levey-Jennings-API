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

    const zScore = (medicion.valor - media) / desviacionEstandar;

    return {
      numero: indice + 1,
      fecha: medicion.fecha,
      valor: medicion.valor,
      zScore,
    };
  });

  // evaluar la regla 1-2s
  for (const medicion of medicionesEvaluadas) {
if (Math.abs(medicion.zScore) >= 2) {
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
if (Math.abs(medicion.zScore) >= 3) {
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
    const ambasSuperiores = anterior.zScore > 2 && actual.zScore > 2;

    // comprobar si ambas superan -2 DE
    const ambasInferiores = anterior.zScore < -2 && actual.zScore < -2;

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
  // Validar el identificador de la corrida
  if (!corridaId) {
    throw new Error("Debes proporcionar el identificador de la corrida.");
  }

  // Validar los niveles de control
  if (
    !Array.isArray(controles) ||
    controles.length < 2 ||
    controles.length > 3
  ) {
    throw new Error("La corrida debe contener 2 o 3 niveles de control.");
  }

  const medicionesNormalizadas = [];

  for (const control of controles) {
    const { nivelControl, media, desviacionEstandar, resultados } = control;

    if (!nivelControl) {
      throw new Error("Cada control debe tener un nivel identificado.");
    }

    if (
      !Number.isFinite(media) ||
      !Number.isFinite(desviacionEstandar) ||
      desviacionEstandar <= 0
    ) {
      throw new Error(`Parámetros inválidos para ${nivelControl}.`);
    }

    if (
      !Array.isArray(resultados) ||
      resultados.length < 1 ||
      resultados.length > 2
    ) {
      throw new Error(`El nivel ${nivelControl} debe tener 1 o 2 mediciones.`);
    }

    for (const medicion of resultados) {
      if (!medicion || !Number.isFinite(medicion.valor)) {
        throw new Error(`Medición inválida en ${nivelControl}.`);
      }

      const zScore = (medicion.valor - media) / desviacionEstandar;

      medicionesNormalizadas.push({
        corridaId,
        nivelControl,
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
      "La corrida debe contener al menos dos mediciones válidas."
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
        "Las mediciones deben pertenecer a la misma corrida y tener un Z-score válido."
      );
    }
  }

  // Comparar cada pareja de mediciones de la misma corrida
  for (let i = 0; i < mediciones.length - 1; i++) {

    for (let j = i + 1; j < mediciones.length; j++) {

      const primera = mediciones[i];
      const segunda = mediciones[j];

      const rangoDE = Math.abs(
        primera.zScore - segunda.zScore
      );

      // Una medición debe estar en +2 DE o más
      // y la otra en -2 DE o menos
      const ladosOpuestos =
        (primera.zScore >= 2 && segunda.zScore <= -2) ||
        (primera.zScore <= -2 && segunda.zScore >= 2);

      // Aplicar la regla R-4s
      if (ladosOpuestos && rangoDE >= 4) {

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
              zScore: primera.zScore
            },
            {
              nivelControl: segunda.nivelControl,
              valor: segunda.valor,
              zScore: segunda.zScore
            }
          ],
          mensaje:
            "Regla R-4s detectada: dos mediciones de la misma " +
            "corrida presentan una diferencia igual o superior " +
            "a 4 DE, en lados opuestos de sus medias."
        });

      }
    }
  }

  return {
    metodo: "Regla R-4s de Westgard",
    corridaId: corrida.corridaId,
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0 ? "rechazo" : "sin_alertas_r4s"
  };
}



function evaluarCorridaWestgard(corrida) {

  if (!corrida || !Array.isArray(corrida.mediciones)) {
    throw new Error("Debes proporcionar una corrida válida.");
  }

  // Identificar la configuración correspondiente
  const configuracion = obtenerConfiguracionWestgard(
    corrida.totalNiveles,
    corrida.totalMediciones
  );

  const mediciones = corrida.mediciones;

  if (mediciones.length !== corrida.totalMediciones) {
    throw new Error(
      "El total de mediciones no coincide con la corrida."
    );
  }

  if (mediciones.some(m =>
    m.corridaId !== corrida.corridaId ||
    !Number.isFinite(m.zScore)
  )) {
    throw new Error(
      "Las mediciones deben pertenecer a la misma corrida y tener Z-scores válidos."
    );
  }

  const alertas = [];

  // Regla 1-2s: advertencia
  // Regla 1-3s: rechazo
  for (const medicion of mediciones) {

    const z = medicion.zScore;

    if (Math.abs(z) >= 2) {
      alertas.push({
        regla: "1-2s",
        tipo: "advertencia",
        nivelControl: medicion.nivelControl,
        fecha: medicion.fecha,
        valor: medicion.valor,
        zScore: z
      });
    }

    if (
      configuracion.reglas.includes("1-3s") &&
      Math.abs(z) >= 3
    ) {
      alertas.push({
        regla: "1-3s",
        tipo: "rechazo",
        tipoError: "aleatorio",
        nivelControl: medicion.nivelControl,
        fecha: medicion.fecha,
        valor: medicion.valor,
        zScore: z
      });
    }
  }

  // Regla 2-2s para dos niveles
  if (configuracion.reglas.includes("2-2s")) {

    for (let i = 0; i < mediciones.length - 1; i++) {

      const primera = mediciones[i];
      const segunda = mediciones[i + 1];

      const superiores =
        primera.zScore >= 2 && segunda.zScore >= 2;

      const inferiores =
        primera.zScore <= -2 && segunda.zScore <= -2;

      if (superiores || inferiores) {
        alertas.push({
          regla: "2-2s",
          tipo: "rechazo",
          tipoError: "sistemático",
          corridaId: corrida.corridaId,
          mediciones: [primera, segunda],
          mensaje: "Regla 2-2s detectada."
        });
      }
    }
  }

  // Regla 2de3-2s para tres niveles
  if (configuracion.reglas.includes("2de3-2s")) {

    const resultado = evaluarRegla2de3_2s(mediciones);

    alertas.push(...resultado.alertas);
  }

  // Regla R-4s
  if (configuracion.reglas.includes("R-4s")) {

    const resultado = evaluarReglaR4s(corrida);

    alertas.push(...resultado.alertas);
  }

  const estado = alertas.some(a => a.tipo === "rechazo")
    ? "rechazo"
    : alertas.length > 0
      ? "advertencia"
      : "sin_alertas";

  return {
    metodo: "Evaluación de Westgard por corrida",
    corridaId: corrida.corridaId,
    totalNiveles: corrida.totalNiveles,
    totalMediciones: corrida.totalMediciones,
    reglasConfiguradas: configuracion.reglas,
    medicionesEvaluadas: mediciones,
    alertas,
    estado
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
      medicion.zScore > 0 ? "superior" :
      medicion.zScore < 0 ? "inferior" :
      "media";

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
      (ultimo.zScore > 0 && medicion.zScore > 0) ||
      (ultimo.zScore < 0 && medicion.zScore < 0);

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

      const cuatroSuperiores = grupo.every(
        medicion => medicion.zScore >= 1
      );

      const cuatroInferiores = grupo.every(
        medicion => medicion.zScore <= -1
      );

      if (cuatroSuperiores || cuatroInferiores) {

        alertas.push({
          regla: "4-1s",
          tipo: "rechazo",
          tipoError: "sistemático",
          mediciones: grupo.map(medicion => ({
            nivelControl: medicion.nivelControl ?? null,
            fecha: medicion.fecha ?? null,
            valor: medicion.valor,
            zScore: medicion.zScore
          })),
          mensaje:
            "Regla 4-1s detectada: cuatro mediciones " +
            "consecutivas alcanzan o superan 1 DE " +
            "del mismo lado de la media."
        });

      }
    }
  }

  return {
    metodo: "Regla 4-1s de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0
      ? "rechazo"
      : "sin_alertas_41s"
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

      const diezSuperiores = grupo.every(
        medicion => medicion.zScore > 0
      );

      const diezInferiores = grupo.every(
        medicion => medicion.zScore < 0
      );

      if (diezSuperiores || diezInferiores) {

        alertas.push({
          regla: "10x",
          tipo: "rechazo",
          tipoError: "sistemático",
          mediciones: grupo.map(medicion => ({
            nivelControl: medicion.nivelControl ?? null,
            fecha: medicion.fecha ?? null,
            valor: medicion.valor,
            zScore: medicion.zScore
          })),
          mensaje:
            "Regla 10x detectada: diez mediciones " +
            "consecutivas se encuentran del mismo " +
            "lado de la media."
        });

      }
    }
  }

  return {
    metodo: "Regla 10x de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0
      ? "rechazo"
      : "sin_alertas_10x"
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
      throw new Error(
        `La medición ${indice + 1} tiene un zScore inválido.`
      );
    }

    const fecha = new Date(medicion.fecha);

    if (Number.isNaN(fecha.getTime())) {
      throw new Error(
        `La medición ${indice + 1} tiene una fecha inválida.`
      );
    }

    return {
      ...medicion,
      fecha: fecha.toISOString()
    };
  });

  // Ordenar cronológicamente sin modificar el arreglo original
  historial.sort((a, b) => {
    return new Date(a.fecha) - new Date(b.fecha);
  });

  return {
    totalMediciones: historial.length,
    mediciones: historial
  };
}


function evaluarHistorialWestgard(mediciones) {

  // Validar y ordenar las mediciones
  const historial = prepararHistorialWestgard(mediciones);

  // Evaluar la regla 4-1s
  const resultado41s = evaluarRegla41s(
    historial.mediciones
  );

  // Evaluar la regla 10x
  const resultado10x = evaluarRegla10x(
    historial.mediciones
  );

  // Reunir las alertas de ambas reglas
  const alertas = [
    ...resultado41s.alertas,
    ...resultado10x.alertas
  ];

  // Determinar el estado general
  const estado = alertas.some(
    alerta => alerta.tipo === "rechazo"
  )
    ? "rechazo"
    : "sin_alertas";

  return {
    metodo: "Evaluación histórica de Westgard",
    totalMediciones: historial.totalMediciones,
    medicionesEvaluadas: historial.mediciones,
    reglasEvaluadas: [
      "4-1s",
      "10x"
    ],
    alertas,
    estado
  };
}


function evaluarRegla31s(mediciones) {

  const alertas = [];

  for (let i = 0; i <= mediciones.length - 3; i++) {

    const grupo = mediciones.slice(i, i + 3);

    const positivos = grupo.every(
      medicion => medicion.zScore >= 1
    );

    const negativos = grupo.every(
      medicion => medicion.zScore <= -1
    );

    if (positivos || negativos) {

      alertas.push({
        regla: "3-1s",
        tipo: "rechazo",
        tipoError: "sistemático",
        mediciones: grupo,
        mensaje:
          "Regla 3-1s detectada: tres mediciones consecutivas alcanzan o superan 1 DE del mismo lado de la media."
      });

    }
  }

  return {
    metodo: "Regla 3-1s de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0
      ? "rechazo"
      : "sin_alertas_31s"
  };
}


function evaluarRegla2de3_2s(mediciones) {

  const alertas = [];

  for (let i = 0; i <= mediciones.length - 3; i++) {

    const grupo = mediciones.slice(i, i + 3);

    const positivos = grupo.filter(
      medicion => medicion.zScore >= 2
    );

    const negativos = grupo.filter(
      medicion => medicion.zScore <= -2
    );

    if (positivos.length >= 2 || negativos.length >= 2) {

      const lado = positivos.length >= 2
        ? "superior"
        : "inferior";

      alertas.push({
        regla: "2de3-2s",
        tipo: "rechazo",
        tipoError: "sistemático",
        lado,
        mediciones: grupo,
        mensaje:
          "Regla 2de3-2s detectada: al menos dos de tres mediciones consecutivas alcanzan o superan 2 DE del mismo lado de la media."
      });

    }
  }

  return {
    metodo: "Regla 2de3-2s de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0
      ? "rechazo"
      : "sin_alertas_2de3_2s"
  };
}


function obtenerConfiguracionWestgard(
  totalNiveles,
  totalMediciones
) {

  const configuraciones = {
    "2-2": [
      "1-3s",
      "2-2s",
      "R-4s",
      "4-1s",
      "10x"
    ],
    "2-4": [
      "1-3s",
      "2-2s",
      "R-4s",
      "4-1s",
      "10x"
    ],
    "3-3": [
      "1-3s",
      "2de3-2s",
      "R-4s",
      "3-1s",
      "12x"
    ],
    "3-6": [
      "1-3s",
      "2de3-2s",
      "R-4s",
      "3-1s",
      "12x"
    ]
  };

  const clave = `${totalNiveles}-${totalMediciones}`;

  if (!configuraciones[clave]) {
    throw new Error(
      "Configuración de Westgard no admitida."
    );
  }

  return {
    totalNiveles,
    totalMediciones,
    reglas: configuraciones[clave],
    advertencia: "1-2s"
  };
}


function evaluarRegla12x(mediciones) {

  const alertas = [];

  for (let i = 0; i <= mediciones.length - 12; i++) {

    const grupo = mediciones.slice(i, i + 12);

    const positivos = grupo.every(
      medicion => medicion.zScore > 0
    );

    const negativos = grupo.every(
      medicion => medicion.zScore < 0
    );

    if (positivos || negativos) {

      alertas.push({
        regla: "12x",
        tipo: "rechazo",
        tipoError: "sistemático",
        mediciones: grupo,
        mensaje:
          "Regla 12x detectada: doce mediciones consecutivas se encuentran del mismo lado de la media."
      });

    }
  }

  return {
    metodo: "Regla 12x de Westgard",
    totalMediciones: mediciones.length,
    alertas,
    estado: alertas.length > 0
      ? "rechazo"
      : "sin_alertas_12x"
  };
}


function obtenerReglasHistoricasWestgard(
  totalNiveles,
  totalMediciones
) {

  // Obtener la configuración validada
  const configuracion = obtenerConfiguracionWestgard(
    totalNiveles,
    totalMediciones
  );

  // Funciones disponibles para evaluación histórica
  const funcionesHistoricas = {
    "4-1s": evaluarRegla41s,
    "10x": evaluarRegla10x,
    "3-1s": evaluarRegla31s,
    "12x": evaluarRegla12x
  };

  // Seleccionar únicamente las reglas históricas
  const reglas = configuracion.reglas.filter(
    regla => funcionesHistoricas[regla]
  );

  return {
    totalNiveles,
    totalMediciones,
    reglasHistoricas: reglas
  };
}


function evaluarReglasHistoricasAutomaticas({
  totalNiveles,
  totalMediciones,
  mediciones
}) {

  // Validar la configuración y seleccionar reglas
  const configuracion = obtenerReglasHistoricasWestgard(
    totalNiveles,
    totalMediciones
  );

  // Preparar y ordenar las mediciones
  const historial = prepararHistorialWestgard(mediciones);

  // Relacionar cada regla con su función
  const funciones = {
    "4-1s": evaluarRegla41s,
    "10x": evaluarRegla10x,
    "3-1s": evaluarRegla31s,
    "12x": evaluarRegla12x
  };

  const alertas = [];

  // Ejecutar solamente las reglas seleccionadas
  for (const regla of configuracion.reglasHistoricas) {

    const resultado = funciones[regla](historial.mediciones);

    alertas.push(...resultado.alertas);
  }

  return {
    metodo: "Evaluación automática histórica de Westgard",
    totalNiveles,
    totalMedicionesConfiguracion: totalMediciones,
    totalMedicionesHistoricas: historial.totalMediciones,
    reglasEvaluadas: configuracion.reglasHistoricas,
    alertas,
    estado: alertas.length > 0
      ? "rechazo"
      : "sin_alertas"
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
  obtenerReglasHistoricasWestgard,
  evaluarReglasHistoricasAutomaticas
};
