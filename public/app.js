const tablaMediciones = document.getElementById('tablaMediciones');

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

} catch (error) {
    mensaje.style.color = 'red';
    mensaje.textContent = error.message;

    console.error('Error:', error);

} finally {
    btnAnalizar.disabled = false;
}

});
