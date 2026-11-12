const tablaMediciones = document.getElementById('tablaMediciones');
const seccionResultados = document.getElementById('seccionResultados');
const nombrePruebaResultado = document.getElementById('nombrePruebaResultado');
const tablaResultados = document.getElementById('tablaResultados');
const interpretacionGrubbs = document.getElementById('interpretacionGrubbs');
const informacionAtipicos = document.getElementById('informacionAtipicos');
const estadoAnalisis = document.getElementById('estadoAnalisis');

// generar automaticamente 20 filas 

for(let i = 1; i <= 20; i++){
    const fila = document.createElement('tr');

    fila.innerHTML = `
        <td>${i}</td>
        <td>
            <input type="date" class="fecha-medicion" required>
           </td>
        <td>
           <input type="number" 
           class="valor-medicion"
           step="any"
           placeholder="Eje: 101.5"
           required
           >
        </td>
`; 
    tablaMediciones.appendChild(fila);
}


const btnAnalizar = document.getElementById('btnAnalizar');
const campoPrueba = document.getElementById('prueba');
const mensaje = document.getElementById('mensaje');

btnAnalizar.addEventListener('click', async () => {

    const prueba = campoPrueba.value.trim();

    const fechas = document.querySelectorAll('.fecha-medicion');
    const valores = document.querySelectorAll('.valor-medicion');

    if (!prueba) {
        mensaje.textContent = 'Ingresa el nombre de la prueba.';
        mensaje.style.color = 'red';
        return;
    }

    const mediciones = [];

    for (let i = 0; i < 20; i++) {

        const fecha = fechas[i].value;
        const valor = valores[i].value;

        if (!fecha || valor === '') {
            mensaje.textContent = `Completa la fecha y el valor de la medición ${i + 1}.`;
            mensaje.style.color = 'red';
            return;
        }

        mediciones.push({
            fecha: fecha,
            valor: Number(valor)
        });
    }

    mensaje.style.color = '#123b5d';
mensaje.textContent = 'Enviando mediciones al servidor...';

btnAnalizar.disabled = true;

try {
    const respuesta = await fetch('/api/control/registrar-lote', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prueba: prueba,
            mediciones: mediciones
        })
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(resultado.mensaje || 'Error al guardar las mediciones.');
    }

mensaje.style.color = 'green';
mensaje.textContent = resultado.mensaje;

console.log('Respuesta de la API:', resultado);

// Mostrar automáticamente los resultados
if (resultado.analisis && resultado.analisis.analisisGrubbs) {
    mostrarResultados(resultado.analisis);
}

} catch (error) {
    mensaje.style.color = 'red';
    mensaje.textContent = error.message;

    console.error('Error:', error);

} finally {
    btnAnalizar.disabled = false;
}

});


function mostrarResultados(analisis) {

    const grubbs = analisis.analisisGrubbs;

    // Mostrar la sección de resultados
    seccionResultados.hidden = false;

    // Nombre de la prueba
    nombrePruebaResultado.textContent =
        `Prueba: ${analisis.prueba}`;

    // Limpiar resultados anteriores
    tablaResultados.innerHTML = '';

    // Crear las filas de la tabla
    const filas = [
        ['Número de mediciones', 'n',
            grubbs.numeroMediciones, 'Mediciones'],

        ['Media', 'Σx / n',
            grubbs.media, 'Según prueba'],

        ['Desviación estándar',
            '√[Σ(x - media)² / (n - 1)]',
            grubbs.desviacionEstandar, 'Según prueba'],

        ['Valor mínimo', 'Mínimo de los valores',
            grubbs.valorMinimo, 'Según prueba'],

        ['Valor máximo', 'Máximo de los valores',
            grubbs.valorMaximo, 'Según prueba'],

        ['Distancia inferior', 'Media - mínimo',
            grubbs.distanciaInferior, 'Según prueba'],

        ['Distancia superior', 'Máximo - media',
            grubbs.distanciaSuperior, 'Según prueba'],

        ['Distancia máxima', 'Máximo de las distancias',
            grubbs.distanciaMaxima, 'Según prueba'],

        ['Estadístico G', 'Distancia máxima / DE',
            grubbs.estadisticoG, 'Adimensional'],

        ['Valor crítico G', 'Grubbs bilateral, α = 0.05',
            grubbs.valorCritico, 'Adimensional'],

        ['Nivel de significancia', 'α',
            grubbs.nivelSignificancia, 'Adimensional'],

        ['Coeficiente de variación', '(DE / Media) × 100',
            analisis.coeficienteVariacion, '%']
    ];

    filas.forEach(fila => {

        const tr = document.createElement('tr');

        fila.forEach(valor => {
            const td = document.createElement('td');
            td.textContent = valor;
            tr.appendChild(td);
        });

        tablaResultados.appendChild(tr);
    });

    // Interpretación de Grubbs
    interpretacionGrubbs.textContent =
        `Resultado de Grubbs: ${grubbs.resultado}`;

    // Información del posible valor atípico
    if (grubbs.esAtipico) {

        informacionAtipicos.textContent =
            `ATENCIÓN: Se detectó un posible valor atípico ` +
            `de ${grubbs.valorSospechoso}. ` +
            `Debe investigarse antes de decidir su exclusión.`;

        informacionAtipicos.style.color = 'red';

    } else if (grubbs.hayEmpate) {

        informacionAtipicos.textContent =
            'ATENCIÓN: Existe un empate entre los extremos. ' +
            'Se requiere revisión.';

        informacionAtipicos.style.color = 'darkorange';

    } else {

        informacionAtipicos.textContent =
            'No se detectaron valores atípicos mediante Grubbs.';

        informacionAtipicos.style.color = 'green';
    }

    // Estado del análisis
    estadoAnalisis.textContent =
        `Estado del análisis: ${analisis.estado}`;
}
