
const express = require('express');

const app = express();
const PORT = 3000;

// Permite recibir datos en formato JSON
app.use(express.json());

// Endpoint de bienvenida para comprobar que la API funciona
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API de Levey-Jennings funcionando correctamente'
  });
});

// Endpoint para calcular los límites de control
app.post('/api/levey-jennings/calcular', (req, res) => {
  const { prueba, media, desviacionEstandar, resultados } = req.body;

  // Validar los parámetros estadísticos
  if (
    typeof media !== 'number' ||
    !Number.isFinite(media) ||
    typeof desviacionEstandar !== 'number' ||
    !Number.isFinite(desviacionEstandar) ||
    desviacionEstandar <= 0
  ) {
    return res.status(400).json({
      error: 'La media debe ser numérica y la desviación estándar debe ser mayor que cero.'
    });
  }

  // Validar los resultados recibidos
  if (
    !Array.isArray(resultados) ||
    resultados.length === 0 ||
    resultados.some(
      (r) =>
        !r ||
        typeof r.fecha !== 'string' ||
        Number.isNaN(Date.parse(r.fecha)) ||
        typeof r.valor !== 'number' ||
        !Number.isFinite(r.valor)
    )
  ) {
    return res.status(400).json({
      error: 'Envía al menos un resultado con fecha válida y valor numérico.'
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
    mas3DE: media + 3 * desviacionEstandar
  };

  
  // Ordenar los resultados cronológicamente
  const resultadosOrdenados = [...resultados].sort(
    (a, b) => Date.parse(a.fecha) - Date.parse(b.fecha)
  );

  // Calcular el Z-score de cada resultado
  const resultadosCalculados = resultadosOrdenados.map((r) => ({
    fecha: r.fecha,
    valor: r.valor,
    zScore: (r.valor - media) / desviacionEstandar
  }));

  // Revisar las reglas de Westgard
  const alertas = [];

  // Regla 1_2s: advertencia si un resultado supera ±2 DE
  resultadosCalculados.forEach((r) => {
    if (Math.abs(r.zScore) >= 2 && Math.abs(r.zScore) < 3) {
      alertas.push({
        regla: '1_2s',
        nivel: 'advertencia',
        fechas: [r.fecha],
        mensaje: 'Un resultado supera ±2 desviaciones estándar.'
      });
    }

    // Regla 1_3s: un resultado supera ±3 DE
    if (Math.abs(r.zScore) >= 3) {
      alertas.push({
        regla: '1_3s',
        nivel: 'rechazo',
        fechas: [r.fecha],
        mensaje: 'Un resultado supera ±3 desviaciones estándar.'
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
        regla: '2_2s',
        nivel: 'rechazo',
        fechas: [anterior.fecha, actual.fecha],
        mensaje: 'Dos resultados consecutivos superan 2 DE en el mismo lado de la media.'
      });
    }

    // Regla R_4s: uno supera +2 DE y otro -2 DE
    if (
      (anterior.zScore >= 2 && actual.zScore <= -2) ||
      (anterior.zScore <= -2 && actual.zScore >= 2)
    ) {
      alertas.push({
        regla: 'R_4s',
        nivel: 'rechazo',
        fechas: [anterior.fecha, actual.fecha],
        mensaje: 'Dos resultados consecutivos presentan una diferencia de al menos 4 DE.'
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
        regla: '4_1s',
        nivel: 'rechazo',
        fechas: grupo.map((r) => r.fecha),
        mensaje: 'Cuatro resultados consecutivos superan 1 DE en el mismo lado de la media.'
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
        regla: '10x',
        nivel: 'rechazo',
        fechas: grupo.map((r) => r.fecha),
        mensaje: 'Diez resultados consecutivos están del mismo lado de la media.'
      });
    }
  }

  // Responder con cálculos y alertas
  res.json({
    prueba: prueba || 'Sin especificar',
    media,
    desviacionEstandar,
    limitesControl,
    resultados: resultadosCalculados,
    alertas
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`API disponible en http://localhost:${PORT}`);
});

