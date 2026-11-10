
const express = require('express');
const { generarGraficaLeveyJennings } = require('./utils/grafica');
const Medicion = require('./models/medicion');
const ParametroControl = require('./models/parametroControl');

require('dotenv').config();

const conectarDB = require('./config/database');

const app = express();
const PORT = 3000;

// Permite recibir datos en formato JSON
app.use(express.json());


app.post('/api/control/registrar', async (req, res) => {

    try {

        const {
            prueba,
            nivelControl,
            valor,
            fecha,
            lote,
            equipo
        } = req.body;

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
                mensaje: 'Todos los campos son obligatorios'
            });
        }

        // Validar valor numérico
        if (typeof valor !== 'number' || !Number.isFinite(valor)) {
            return res.status(400).json({
                mensaje: 'El valor debe ser un número válido'
            });
        }

        // Validar fecha
        const fechaMedicion = new Date(fecha);

        if (isNaN(fechaMedicion.getTime())) {
            return res.status(400).json({
                mensaje: 'La fecha no es válida'
            });
        }

        // Crear medición
        const nuevaMedicion = new Medicion({
            prueba,
            nivelControl,
            valor,
            fecha: fechaMedicion,
            lote,
            equipo
        });

        // Guardar en MongoDB
        await nuevaMedicion.save();

        res.status(201).json({
            mensaje: 'Medición registrada correctamente',
            medicion: nuevaMedicion
        });

    } catch (error) {

        console.error('Error al registrar medición:', error);

        res.status(500).json({
            mensaje: 'Error al registrar la medición',
            error: error.message
        });

    }

});


// Endpoint de bienvenida para comprobar que la API funciona
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API funcionando correctamente'
  });
});

// Endpoint para calcular los límites de control
app.post('/api/levey-jennings/calcular', (req, res) => {
  const {
  prueba,
  media,
  desviacionEstandar,
  resultados, 
} = req.body;

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
  tipoError: 'no_determinado',
  fechas: [r.fecha],
  mensaje: 'Un resultado supera ±2 desviaciones estándar.'
});
    }

    // Regla 1_3s: un resultado supera ±3 DE
    if (Math.abs(r.zScore) >= 3) {
      alertas.push({
  regla: '1_3s',
  nivel: 'rechazo',
  tipoError: 'aleatorio',
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
  tipoError: 'sistematico',
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
  tipoError: 'aleatorio',
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
  tipoError: 'sistematico',
  fechas: grupo.map(r => r.fecha),
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
  tipoError: 'sistematico',
  fechas: grupo.map(r => r.fecha),
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


// Endpoint para generar la gráfica Levey-Jennings
app.post('/api/levey-jennings/grafica', async (req, res) => {
  try {
    const {
      prueba,
      media,
      desviacionEstandar,
      resultados,
        alertas = []
    } = req.body;

    // Validar media y desviación estándar
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

    // Validar resultados
    if (
      !Array.isArray(resultados) ||
      resultados.length === 0 ||
      resultados.some(
        r =>
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

    // Ordenar resultados por fecha
    const resultadosOrdenados = [...resultados].sort(
      (a, b) => Date.parse(a.fecha) - Date.parse(b.fecha)
    );

    // Generar imagen PNG
    const imagen = await  generarGraficaLeveyJennings({
      prueba,
      media,
      desviacionEstandar,
      resultados: resultadosOrdenados,
      alertas
    });

    // Enviar imagen al cliente
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="grafica-levey-jennings.png"'
    );

    res.send(imagen);

  } catch (error) {
    console.error('Error al generar gráfica:', error);

    res.status(500).json({
      error: 'No fue posible generar la gráfica.'
    });
  }
});


app.get('/api/control/historial', async (req, res) => {
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
        const mediciones = await Medicion.find(filtros)
            .sort({ fecha: 1 });

        res.status(200).json({
            mensaje: 'Historial consultado correctamente',
            filtrosAplicados: filtros,
            total: mediciones.length,
            mediciones: mediciones
        });

    } catch (error) {

        console.error('Error al consultar historial:', error);

        res.status(500).json({
            mensaje: 'Error al consultar el historial',
            error: error.message
        });

    }
});



app.post('/api/control/parametros', async (req, res) => {
    try {

        const {
            prueba,
            nivelControl,
            lote,
            equipo,
            media,
            desviacionEstandar
        } = req.body;

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
                mensaje: 'Todos los campos son obligatorios'
            });
        }

        // Validar valores numéricos
        if (
            !Number.isFinite(media) ||
            !Number.isFinite(desviacionEstandar) ||
            desviacionEstandar <= 0
        ) {
            return res.status(400).json({
                mensaje: 'La media debe ser numérica y la desviación estándar debe ser mayor que cero'
            });
        }

        // Crear parámetros
        const nuevoParametro = new ParametroControl({
            prueba,
            nivelControl,
            lote,
            equipo,
            media,
            desviacionEstandar
        });

        await nuevoParametro.save();

        res.status(201).json({
            mensaje: 'Parámetros de control registrados correctamente',
            parametro: nuevoParametro
        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(409).json({
                mensaje: 'Ya existen parámetros para esta prueba, nivel, lote y equipo'
            });
        }

        console.error('Error al registrar parámetros:', error);

        res.status(500).json({
            mensaje: 'Error al registrar los parámetros',
            error: error.message
        });
    }
});


app.get('/api/control/parametros', async (req, res) => {
    try {

        const {
            prueba,
            nivelControl,
            lote,
            equipo
        } = req.query;

        // Construir filtros
        const filtros = {};

        if (prueba) filtros.prueba = prueba;
        if (nivelControl) filtros.nivelControl = nivelControl;
        if (lote) filtros.lote = lote;
        if (equipo) filtros.equipo = equipo;

        // Consultar MongoDB
        const parametros = await ParametroControl.find(filtros);

        res.status(200).json({
            mensaje: 'Parámetros consultados correctamente',
            total: parametros.length,
            parametros
        });

    } catch (error) {

        console.error('Error al consultar parámetros:', error);

        res.status(500).json({
            mensaje: 'Error al consultar los parámetros',
            error: error.message
        });
    }
});



app.get('/api/control/analisis', async (req, res) => {
    try {

        const {
            prueba,
            nivelControl,
            lote,
            equipo
        } = req.query;

        // Validar que se reciban todos los filtros
        if (!prueba || !nivelControl || !lote || !equipo) {
            return res.status(400).json({
                mensaje: 'Debes proporcionar prueba, nivelControl, lote y equipo'
            });
        }

        // Buscar los parámetros de control
        const parametros = await ParametroControl.findOne({
            prueba,
            nivelControl,
            lote,
            equipo
        });

        if (!parametros) {
            return res.status(404).json({
                mensaje: 'No se encontraron parámetros para esta combinación'
            });
        }

        const { media, desviacionEstandar } = parametros;

        // Recuperar las mediciones correspondientes
        const mediciones = await Medicion.find({
            prueba,
            nivelControl,
            lote,
            equipo
        }).sort({ fecha: 1 });

        // Calcular el valor Z de cada medición
        const resultados = mediciones.map(medicion => {

            const valorZ = (medicion.valor - media) / desviacionEstandar;

            return {
                id: medicion._id,
                prueba: medicion.prueba,
                nivelControl: medicion.nivelControl,
                lote: medicion.lote,
                equipo: medicion.equipo,
                fecha: medicion.fecha,
                valor: medicion.valor,
                valorZ: Number(valorZ.toFixed(3))
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
            regla: '1_2s',
            nivel: 'advertencia',
            fecha: actual.fecha,
            valor: actual.valor,
            valorZ: z,
            mensaje: 'Un resultado supera o alcanza ±2 DE.'
        });
    }

    // Regla 1_3s: rechazo
    if (Math.abs(z) >= 3) {
        alertas.push({
            regla: '1_3s',
            nivel: 'rechazo',
            fecha: actual.fecha,
            valor: actual.valor,
            valorZ: z,
            mensaje: 'Un resultado supera o alcanza ±3 DE.',
            tipoError: 'Posible error aleatorio'
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
                regla: '2_2s',
                nivel: 'rechazo',
                fecha: actual.fecha,
                mensaje: 'Dos resultados consecutivos superan 2 DE del mismo lado.',
                tipoError: 'Posible error sistemático'
            });
        }
    }

    // Regla 4_1s: cuatro resultados consecutivos
    if (i >= 3) {
        const ultimosCuatro = resultados.slice(i - 3, i + 1);

        const todosPositivos = ultimosCuatro.every(
            resultado => resultado.valorZ > 1
        );

        const todosNegativos = ultimosCuatro.every(
            resultado => resultado.valorZ < -1
        );

        if (todosPositivos || todosNegativos) {
            alertas.push({
                regla: '4_1s',
                nivel: 'rechazo',
                fecha: actual.fecha,
                mensaje: 'Cuatro resultados consecutivos superan 1 DE del mismo lado.',
                tipoError: 'Posible error sistemático'
            });
        }
    }

    // Regla 10x: diez resultados consecutivos del mismo lado
    if (i >= 9) {
        const ultimosDiez = resultados.slice(i - 9, i + 1);

        const todosPositivos = ultimosDiez.every(
            resultado => resultado.valorZ > 0
        );

        const todosNegativos = ultimosDiez.every(
            resultado => resultado.valorZ < 0
        );

        if (todosPositivos || todosNegativos) {
            alertas.push({
                regla: '10x',
                nivel: 'rechazo',
                fecha: actual.fecha,
                mensaje: 'Diez resultados consecutivos están del mismo lado de la media.',
                tipoError: 'Posible error sistemático'
            });
        }
    }
}


        // Calcular límites de control
        const limitesControl = {
            menos3DE: media - (3 * desviacionEstandar),
            menos2DE: media - (2 * desviacionEstandar),
            menos1DE: media - desviacionEstandar,
            media: media,
            mas1DE: media + desviacionEstandar,
            mas2DE: media + (2 * desviacionEstandar),
            mas3DE: media + (3 * desviacionEstandar)
        };

        res.status(200).json({
            mensaje: 'Análisis realizado correctamente',

            parametros: {
                prueba,
                nivelControl,
                lote,
                equipo,
                media,
                desviacionEstandar
            },

            limitesControl,

            totalMediciones: resultados.length,

resultados,

totalAlertas: alertas.length,

alertas
        });

    } catch (error) {

        console.error('Error al realizar el análisis:', error);

        res.status(500).json({
            mensaje: 'Error al realizar el análisis',
            error: error.message
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
