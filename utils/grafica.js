
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const ancho = 1200;
const alto = 650;

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width: ancho,
  height: alto,
  backgroundColour: 'white'
});

async function generarGraficaLeveyJennings(datos) {
  const {
  prueba,
  media,
  desviacionEstandar,
  resultados,
  alertas = []
} = datos;


const fechas = resultados.map(r =>
    new Date(r.fecha).toLocaleDateString('es-MX', {
        timeZone: 'UTC'
    })
);

  const limites = {
    menos3DE: media - 3 * desviacionEstandar,
    menos2DE: media - 2 * desviacionEstandar,
    menos1DE: media - desviacionEstandar,
    media: media,
    mas1DE: media + desviacionEstandar,
    mas2DE: media + 2 * desviacionEstandar,
    mas3DE: media + 3 * desviacionEstandar
  };

  const linea = (valor) => fechas.map(() => valor);

  const configuracion = {
    type: 'line',

    data: {
      labels: fechas,

      datasets: [
       {
  label: 'Resultados de control',

  data: resultados.map(r => r.valor),

  // Color de los puntos según las desviaciones estándar
  pointBackgroundColor: resultados.map(r => {
    const zScore = (r.valor - media) / desviacionEstandar;
    const distancia = Math.abs(zScore);

    if (distancia > 3) {
      return '#dc2626'; // Rojo: fuera de ±3 DE
    }

    if (distancia > 2) {
      return '#f59e0b'; // Naranja: entre ±2 y ±3 DE
    }

    return '#2563eb'; // Azul: dentro de ±2 DE
  }),

  pointBorderColor: resultados.map(r => {
    const zScore = (r.valor - media) / desviacionEstandar;
    const distancia = Math.abs(zScore);

    if (distancia > 3) return '#dc2626';
    if (distancia > 2) return '#f59e0b';

    return '#2563eb';
  }),

  borderColor: '#2563eb',
  pointRadius: 7,
  pointHoverRadius: 10,
  pointBorderWidth: 2,
  showLine: true,
  tension: 0
},
        {
          label: '+3 DE',
          data: linea(limites.mas3DE),
          borderColor: '#dc2626',
          borderDash: [6, 4],
          pointRadius: 0
        },
        {
          label: '+2 DE',
          data: linea(limites.mas2DE),
          borderColor: '#f59e0b',
          borderDash: [6, 4],
          pointRadius: 0
        },
        {
          label: '+1 DE',
          data: linea(limites.mas1DE),
          borderColor: '#94a3b8',
          borderDash: [4, 4],
          pointRadius: 0
        },
        {
          label: 'Media',
          data: linea(media),
          borderColor: '#16a34a',
          borderWidth: 2,
          pointRadius: 0
        },
        {
          label: '-1 DE',
          data: linea(limites.menos1DE),
          borderColor: '#94a3b8',
          borderDash: [4, 4],
          pointRadius: 0
        },
        {
          label: '-2 DE',
          data: linea(limites.menos2DE),
          borderColor: '#f59e0b',
          borderDash: [6, 4],
          pointRadius: 0
        },
        {
          label: '-3 DE',
          data: linea(limites.menos3DE),
          borderColor: '#dc2626',
          borderDash: [6, 4],
          pointRadius: 0
        }
      ]
    },

    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: `Gráfica Levey-Jennings - ${prueba || 'Control'}`,
          font: {
            size: 20
          }
        },
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Fecha de procesamiento'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Valor del control'
          },
          min: limites.menos3DE - desviacionEstandar,
          max: limites.mas3DE + desviacionEstandar
        }
      }
    }
  };

  return await chartJSNodeCanvas.renderToBuffer(configuracion);
}

module.exports = {
  generarGraficaLeveyJennings
};
