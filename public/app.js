const tablaMediciones = document.getElementById("tablaMediciones");
const seccionResultados = document.getElementById("seccionResultados");
const nombrePruebaResultado = document.getElementById("nombrePruebaResultado");
const tablaResultados = document.getElementById("tablaResultados");
const interpretacionGrubbs = document.getElementById("interpretacionGrubbs");
const informacionAtipicos = document.getElementById("informacionAtipicos");
const estadoAnalisis = document.getElementById("estadoAnalisis");

// Elementos para revisar posibles valores atípicos
const formularioRevision = document.getElementById("formularioRevision");

const valorSospechosoRevision = document.getElementById(
  "valorSospechosoRevision",
);

const fechaSospechosaRevision = document.getElementById(
  "fechaSospechosaRevision",
);

const observacionesRevision = document.getElementById("observacionesRevision");

const motivoExclusion = document.getElementById("motivoExclusion");

const autorizadoPor = document.getElementById("autorizadoPor");

const mensajeRevision = document.getElementById("mensajeRevision");

// Guardaremos los identificadores del análisis actual
let analisisActualId = null;
let medicionSospechosaId = null;

//ANÁLISIS SELECCIONADO PARA REGISTRO DIARIO

let analisisDiarioSeleccionado = null;

// Botones para conservar o excluir la medición sospechosa

const btnConservar = document.getElementById("btnConservar");
const btnExcluir = document.getElementById("btnExcluir");

// Elementos para reemplazo de medición
const formularioReemplazo = document.getElementById("formularioReemplazo");
const resumenReemplazo = document.getElementById("resumenReemplazo");
const fechaReemplazo = document.getElementById("fechaReemplazo");
const valorReemplazo = document.getElementById("valorReemplazo");
const btnGuardarReemplazo = document.getElementById("btnGuardarReemplazo");
const mensajeReemplazo = document.getElementById("mensajeReemplazo");

const seccionReevaluacion = document.getElementById("seccionReevaluacion");

const buscarNombrePrueba = document.getElementById("buscarNombrePrueba");

const btnBuscarAnalisis = document.getElementById("btnBuscarAnalisis");

const mensajeBusqueda = document.getElementById("mensajeBusqueda");

const listaAnalisis = document.getElementById("listaAnalisis");

const resultadosBusqueda = document.getElementById("resultadosBusqueda");

const mensajeRecuperacion = document.getElementById("mensajeRecuperacion");

const btnReevaluarGrubbs = document.getElementById("btnReevaluarGrubbs");
const mensajeReevaluacion = document.getElementById("mensajeReevaluacion");
const resultadosReevaluacion = document.getElementById(
  "resultadosReevaluacion",
);
const tablaReevaluacion = document.getElementById("tablaReevaluacion");
const interpretacionReevaluacion = document.getElementById(
  "interpretacionReevaluacion",
);

const seccionGraficaLevey = document.getElementById("seccionGraficaLevey");

const imagenGraficaLevey = document.getElementById("imagenGraficaLevey");

const mensajeGraficaLevey = document.getElementById("mensajeGraficaLevey");

// generar automaticamente 20 filas

for (let i = 1; i <= 20; i++) {
  const fila = document.createElement("tr");

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

const btnAnalizar = document.getElementById("btnAnalizar");
const campoPrueba = document.getElementById("prueba");
const mensaje = document.getElementById("mensaje");

btnAnalizar.addEventListener("click", async () => {
  const prueba = campoPrueba.value.trim();

  const fechas = document.querySelectorAll(".fecha-medicion");
  const valores = document.querySelectorAll(".valor-medicion");

  if (!prueba) {
    mensaje.textContent = "Ingresa el nombre de la prueba.";
    mensaje.style.color = "red";
    return;
  }

  const mediciones = [];

  for (let i = 0; i < 20; i++) {
    const fecha = fechas[i].value;
    const valorTexto = valores[i].value.trim();

    if (!fecha || valorTexto === "") {
      mensaje.textContent = `Completa la fecha y el valor de la medición ${i + 1}.`;
      mensaje.style.color = "red";
      return;
    }

    const valor = Number(valorTexto);

    if (!Number.isFinite(valor)) {
      mensaje.textContent = `El valor de la medición ${i + 1} no es válido.`;
      mensaje.style.color = "red";
      return;
    }

    mediciones.push({
      fecha: fecha,
      valor: valor,
    });
  }

  mensaje.style.color = "#123b5d";
  mensaje.textContent = "Enviando mediciones al servidor...";

  btnAnalizar.disabled = true;

  try {
    const respuesta = await fetch("/api/control/registrar-lote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prueba: prueba,
        nivelControl: "Nivel 1",
        lote: "LOTE-WEB-PRUEBA-001",
        equipo: "Analizador 01",
        mediciones: mediciones,
      }),
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(resultado.mensaje || "Error al guardar las mediciones.");
    }

    mensaje.style.color = "green";
    mensaje.textContent = resultado.mensaje;

    console.log("Respuesta de la API:", resultado);

    // Mostrar automáticamente los resultados de Grubbs
    if (resultado.analisisGrubbs) {
      // Adaptar la respuesta actual de nuestra API
      const analisis = {
        _id: resultado.analisisId,
        prueba: resultado.prueba,
        estado: resultado.estado,
        analisisGrubbs: resultado.analisisGrubbs,
        coeficienteVariacion: null,
      };

      // Mostrar la tabla de resultados
      mostrarResultados(analisis);

      // Guardar el identificador del análisis
      analisisActualId = resultado.analisisId;

      // Reiniciar el formulario de revisión
      formularioRevision.hidden = true;
      medicionSospechosaId = null;

      // Reiniciar los botones de revisión
      btnConservar.hidden = false;
      btnExcluir.hidden = false;

      btnConservar.disabled = false;
      btnExcluir.disabled = false;

      // Limpiar los campos de investigación
      observacionesRevision.value = "";
      motivoExclusion.value = "";
      autorizadoPor.value = "";
      mensajeRevision.textContent = "";

      // Ocultar y limpiar el formulario de reemplazo
      formularioReemplazo.hidden = true;

      fechaReemplazo.value = "";
      valorReemplazo.value = "";
      mensajeReemplazo.textContent = "";

      btnGuardarReemplazo.disabled = false;

      // Ocultar los resultados anteriores de reevaluación
      seccionReevaluacion.hidden = true;
      resultadosReevaluacion.hidden = true;

      tablaReevaluacion.innerHTML = "";
      mensajeReevaluacion.textContent = "";

      btnReevaluarGrubbs.disabled = false;

      // Verificar si existe una medición sospechosa
      if (resultado.analisisGrubbs.esAtipico && resultado.medicionSospechosa) {
        const sospechosa = resultado.medicionSospechosa;

        // Guardar el ID exacto de MongoDB
        medicionSospechosaId = sospechosa.id;

        // Mostrar el valor sospechoso
        valorSospechosoRevision.textContent = sospechosa.valor;

        // Mostrar la fecha
        fechaSospechosaRevision.textContent = new Date(
          sospechosa.fecha,
        ).toLocaleDateString("es-MX", { timeZone: "UTC" });

        // Mostrar el formulario de revisión
        formularioRevision.hidden = false;
      }
    }
  } catch (error) {
    mensaje.style.color = "red";
    mensaje.textContent = error.message;

    console.error("Error al guardar las mediciones:", error);
  } finally {
    btnAnalizar.disabled = false;
  }
});

function mostrarResultados(analisis) {
  const grubbs = analisis.analisisGrubbs;

  // Si todavía no se completaron las 20 mediciones,
  // Grubbs aún no tiene resultados para mostrar.
  if (!grubbs) {
    seccionResultados.hidden = false;

    nombrePruebaResultado.textContent = `Prueba: ${analisis.prueba}`;

    tablaResultados.innerHTML = "";

    interpretacionGrubbs.textContent =
      "La prueba de Grubbs se ejecutará automáticamente " +
      "cuando se registren las 20 mediciones iniciales.";

    interpretacionGrubbs.style.color = "#b45309";

    informacionAtipicos.textContent =
      "Análisis en recopilación. Todavía no existen " +
      "resultados estadísticos de Grubbs.";

    informacionAtipicos.style.color = "#b45309";

    estadoAnalisis.textContent = `Estado del análisis: ${analisis.estado}`;

    seccionGraficaLevey.hidden = true;

    return;
  }

  // Mostrar la sección de resultados
  seccionResultados.hidden = false;

  // Nombre de la prueba
  nombrePruebaResultado.textContent = `Prueba: ${analisis.prueba}`;

  // Limpiar resultados anteriores
  tablaResultados.innerHTML = "";

  // Crear las filas de la tabla

  // Calcular el coeficiente de variación
  const coeficienteVariacion =
    Number(grubbs.media) !== 0 &&
    Number.isFinite(Number(grubbs.media)) &&
    Number.isFinite(Number(grubbs.desviacionEstandar))
      ? (
          (Number(grubbs.desviacionEstandar) / Math.abs(Number(grubbs.media))) *
          100
        ).toFixed(4)
      : "No calculable";

  // Crear las filas de la tabla

  
const filas = [
    ["Número de mediciones", "n",
        grubbs.numeroMediciones, "datos"],

    ["Media aritmética", "Σxi / n",
        grubbs.media, ""],

    ["Desviación estándar", "s",
        grubbs.desviacionEstandar, ""],

    ["Valor mínimo", "xmin",
        grubbs.valorMinimo, ""],

    ["Valor máximo", "xmax",
        grubbs.valorMaximo, ""],

    ["Distancia inferior", "|Media - valor mínimo|",
        grubbs.distanciaInferior, ""],

    ["Distancia superior", "|Valor máximo - media|",
        grubbs.distanciaSuperior, ""],

    ["Distancia máxima", "max(|xi - media|)",
        grubbs.distanciaMaxima, ""],

    ["Estadístico G", "Distancia máxima / s",
        grubbs.estadisticoG, "Adimensional"],

    ["Valor crítico", "G crítico",
        grubbs.valorCritico, "Adimensional"],

    ["Nivel de significancia", "α",
        grubbs.nivelSignificancia, "Adimensional"],

    ["Valor sospechoso", "Mayor distancia absoluta",
        grubbs.valorSospechoso, ""],

    ["Lado sospechoso", "Superior o inferior",
        grubbs.ladoSospechoso, ""],

    ["Resultado de Grubbs", "Comparar G con G crítico",
        grubbs.resultado, ""]
];


  filas.forEach((fila) => {
    const tr = document.createElement("tr");

    fila.forEach((valor) => {
      const td = document.createElement("td");
      td.textContent = valor;
      tr.appendChild(td);
    });

    tablaResultados.appendChild(tr);
  });

  // Interpretación de Grubbs
  interpretacionGrubbs.textContent = `Resultado de Grubbs: ${grubbs.resultado}`;

  // Información del posible valor atípico
  if (grubbs.esAtipico) {
    informacionAtipicos.textContent =
      `ATENCIÓN: Se detectó un posible valor atípico ` +
      `de ${grubbs.valorSospechoso}. ` +
      `Debe investigarse antes de decidir su exclusión.`;

    informacionAtipicos.style.color = "red";
  } else if (grubbs.hayEmpate) {
    informacionAtipicos.textContent =
      "ATENCIÓN: Existe un empate entre los extremos. " +
      "Se requiere revisión.";

    informacionAtipicos.style.color = "darkorange";
  } else {
    informacionAtipicos.textContent =
      "No se detectaron valores atípicos mediante Grubbs.";

    informacionAtipicos.style.color = "green";
  }

  // Estado del análisis
  estadoAnalisis.textContent = `Estado del análisis: ${analisis.estado}`;

  mostrarGraficaLevey(analisis);
}

// Función para revisar la medición sospechosa

async function revisarMedicion(decision) {
  if (!medicionSospechosaId) {
    mensajeRevision.textContent =
      "No se encontró la medición que debe revisarse.";
    mensajeRevision.style.color = "red";
    return;
  }

  const observaciones = observacionesRevision.value.trim();
  const motivo = motivoExclusion.value.trim();
  const responsable = autorizadoPor.value.trim();

  if (!observaciones) {
    mensajeRevision.textContent =
      "Debes escribir las observaciones de la investigación.";
    mensajeRevision.style.color = "red";
    return;
  }

  if (decision === "excluir" && (!motivo || !responsable)) {
    mensajeRevision.textContent =
      "Para excluir debes indicar el motivo técnico y el responsable.";
    mensajeRevision.style.color = "red";
    return;
  }

  const confirmado = window.confirm(
    decision === "excluir"
      ? "¿Confirmas que deseas excluir esta medición?"
      : "¿Confirmas que deseas conservar esta medición?",
  );

  if (!confirmado) return;

  btnConservar.disabled = true;
  btnExcluir.disabled = true;

  mensajeRevision.style.color = "#123b5d";
  mensajeRevision.textContent = "Guardando revisión...";

  try {
    // Guardar la decisión en MongoDB
    const respuesta = await fetch(
      `/api/control/revisar-medicion/${medicionSospechosaId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          observaciones,
          motivo: decision === "excluir" ? motivo : undefined,
          autorizadoPor: decision === "excluir" ? responsable : undefined,
        }),
      },
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(resultado.mensaje || "No se pudo guardar la revisión.");
    }

    // La revisión ya quedó guardada
    medicionSospechosaId = null;

    mensajeRevision.style.color = "green";
    mensajeRevision.textContent = resultado.mensaje;

    // Ocultar el formulario de revisión
    formularioRevision.hidden = true;

    // Recuperar el análisis actualizado
    if (!analisisActualId) {
      throw new Error("La revisión se guardó, pero falta el ID del análisis.");
    }

    const respuestaActualizada = await fetch(
      `/api/control/analisis-guardado/${analisisActualId}`,
    );

    const datosActualizados = await respuestaActualizada.json();

    if (!respuestaActualizada.ok) {
      throw new Error(
        datosActualizados.mensaje ||
          "La revisión se guardó, pero no se pudo actualizar el análisis.",
      );
    }

    const analisisActualizado = datosActualizados.analisis;

    const resumen = datosActualizados.resumen;

    // CASO 1: YA TENEMOS 20 MEDICIONES VÁLIDAS
    if (analisisActualizado.estado === "completo") {
      // Actualizar la tabla con resultados definitivos
      mostrarResultados(analisisActualizado);

      estadoAnalisis.textContent =
        "ANÁLISIS COMPLETO. " +
        `Mediciones válidas: ${resumen.totalValidas}. ` +
        `Excluidas: ${resumen.totalExcluidas}. ` +
        `Pendientes: ${resumen.totalPendientes}. ` +
        "Los resultados estadísticos son definitivos.";

      estadoAnalisis.style.color = "green";

      formularioRevision.hidden = true;
      formularioReemplazo.hidden = true;
      seccionReevaluacion.hidden = true;
      resultadosReevaluacion.hidden = true;

      mensajeRevision.textContent = "";

      console.log("Análisis completo:", analisisActualizado);

      return;
    }

    // CASO 2: SE EXCLUYÓ UNA MEDICIÓN
    if (analisisActualizado.estado === "requiere_reemplazo") {
      formularioReemplazo.hidden = false;
      seccionReevaluacion.hidden = true;

      btnGuardarReemplazo.disabled = false;

      resumenReemplazo.textContent =
        `Actualmente hay ${resumen.totalValidas} ` +
        `mediciones válidas de ` +
        `${resumen.medicionesRequeridas} requeridas. ` +
        "Registra una medición de reemplazo.";

      mensajeReemplazo.textContent = "";

      estadoAnalisis.textContent =
        "La medición fue excluida y documentada. " +
        "Se requiere registrar un reemplazo para " +
        "completar las 20 mediciones válidas.";

      estadoAnalisis.style.color = "#b45309";

      return;
    }

    // CASO 3: EL ANÁLISIS SIGUE PENDIENTE
    estadoAnalisis.textContent =
      `Estado del análisis: ${analisisActualizado.estado}. ` +
      `Válidas: ${resumen.totalValidas}. ` +
      `Pendientes: ${resumen.totalPendientes}.`;

    estadoAnalisis.style.color = "#b45309";

    console.log("Análisis pendiente:", analisisActualizado);
  } catch (error) {
    mensajeRevision.style.color = "red";
    mensajeRevision.textContent = error.message;

    console.error("Error al revisar:", error);
  } finally {
    btnConservar.disabled = false;
    btnExcluir.disabled = false;
  }
}

// Conectar los botones
btnConservar.addEventListener("click", () => {
  revisarMedicion("conservar");
});

btnExcluir.addEventListener("click", () => {
  revisarMedicion("excluir");
});

btnGuardarReemplazo.addEventListener("click", async () => {
  // Verificar que tenemos un análisis seleccionado
  if (!analisisActualId) {
    mensajeReemplazo.textContent =
      "No se encontró el análisis al que pertenece el reemplazo.";
    mensajeReemplazo.style.color = "red";
    return;
  }

  // Obtener los datos del formulario
  const fecha = fechaReemplazo.value;
  const valorTexto = valorReemplazo.value.trim();

  // Validar los campos
  if (!fecha || valorTexto === "") {
    mensajeReemplazo.textContent =
      "Debes introducir la fecha y el valor de la medición.";
    mensajeReemplazo.style.color = "red";
    return;
  }

  const valor = Number(valorTexto);

  if (!Number.isFinite(valor)) {
    mensajeReemplazo.textContent = "El valor de la medición debe ser numérico.";
    mensajeReemplazo.style.color = "red";
    return;
  }

  // Evitar envíos duplicados mientras se guarda
  btnGuardarReemplazo.disabled = true;

  mensajeReemplazo.style.color = "#123b5d";
  mensajeReemplazo.textContent = "Registrando medición de reemplazo...";

  try {
    const respuesta = await fetch(
      `/api/control/agregar-reemplazo/${analisisActualId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fecha,
          valor,
        }),
      },
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje || "No se pudo registrar la medición de reemplazo.",
      );
    }

    mensajeReemplazo.style.color = "green";
    mensajeReemplazo.textContent = resultado.mensaje;

    // Mostrar el resumen devuelto por la API
    const resumen = resultado.resumen;

    resumenReemplazo.textContent =
      `Mediciones registradas: ${resumen.totalRegistradas}. ` +
      `Válidas: ${resumen.totalValidas}. ` +
      `Excluidas: ${resumen.totalExcluidas}. ` +
      `Pendientes: ${resumen.totalPendientes}.`;

    // Actualizar el estado según la respuesta real de la API
    const estadoActual = resultado.resumen.estado;

    estadoAnalisis.textContent =
      `Estado del análisis: ${estadoActual}. ` +
      `Válidas: ${resumen.totalValidas}. ` +
      `Excluidas: ${resumen.totalExcluidas}. ` +
      `Pendientes: ${resumen.totalPendientes}.`;

    if (estadoActual === "completo") {
      estadoAnalisis.style.color = "green";

      formularioReemplazo.hidden = true;
      formularioRevision.hidden = true;
      seccionReevaluacion.hidden = true;

      mensajeReemplazo.textContent =
        "Las 20 mediciones válidas están completas. " +
        "La reevaluación de Grubbs no detectó nuevos valores atípicos.";
    } else {
      estadoAnalisis.style.color = "#b45309";
    }

    // Ocultar el formulario para evitar duplicados
    formularioReemplazo.hidden = true;

    // Recuperar el estado actualizado desde MongoDB
    const respuestaActualizada = await fetch(
      `/api/control/analisis-guardado/${analisisActualId}`,
    );

    const datosActualizados = await respuestaActualizada.json();

    if (!respuestaActualizada.ok) {
      throw new Error(
        datosActualizados.mensaje ||
          "El reemplazo se guardó, pero no se pudo recuperar el análisis.",
      );
    }

    // Identificar la medición pendiente de revisión
    const pendientes = datosActualizados.mediciones.filter(
      (medicion) => medicion.estado === "pendiente_revision",
    );

    if (pendientes.length === 1) {
      const medicionPendiente = pendientes[0];

      medicionSospechosaId = medicionPendiente._id;

      valorSospechosoRevision.textContent = medicionPendiente.valor;

      fechaSospechosaRevision.textContent = new Date(
        medicionPendiente.fecha,
      ).toLocaleDateString("es-MX", {
        timeZone: "UTC",
      });

      observacionesRevision.value = "";
      motivoExclusion.value = "";
      autorizadoPor.value = "";

      mensajeRevision.textContent = "";

      btnConservar.hidden = false;
      btnExcluir.hidden = false;

      btnConservar.disabled = false;
      btnExcluir.disabled = false;

      // Primero se debe reevaluar Grubbs
      formularioRevision.hidden = true;
    }

    // Determinar el siguiente paso según MongoDB
    const analisisActualizado = datosActualizados.analisis;
    const resumenActualizado = datosActualizados.resumen;

    if (analisisActualizado.estado === "completo") {
      // Ya existen 20 mediciones válidas
      mostrarResultados(analisisActualizado);

      formularioReemplazo.hidden = true;
      formularioRevision.hidden = true;
      seccionReevaluacion.hidden = true;
      resultadosReevaluacion.hidden = true;

      medicionSospechosaId = null;

      estadoAnalisis.textContent =
        "ANÁLISIS COMPLETO. " +
        `Válidas: ${resumenActualizado.totalValidas}. ` +
        `Excluidas: ${resumenActualizado.totalExcluidas}. ` +
        "No existen mediciones pendientes.";

      estadoAnalisis.style.color = "green";

      mensajeReemplazo.style.color = "green";
      mensajeReemplazo.textContent =
        "Reemplazo aceptado. La prueba de Grubbs " +
        "se reevaluó automáticamente.";
    } else if (analisisActualizado.estado === "pendiente_revision") {
      // Grubbs detectó un nuevo posible valor atípico
      seccionReevaluacion.hidden = true;
      resultadosReevaluacion.hidden = true;

      formularioReemplazo.hidden = true;

      if (pendientes.length === 1) {
        const pendiente = pendientes[0];

        medicionSospechosaId = pendiente._id;

        valorSospechosoRevision.textContent = pendiente.valor;

        fechaSospechosaRevision.textContent = new Date(
          pendiente.fecha,
        ).toLocaleDateString("es-MX", { timeZone: "UTC" });

        observacionesRevision.value = "";
        motivoExclusion.value = "";
        autorizadoPor.value = "";

        formularioRevision.hidden = false;

        mensajeRevision.textContent =
          "Grubbs detectó un posible valor atípico. " +
          "Investiga y documenta la decisión.";

        mensajeRevision.style.color = "#b45309";
      }
    } else if (analisisActualizado.estado === "requiere_reemplazo") {
      // Todavía faltan mediciones válidas
      formularioReemplazo.hidden = false;
      formularioRevision.hidden = true;
      seccionReevaluacion.hidden = true;

      resumenReemplazo.textContent =
        `Válidas: ${resumenActualizado.totalValidas} ` +
        `de ${resumenActualizado.medicionesRequeridas}. ` +
        "Registra otra medición de reemplazo.";
    }

    // Sincronizar toda la interfaz con el estado real de MongoDB
    await recuperarAnalisis(analisisActualId);

    console.log("Reemplazo registrado:", resultado);
    console.log("Análisis actualizado:", datosActualizados);
  } catch (error) {
    mensajeReemplazo.style.color = "red";
    mensajeReemplazo.textContent = error.message;

    console.error("Error al registrar reemplazo:", error);

    btnGuardarReemplazo.disabled = false;
  }
});

// Función para reevaluar Grubbs después de un reemplazo

btnReevaluarGrubbs.addEventListener("click", async () => {
  if (!analisisActualId) {
    mensajeReevaluacion.textContent = "No se encontró el análisis.";
    return;
  }

  btnReevaluarGrubbs.disabled = true;

  mensajeReevaluacion.style.color = "#123b5d";
  mensajeReevaluacion.textContent =
    "Calculando nuevamente la prueba de Grubbs...";

  resultadosReevaluacion.hidden = true;

  try {
    const respuesta = await fetch(
      `/api/control/reevaluar-grubbs/${analisisActualId}`,
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(resultado.mensaje || "No se pudo reevaluar Grubbs.");
    }

    // La respuesta puede contener el análisis dentro
    // de una propiedad o directamente en el objeto.
    const grubbs =
      resultado.analisisGrubbs || resultado.resultadoGrubbs || resultado.grubbs;

    if (!grubbs) {
      console.log("Respuesta de reevaluación:", resultado);

      throw new Error(
        "La API respondió, pero no se encontró " +
          "el objeto con los cálculos de Grubbs.",
      );
    }

    const formato = (numero) => {
      return typeof numero === "number" ? numero.toFixed(4) : "No disponible";
    };

    const filas = [
      ["Número de mediciones", "n", grubbs.numeroMediciones, "mediciones"],

      ["Media", "Σx / n", formato(grubbs.media), "unidad de la prueba"],

      [
        "Desviación estándar",
        "s",
        formato(grubbs.desviacionEstandar),
        "unidad de la prueba",
      ],

      [
        "Valor mínimo",
        "mín(x)",
        formato(grubbs.valorMinimo),
        "unidad de la prueba",
      ],

      [
        "Valor máximo",
        "máx(x)",
        formato(grubbs.valorMaximo),
        "unidad de la prueba",
      ],

      [
        "Distancia inferior",
        "|mín(x) - media|",
        formato(grubbs.distanciaInferior),
        "unidad de la prueba",
      ],

      [
        "Distancia superior",
        "|máx(x) - media|",
        formato(grubbs.distanciaSuperior),
        "unidad de la prueba",
      ],

      [
        "Estadístico de Grubbs",
        "G = distancia máxima / s",
        formato(grubbs.estadisticoG),
        "adimensional",
      ],

      [
        "Valor crítico",
        "G crítico",
        formato(grubbs.valorCritico),
        "adimensional",
      ],

      [
        "Nivel de significancia",
        "α",
        formato(grubbs.nivelSignificancia),
        "adimensional",
      ],
    ];

    tablaReevaluacion.innerHTML = "";

    filas.forEach((fila) => {
      const tr = document.createElement("tr");

      fila.forEach((dato) => {
        const td = document.createElement("td");
        td.textContent = dato;
        tr.appendChild(td);
      });

      tablaReevaluacion.appendChild(tr);
    });

    if (grubbs.error) {
      interpretacionReevaluacion.textContent = grubbs.error;
      interpretacionReevaluacion.style.color = "red";
    } else if (grubbs.hayEmpate) {
      interpretacionReevaluacion.textContent =
        "Se detectó un empate entre los valores extremos. " +
        "Se requiere revisión antes de continuar.";
      interpretacionReevaluacion.style.color = "#b45309";
    } else if (grubbs.esAtipico) {
      interpretacionReevaluacion.textContent =
        `Posible valor atípico detectado: ` +
        `${grubbs.valorSospechoso}. ` +
        `Se requiere investigación.`;
      interpretacionReevaluacion.style.color = "#b45309";
    } else {
      interpretacionReevaluacion.textContent =
        "No se detectaron valores atípicos " + "con la prueba de Grubbs.";

      interpretacionReevaluacion.style.color = "green";

      // Mostrar el formulario si existe una medición
      // de reemplazo pendiente de revisión.
      if (medicionSospechosaId) {
        formularioRevision.hidden = false;

        btnConservar.hidden = false;
        btnExcluir.hidden = false;

        btnConservar.disabled = false;
        btnExcluir.disabled = false;

        mensajeRevision.textContent =
          "La reevaluación de Grubbs no detectó " +
          "valores atípicos. Revisa la medición " +
          "de reemplazo antes de conservarla.";

        mensajeRevision.style.color = "#123b5d";
      }
    }

    resultadosReevaluacion.hidden = false;

    mensajeReevaluacion.style.color = "green";
    mensajeReevaluacion.textContent =
      "Reevaluación de Grubbs realizada correctamente.";

    console.log("Resultado de reevaluación:", resultado);
  } catch (error) {
    mensajeReevaluacion.style.color = "red";
    mensajeReevaluacion.textContent = error.message;

    console.error("Error en reevaluación:", error);
  } finally {
    btnReevaluarGrubbs.disabled = false;
  }
});

// funcion para recuperar un análisis guardado en MongoDB

async function recuperarAnalisis(id) {
  mensajeRecuperacion.textContent = "Recuperando análisis desde MongoDB...";

  mensajeRecuperacion.style.color = "#123b5d";

  try {
    const respuesta = await fetch(`/api/control/analisis-guardado/${id}`);

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(resultado.mensaje || "No se pudo recuperar el análisis.");
    }

    const analisis = resultado.analisis;
    const resumen = resultado.resumen;
    const mediciones = resultado.mediciones;

    // Actualizar el resumen visual
    mostrarResumenAnalisis(analisis, resumen);

    // Conservar el ID para las operaciones posteriores
    analisisActualId = analisis._id;

    // Mostrar el ID si ya agregamos esa función
    if (typeof mostrarIdAnalisis === "function") {
      mostrarIdAnalisis(analisisActualId);
    }

    mostrarResultados(analisis);

    // Distinguir resultados históricos de definitivos
    if (analisis.estado !== "completo") {
      informacionAtipicos.textContent =
        "RESULTADO HISTÓRICO: Estos cálculos " +
        "corresponden al análisis inicial. " +
        "Las estadísticas definitivas se obtendrán " +
        "cuando existan 20 mediciones válidas.";

      informacionAtipicos.style.color = "#b45309";

      interpretacionGrubbs.textContent =
        "Resultado del análisis inicial de Grubbs.";

      interpretacionGrubbs.style.color = "#b45309";
    }

    // Reiniciar formularios de otro análisis
    formularioRevision.hidden = true;
    formularioReemplazo.hidden = true;
    seccionReevaluacion.hidden = true;
    resultadosReevaluacion.hidden = true;

    medicionSospechosaId = null;

    btnConservar.hidden = false;
    btnExcluir.hidden = false;
    btnConservar.disabled = false;
    btnExcluir.disabled = false;

    mensajeRevision.textContent = "";
    mensajeReevaluacion.textContent = "";
    mensajeReemplazo.textContent = "";

    const pendientes = mediciones.filter(
      (medicion) => medicion.estado === "pendiente_revision",
    );

    // Preparar la revisión de una medición pendiente
    if (pendientes.length === 1) {
      const pendiente = pendientes[0];

      medicionSospechosaId = pendiente._id;

      valorSospechosoRevision.textContent = pendiente.valor;

      fechaSospechosaRevision.textContent = new Date(
        pendiente.fecha,
      ).toLocaleDateString("es-MX", {
        timeZone: "UTC",
      });

      observacionesRevision.value = "";
      motivoExclusion.value = "";
      autorizadoPor.value = "";
    }

    // Mostrar estado recuperado
    estadoAnalisis.textContent =
      `Estado: ${analisis.estado}. ` +
      `Válidas: ${resumen.totalValidas}. ` +
      `Excluidas: ${resumen.totalExcluidas}. ` +
      `Pendientes: ${resumen.totalPendientes}.`;

    // Caso 1: análisis completado
    if (analisis.estado === "completo") {
      estadoAnalisis.style.color = "green";

      // Caso 2: reemplazo registrado, falta reevaluar

      // Caso 2: existe un reemplazo pendiente
    } else if (
      pendientes.length === 1 &&
      resumen.totalExcluidas > 0 &&
      resumen.totalValidas + resumen.totalPendientes ===
        resumen.medicionesRequeridas
    ) {
      seccionReevaluacion.hidden = false;
      btnReevaluarGrubbs.disabled = false;

      mensajeReevaluacion.textContent =
        "Hay una medición pendiente. " + "Reevalúa Grubbs antes de revisarla.";

      // Caso 3: falta registrar un reemplazo
    } else if (
      resumen.totalValidas < resumen.medicionesRequeridas &&
      resumen.totalPendientes === 0 &&
      resumen.totalExcluidas > 0
    ) {
      formularioReemplazo.hidden = false;
      btnGuardarReemplazo.disabled = false;

      resumenReemplazo.textContent =
        `Hay ${resumen.totalValidas} mediciones válidas ` +
        `de ${resumen.medicionesRequeridas} requeridas.`;

      // Caso 4: sospechoso inicial pendiente de investigación
    } else if (pendientes.length === 1) {
      formularioRevision.hidden = false;
    }

    mensajeRecuperacion.style.color = "green";
    mensajeRecuperacion.textContent = `Análisis "${analisis.prueba}" recuperado correctamente.`;

    seccionResultados.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    mensajeRecuperacion.style.color = "red";
    mensajeRecuperacion.textContent = error.message;

    console.error("Error al recuperar análisis:", error);
  }
}

// Buscar análisis por nombre
btnBuscarAnalisis.addEventListener("click", async () => {
  const nombre = buscarNombrePrueba.value.trim();

  if (nombre.length < 2) {
    mensajeBusqueda.textContent = "Escribe al menos 2 caracteres.";

    mensajeBusqueda.style.color = "red";
    return;
  }

  btnBuscarAnalisis.disabled = true;

  mensajeBusqueda.textContent = "Buscando análisis...";
  mensajeBusqueda.style.color = "#123b5d";

  listaAnalisis.hidden = true;
  resultadosBusqueda.innerHTML = "";

  try {
    const respuesta = await fetch(
      `/api/control/buscar-analisis?prueba=${encodeURIComponent(nombre)}`,
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(resultado.mensaje || "No se pudo realizar la búsqueda.");
    }

    const analisisEncontrados = resultado.analisis;

    if (analisisEncontrados.length === 0) {
      mensajeBusqueda.textContent =
        "No se encontraron análisis con ese nombre.";

      mensajeBusqueda.style.color = "#b45309";
      return;
    }

    mensajeBusqueda.textContent = `Se encontraron ${analisisEncontrados.length} análisis.`;

    mensajeBusqueda.style.color = "green";

    listaAnalisis.hidden = false;

    analisisEncontrados.forEach((analisis) => {
      const contenedor = document.createElement("div");
      contenedor.className = "tarjeta-analisis";

      contenedor.dataset.analisisId = String(analisis._id);

      // Nombre de la prueba
      const nombrePrueba = document.createElement("h3");
      nombrePrueba.textContent = analisis.prueba;

      // Fecha de creación
      const fecha = analisis.createdAt
        ? new Date(analisis.createdAt).toLocaleDateString("es-MX")
        : "Fecha no disponible";

      const estado = analisis.estado || "Sin estado";

      const total = analisis.medicionesRequeridas || 20;
      const validas = analisis.totalMedicionesValidas ?? 0;

      const porcentaje = Math.min(100, Math.max(0, (validas / total) * 100));

      // Información general
      const detalles = document.createElement("p");
      detalles.className = "tarjeta-detalles";
      detalles.textContent = `Fecha: ${fecha} | Estado: ${estado}`;

      // Progreso
      const progresoTexto = document.createElement("div");
      progresoTexto.className = "tarjeta-progreso-texto";

      const etiqueta = document.createElement("span");
      etiqueta.textContent = "Progreso de mediciones";

      const cantidad = document.createElement("strong");
      cantidad.textContent = `${validas}/${total}`;

      progresoTexto.appendChild(etiqueta);
      progresoTexto.appendChild(cantidad);

      // Barra de progreso
      const barra = document.createElement("div");
      barra.className = "barra-progreso";

      const relleno = document.createElement("div");
      relleno.className = "barra-progreso-relleno";
      relleno.style.width = `${porcentaje}%`;

      if (analisis.estado === "completo") {
        relleno.classList.add("completo");
      }

      barra.appendChild(relleno);

      // Texto de mediciones faltantes
      const faltantes = document.createElement("p");
      faltantes.className = "tarjeta-faltantes";

      faltantes.textContent =
        analisis.estado === "completo"
          ? "Análisis completo"
          : `${Math.max(0, total - validas)} mediciones faltantes`;

      // Contenedor de botones
      const acciones = document.createElement("div");
      acciones.className = "tarjeta-acciones";

      // Botón Seleccionar análisis
      const botonSeleccionar = document.createElement("button");
      botonSeleccionar.type = "button";
      botonSeleccionar.className = "btn-seleccionar";
      botonSeleccionar.textContent = "Seleccionar análisis";

      botonSeleccionar.addEventListener("click", () => {
        recuperarAnalisis(analisis._id);
      });

      acciones.appendChild(botonSeleccionar);

      // Botón Continuar llenado
      if (analisis.estado === "en_recopilacion") {
        const btnContinuar = document.createElement("button");

        btnContinuar.type = "button";
        btnContinuar.className = "btn-continuar-llenado";
        btnContinuar.textContent = "Continuar llenado";

        btnContinuar.addEventListener("click", async () => {
          btnContinuar.disabled = true;

          try {
            const respuesta = await fetch(
              `/api/control/analisis-guardado/${analisis._id}`,
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
              throw new Error(
                resultado.mensaje || "No se pudo recuperar el análisis.",
              );
            }

            const analisisGuardado = resultado.analisis;
            const resumen = resultado.resumen;

            // Guardar la identificación completa del análisis
            analisisDiarioSeleccionado = {
              _id: analisisGuardado._id,
              prueba: analisisGuardado.prueba,
              nivelControl: analisisGuardado.nivelControl,
              lote: analisisGuardado.lote,
              equipo: analisisGuardado.equipo,
            };

            console.log(
              "Análisis diario seleccionado:",
              analisisDiarioSeleccionado,
            );

            mostrarProgresoDiario(analisisGuardado, resumen);

            analisisActualId = analisisGuardado._id;
            campoPrueba.value = analisisGuardado.prueba;

            cambiarPestanaMediciones("diario");

            const guardadas =
              resumen.totalRegistradas ?? analisisGuardado.totalMediciones ?? 0;

            contadorMedicionesDiarias.textContent = `Mediciones guardadas: ${guardadas} de ${total}`;

            mensajeMedicionesDiarias.style.color = "green";
            mensajeMedicionesDiarias.textContent =
              `Continuando el registro de ${analisisGuardado.prueba}. ` +
              `Faltan ${Math.max(0, total - guardadas)} mediciones.`;

            panelDiario.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          } catch (error) {
            mensajeMedicionesDiarias.style.color = "red";
            mensajeMedicionesDiarias.textContent = error.message;
          } finally {
            btnContinuar.disabled = false;
          }
        });

        acciones.appendChild(btnContinuar);
      }

      // Construir tarjeta
      contenedor.appendChild(nombrePrueba);
      contenedor.appendChild(detalles);
      contenedor.appendChild(progresoTexto);
      contenedor.appendChild(barra);
      contenedor.appendChild(faltantes);
      contenedor.appendChild(acciones);

      resultadosBusqueda.appendChild(contenedor);
    });
  } catch (error) {
    mensajeBusqueda.style.color = "red";
    mensajeBusqueda.textContent = error.message;

    console.error("Error en búsqueda:", error);
  } finally {
    btnBuscarAnalisis.disabled = false;
  }
});

/* ==========================================
   MOSTRAR RESUMEN DEL ANÁLISIS
========================================== */

function mostrarResumenAnalisis(analisis, resumen) {
  const contenedor = document.getElementById("resumenAnalisis");

  const nombrePrueba = document.getElementById("resumenNombrePrueba");
  const estado = document.getElementById("resumenEstado");
  const detalles = document.getElementById("resumenDetalles");

  const validas = document.getElementById("resumenValidas");
  const excluidas = document.getElementById("resumenExcluidas");
  const pendientes = document.getElementById("resumenPendientes");

  // Nombre de la prueba
  nombrePrueba.textContent = analisis.prueba || "Prueba sin nombre";

  // Estado del análisis
  const estados = {
    completo: "Completo",
    pendiente_revision: "Pendiente de revisión",
    requiere_reemplazo: "Requiere reemplazo",
  };

  estado.textContent =
    estados[analisis.estado] || analisis.estado || "Sin estado";

  // Cambiar el color según el estado
  if (analisis.estado === "completo") {
    estado.style.background = "#e5f4e9";
    estado.style.color = "#237a3b";
  } else {
    estado.style.background = "#fff3df";
    estado.style.color = "#a66312";
  }

  // Información de la prueba
  detalles.textContent =
    `Nivel: ${analisis.nivelControl || "No especificado"} | ` +
    `Lote: ${analisis.lote || "No especificado"} | ` +
    `Equipo: ${analisis.equipo || "No especificado"}`;

  // Contadores recuperados desde MongoDB
  validas.textContent = resumen.totalValidas ?? 0;
  excluidas.textContent = resumen.totalExcluidas ?? 0;
  pendientes.textContent = resumen.totalPendientes ?? 0;

  // Mostrar el resumen
  contenedor.hidden = false;
}

function mostrarGraficaLevey(analisis) {
  // Ocultar cualquier gráfica anterior
  seccionGraficaLevey.hidden = true;
  imagenGraficaLevey.removeAttribute("src");

  // Solo mostrar resultados de análisis completos
  if (!analisis || analisis.estado !== "completo") {
    return;
  }

  if (!analisis._id) {
    return;
  }

  mensajeGraficaLevey.textContent = "Cargando gráfica de Levey-Jennings...";

  mensajeGraficaLevey.style.color = "#123b5d";

  imagenGraficaLevey.onload = () => {
    mensajeGraficaLevey.textContent = "Gráfica generada correctamente.";

    mensajeGraficaLevey.style.color = "green";
  };

  imagenGraficaLevey.onerror = () => {
    mensajeGraficaLevey.textContent =
      "No se pudo cargar la gráfica de Levey-Jennings.";

    mensajeGraficaLevey.style.color = "red";
  };

  // Mostrar la sección
  seccionGraficaLevey.hidden = false;

  // Obtener la imagen desde nuestra API
  imagenGraficaLevey.src = `/api/control/levey-jennings/${analisis._id}/grafica`;
}

/* =========================================
   PESTAÑAS DE RESULTADOS
========================================= */

const tabGrubbs = document.getElementById("tabGrubbs");
const tabLevey = document.getElementById("tabLevey");
const tabWestgard = document.getElementById("tabWestgard");

const panelGrubbs = document.getElementById("panelGrubbs");
const panelLevey = document.getElementById("panelLevey");
const panelWestgard = document.getElementById("panelWestgard");

function cambiarPestana(nombre) {
  // Ocultar todos los paneles
  panelGrubbs.hidden = true;
  panelLevey.hidden = true;
  panelWestgard.hidden = true;

  // Quitar selección de todas las pestañas
  [tabGrubbs, tabLevey, tabWestgard].forEach((tab) => {
    tab.classList.remove("activa");
    tab.setAttribute("aria-selected", "false");
  });

  // Activar la pestaña seleccionada
  let pestañaActiva;

  if (nombre === "grubbs") {
    panelGrubbs.hidden = false;
    pestañaActiva = tabGrubbs;
  }

  if (nombre === "levey") {
    panelLevey.hidden = false;
    pestañaActiva = tabLevey;
  }

  if (nombre === "westgard") {
    panelWestgard.hidden = false;
    pestañaActiva = tabWestgard;
  }

  if (pestañaActiva) {
    pestañaActiva.classList.add("activa");
    pestañaActiva.setAttribute("aria-selected", "true");
  }
}

// Eventos de las pestañas
tabGrubbs.addEventListener("click", () => cambiarPestana("grubbs"));

tabLevey.addEventListener("click", () => cambiarPestana("levey"));

tabWestgard.addEventListener("click", () => cambiarPestana("westgard"));

/* ==========================================
   PESTAÑAS DE MEDICIONES DE CONTROL
========================================== */

const tabDiario = document.getElementById("tabDiario");
const tabRegistroCompleto = document.getElementById("tabRegistroCompleto");

const panelDiario = document.getElementById("panelDiario");
const panelRegistroCompleto = document.getElementById("panelRegistroCompleto");

function cambiarPestanaMediciones(tipo) {
  // Ocultar ambos paneles
  panelDiario.hidden = true;
  panelRegistroCompleto.hidden = true;

  // Quitar selección anterior
  tabDiario.classList.remove("activa");
  tabRegistroCompleto.classList.remove("activa");

  tabDiario.setAttribute("aria-selected", "false");
  tabRegistroCompleto.setAttribute("aria-selected", "false");

  // Mostrar el panel seleccionado
  if (tipo === "diario") {
    panelDiario.hidden = false;

    tabDiario.classList.add("activa");
    tabDiario.setAttribute("aria-selected", "true");
  } else if (tipo === "completo") {
    panelRegistroCompleto.hidden = false;

    tabRegistroCompleto.classList.add("activa");
    tabRegistroCompleto.setAttribute("aria-selected", "true");
  }
}

// Eventos de los botones
tabDiario.addEventListener("click", () => {
  cambiarPestanaMediciones("diario");
});

tabRegistroCompleto.addEventListener("click", () => {
  cambiarPestanaMediciones("completo");
});

// Mostrar registro completo al iniciar
cambiarPestanaMediciones("completo");

/* ==========================================
   REGISTRO DIARIO DE MEDICIONES
========================================== */

const contenedorMedicionesDiarias = document.getElementById(
  "contenedorMedicionesDiarias",
);

const contadorMedicionesDiarias = document.getElementById(
  "contadorMedicionesDiarias",
);

const btnAgregarMedicion = document.getElementById("btnAgregarMedicion");

const MAX_MEDICIONES_DIARIAS = 20;

let siguienteIdMedicionDiaria = 1;

// Actualizar contador
function actualizarContadorMedicionesDiarias() {
  const total = contenedorMedicionesDiarias.children.length;

  contadorMedicionesDiarias.textContent = `Mediciones capturadas: ${total} de ${MAX_MEDICIONES_DIARIAS}`;

  btnAgregarMedicion.disabled = total >= MAX_MEDICIONES_DIARIAS;
}

// Agregar una fila con fecha y valor
function agregarMedicionDiaria() {
  const total = contenedorMedicionesDiarias.children.length;

  if (total >= MAX_MEDICIONES_DIARIAS) {
    return;
  }

  const id = siguienteIdMedicionDiaria++;

  const fila = document.createElement("div");
  fila.className = "medicion-diaria";
  fila.dataset.id = id;

  fila.innerHTML = `
        <div class="campo">
            <label for="fechaDiaria${id}">
                Fecha
            </label>

            <input
                type="date"
                id="fechaDiaria${id}"
                class="fecha-medicion-diaria"
                required
            >
        </div>

        <div class="campo">
            <label for="valorDiario${id}">
                Valor
            </label>

            <input
                type="number"
                id="valorDiario${id}"
                class="valor-medicion-diaria"
                step="any"
                placeholder="Ej. 101"
                required
            >
        </div>

        <button
            type="button"
            class="boton-eliminar-medicion"
            aria-label="Eliminar medición"
        >
            Eliminar
        </button>
    `;

  const btnEliminar = fila.querySelector(".boton-eliminar-medicion");

  btnEliminar.addEventListener("click", () => {
    fila.remove();

    actualizarContadorMedicionesDiarias();
  });

  contenedorMedicionesDiarias.appendChild(fila);

  actualizarContadorMedicionesDiarias();
}

// Evento del botón circular +
btnAgregarMedicion.addEventListener("click", () => {
  agregarMedicionDiaria();
});

const btnGuardarMedicionesDiarias = document.getElementById(
  "btnGuardarMedicionesDiarias",
);

const mensajeMedicionesDiarias = document.getElementById(
  "mensajeMedicionesDiarias",
);

btnGuardarMedicionesDiarias.addEventListener("click", async () => {
  console.log("PRUEBA: Se presionó Guardar mediciones");

  console.log("Estado del botón:", {
    deshabilitado: btnGuardarMedicionesDiarias.disabled,
    analisisActualId,
    analisisDiarioSeleccionado,
  });

  const prueba = campoPrueba.value.trim();

  // Evitar guardar en un análisis diferente al seleccionado
  if (
    analisisDiarioSeleccionado &&
    prueba !== analisisDiarioSeleccionado.prueba
  ) {
    mensajeMedicionesDiarias.style.color = "red";
    mensajeMedicionesDiarias.textContent =
      "Cambiaste el nombre de la prueba seleccionada. " +
      "Para registrar otro analito, primero debes iniciar " +
      "un registro nuevo.";

    return;
  }

  if (!prueba) {
    mensajeMedicionesDiarias.textContent =
      "Debes introducir el nombre de la prueba.";
    mensajeMedicionesDiarias.style.color = "red";
    return;
  }

  const filas = document.querySelectorAll(".medicion-diaria");

  if (filas.length === 0) {
    mensajeMedicionesDiarias.textContent =
      "Debes agregar al menos una medición.";
    mensajeMedicionesDiarias.style.color = "red";
    return;
  }

  const mediciones = [];

  for (const fila of filas) {
    const fecha = fila.querySelector(".fecha-medicion-diaria").value;

    const valorTexto = fila
      .querySelector(".valor-medicion-diaria")
      .value.trim();

    if (!fecha || valorTexto === "") {
      mensajeMedicionesDiarias.textContent =
        "Completa todas las fechas y valores.";
      mensajeMedicionesDiarias.style.color = "red";
      return;
    }

    const valor = Number(valorTexto);

    if (!Number.isFinite(valor)) {
      mensajeMedicionesDiarias.textContent =
        "Se encontró un valor numérico inválido.";
      mensajeMedicionesDiarias.style.color = "red";
      return;
    }

    mediciones.push({ fecha, valor });
  }

  if (mediciones.length > 20) {
    mensajeMedicionesDiarias.style.color = "red";
    mensajeMedicionesDiarias.textContent =
      "No puedes capturar más de 20 mediciones iniciales.";
    return;
  }

  // Comprobar que no existan fechas repetidas
  // entre las filas del formulario.
  const fechas = mediciones.map((medicion) => medicion.fecha);

  const fechasUnicas = new Set(fechas);

  if (fechasUnicas.size !== fechas.length) {
    mensajeMedicionesDiarias.style.color = "red";
    mensajeMedicionesDiarias.textContent =
      "Existen fechas duplicadas en el formulario. " +
      "Cada medición inicial debe tener una fecha diferente.";
    return;
  }

  btnGuardarMedicionesDiarias.disabled = true;
  mensajeMedicionesDiarias.style.color = "#123b5d";
  mensajeMedicionesDiarias.textContent = "Guardando medición en MongoDB...";

  let guardadasEnEsteIntento = 0;
  let ultimoResultado = null;
  let errorGuardado = null;

  // Conservar la relación entre cada fila y su medición.
  const pendientes = mediciones.map((medicion, indice) => ({
    ...medicion,
    fila: filas[indice],
  }));

  try {
    for (const medicion of pendientes) {
      mensajeMedicionesDiarias.style.color = "#123b5d";
      mensajeMedicionesDiarias.textContent =
        `Guardando medición ${guardadasEnEsteIntento + 1} ` +
        `de ${pendientes.length}...`;

      const identificacion = analisisDiarioSeleccionado || {
        prueba,
        nivelControl: "Nivel 1",
        lote: "LOTE-WEB-DIARIO-001",
        equipo: "Analizador 01",
      };

      let respuesta;
      let resultado;

      try {
        respuesta = await fetch("/api/control/registrar-diario", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prueba: identificacion.prueba,
            nivelControl: identificacion.nivelControl,
            lote: identificacion.lote,
            equipo: identificacion.equipo,
            fecha: medicion.fecha,
            valor: medicion.valor,
          }),
        });

        resultado = await respuesta.json();
      } catch (error) {
        errorGuardado =
          "No se pudo confirmar el resultado de la petición. " +
          "Consulta las mediciones guardadas antes de reintentar.";
        break;
      }

      if (!respuesta.ok) {
        console.error("ERROR AL GUARDAR MEDICIÓN:", {
          codigoHTTP: respuesta.status,
          prueba: identificacion.prueba,
          fecha: medicion.fecha,
          valor: medicion.valor,
          mensaje: resultado.mensaje,
          respuestaCompleta: resultado,
        });

        errorGuardado = resultado.mensaje || "No se pudo guardar la medición.";

        break;
      }

      // La API confirmó el registro.
      guardadasEnEsteIntento++;
      ultimoResultado = resultado;

      analisisActualId = resultado.analisisId;

      analisisDiarioSeleccionado = {
        _id: resultado.analisisId,
        prueba: identificacion.prueba,
        nivelControl: identificacion.nivelControl,
        lote: identificacion.lote,
        equipo: identificacion.equipo,
        estado: resultado.estado,
        medicionesRequeridas: resultado.resumen.medicionesRequeridas,
      };

      // Actualizar la tarjeta con los datos confirmados.
      mostrarProgresoDiario(analisisDiarioSeleccionado, resultado.resumen);

      contadorMedicionesDiarias.textContent =
        `Mediciones guardadas: ` +
        `${resultado.resumen.totalRegistradas} de ` +
        `${resultado.resumen.medicionesRequeridas}`;

      // Eliminar solamente la fila confirmada.
      medicion.fila.remove();

      // Actualizar la tarjeta visible del buscador por ID.
      document.querySelectorAll(".tarjeta-analisis").forEach((tarjeta) => {
        if (tarjeta.dataset.analisisId !== String(resultado.analisisId)) {
          return;
        }

        const cantidad = tarjeta.querySelector(
          ".tarjeta-progreso-texto strong",
        );

        const barra = tarjeta.querySelector(".barra-progreso-relleno");

        const faltantes = tarjeta.querySelector(".tarjeta-faltantes");

        const registradas = resultado.resumen.totalRegistradas;

        const requeridas = resultado.resumen.medicionesRequeridas;

        if (cantidad) {
          cantidad.textContent = `${registradas}/${requeridas}`;
        }

        if (barra) {
          barra.style.width = `${Math.min(100, (registradas / requeridas) * 100)}%`;
        }

        if (faltantes) {
          faltantes.textContent = `${resultado.resumen.faltantes} mediciones faltantes`;
        }
      });

      // Si Grubbs se ejecutó, no enviar más mediciones.
      if (resultado.resultadoGrubbs) {
        break;
      }
    }

    // Limpiar la consulta anterior.
    panelConsultaMediciones.hidden = true;
    tablaConsultaMediciones.innerHTML = "";
    btnConsultarMediciones.textContent = "Consultar mediciones";

    if (ultimoResultado?.resultadoGrubbs) {
      const respuestaAnalisis = await fetch(
        `/api/control/analisis-guardado/` + ultimoResultado.analisisId,
      );

      if (!respuestaAnalisis.ok) {
        throw new Error(
          "Las mediciones se guardaron, pero no se pudo " +
            "recuperar el resultado de Grubbs.",
        );
      }

      const datosAnalisis = await respuestaAnalisis.json();

      await recuperarAnalisis(ultimoResultado.analisisId);

      seccionResultados.hidden = false;
      tabGrubbs.click();

      seccionResultados.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (guardadasEnEsteIntento > 0) {
      // Si no quedan filas, preparar una nueva captura.
      if (
        contenedorMedicionesDiarias.querySelectorAll(".medicion-diaria")
          .length === 0
      ) {
        agregarMedicionDiaria();
      }
    }

    if (errorGuardado) {
      mensajeMedicionesDiarias.style.color = "red";
      mensajeMedicionesDiarias.textContent =
        `${guardadasEnEsteIntento} mediciones confirmadas. ` +
        errorGuardado +
        " Las filas no confirmadas permanecen en el formulario.";
    } else if (ultimoResultado?.resultadoGrubbs) {
      mensajeMedicionesDiarias.style.color = "#b45309";
      mensajeMedicionesDiarias.textContent =
        "Se completaron las 20 mediciones. " +
        "Consulta el resultado de Grubbs.";
    } else {
      mensajeMedicionesDiarias.style.color = "green";
      mensajeMedicionesDiarias.textContent =
        `${guardadasEnEsteIntento} mediciones guardadas ` + "correctamente.";
    }
  } catch (error) {
    console.error("Error en registro múltiple:", error);

    mensajeMedicionesDiarias.style.color = "red";
    mensajeMedicionesDiarias.textContent = error.message;
  } finally {
    // Respetar los bloqueos establecidos por el estado.
    const estado = ultimoResultado?.estado;

    const bloqueado =
      [
        "pendiente_revision",
        "requiere_reemplazo",
        "requiere_revision_empate",
        "completo",
      ].includes(estado) ||
      (ultimoResultado?.resumen?.totalRegistradas ?? 0) >= 20;

    btnGuardarMedicionesDiarias.disabled = bloqueado;

    const btnAgregar = document.getElementById("btnAgregarMedicion");

    if (btnAgregar) {
      btnAgregar.disabled = bloqueado;
    }
  }
});

/* ==========================================
   TARJETA DE PROGRESO DEL REGISTRO DIARIO
========================================== */

function mostrarProgresoDiario(analisis, resumen) {
  // Asociar la tarjeta al análisis seleccionado
  const idSeleccionado = String(analisis._id);

  // Si cambiamos de análisis, ocultar las mediciones anteriores
  if (panelConsultaMediciones.dataset.analisisId !== idSeleccionado) {
    panelConsultaMediciones.hidden = true;
    tablaConsultaMediciones.innerHTML = "";

    btnConsultarMediciones.textContent = "Consultar mediciones";

    panelConsultaMediciones.dataset.analisisId = idSeleccionado;
  }

  const tarjeta = document.getElementById("tarjetaProgresoDiario");

  const nombre = document.getElementById("nombreAnalitoDiario");

  const estado = document.getElementById("estadoAnalitoDiario");

  const cantidad = document.getElementById("cantidadProgresoDiario");

  const barra = document.getElementById("barraProgresoDiario");

  const faltantes = document.getElementById("faltantesProgresoDiario");

  const total = analisis.medicionesRequeridas || 20;

  const registradas = resumen.totalRegistradas ?? analisis.totalMediciones ?? 0;

  const porcentaje = Math.min(100, Math.max(0, (registradas / total) * 100));

  nombre.textContent = analisis.prueba;

  estado.textContent = `Estado: ${analisis.estado}`;

  cantidad.textContent = `${registradas}/${total}`;

  barra.style.width = `${porcentaje}%`;

  barra.classList.toggle("completo", analisis.estado === "completo");

  faltantes.textContent = `${Math.max(0, total - registradas)} mediciones faltantes`;

  // Controlar el registro según el estado del análisis
  const estadosBloqueados = [
    "pendiente_revision",
    "requiere_reemplazo",
    "requiere_revision_empate",
    "completo",
  ];

  const estadoActual = analisis.estado;

  const bloquearRegistro =
    estadosBloqueados.includes(estadoActual) || registradas >= total;

  btnGuardarMedicionesDiarias.disabled = bloquearRegistro;

  const btnAgregar = document.getElementById("btnAgregarMedicion");

  if (btnAgregar) {
    btnAgregar.disabled = bloquearRegistro;
  }

  if (bloquearRegistro) {
    const mensajes = {
      pendiente_revision:
        "Se detectó un posible valor atípico. Debes revisarlo antes de continuar.",

      requiere_reemplazo: "El análisis requiere una medición de reemplazo.",

      requiere_revision_empate:
        "Se detectó un empate estadístico que requiere revisión.",

      completo:
        "El análisis está completo. No se permiten más mediciones iniciales.",
    };

    mensajeMedicionesDiarias.style.color = "#b45309";

    mensajeMedicionesDiarias.textContent =
      mensajes[estadoActual] || "Se alcanzaron las 20 mediciones iniciales.";
  } else {
    mensajeMedicionesDiarias.textContent = "";
  }

  tarjeta.hidden = false;
}

/* ==========================================
   CONSULTAR MEDICIONES GUARDADAS
========================================== */

const btnConsultarMediciones = document.getElementById(
  "btnConsultarMediciones",
);

const panelConsultaMediciones = document.getElementById(
  "panelConsultaMediciones",
);

const tablaConsultaMediciones = document.getElementById(
  "tablaConsultaMediciones",
);

btnConsultarMediciones.addEventListener("click", async () => {
  // Si la tabla está visible, ocultarla
  if (!panelConsultaMediciones.hidden) {
    panelConsultaMediciones.hidden = true;
    btnConsultarMediciones.textContent = "Consultar mediciones";
    return;
  }

  if (!analisisActualId) {
    mensajeMedicionesDiarias.style.color = "red";
    mensajeMedicionesDiarias.textContent = "Primero selecciona un análisis.";
    return;
  }

  btnConsultarMediciones.disabled = true;
  btnConsultarMediciones.textContent = "Consultando...";

  try {
    const respuesta = await fetch(
      `/api/control/analisis-guardado/${analisisActualId}`,
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje || "No se pudieron consultar las mediciones.",
      );
    }

    // Obtener las mediciones registradas
    const mediciones = resultado.mediciones || [];

    // Ordenar cronológicamente
    mediciones.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    tablaConsultaMediciones.innerHTML = "";

    mediciones.forEach((medicion, indice) => {
      const fila = document.createElement("tr");

      const numero = document.createElement("td");
      numero.textContent = indice + 1;

      const fecha = document.createElement("td");
      fecha.textContent = new Date(medicion.fecha).toLocaleDateString("es-MX", {
        timeZone: "UTC",
      });

      const valor = document.createElement("td");
      valor.textContent = medicion.valor;

      fila.appendChild(numero);
      fila.appendChild(fecha);
      fila.appendChild(valor);

      tablaConsultaMediciones.appendChild(fila);
    });

    panelConsultaMediciones.hidden = false;
    btnConsultarMediciones.textContent = "Ocultar mediciones";
  } catch (error) {
    mensajeMedicionesDiarias.style.color = "red";
    mensajeMedicionesDiarias.textContent = error.message;

    btnConsultarMediciones.textContent = "Consultar mediciones";
  } finally {
    btnConsultarMediciones.disabled = false;
  }
});

/* ==========================================
   INICIAR NUEVO REGISTRO DIARIO
========================================== */

const btnNuevoRegistroDiario = document.getElementById(
  "btnNuevoRegistroDiario",
);

btnNuevoRegistroDiario.addEventListener("click", () => {
  // Limpiar la selección del análisis anterior
  analisisDiarioSeleccionado = null;
  analisisActualId = null;

  // Limpiar el nombre de la prueba
  campoPrueba.value = "";

  // Limpiar las mediciones capturadas
  contenedorMedicionesDiarias.innerHTML = "";

  // Crear una fila nueva
  agregarMedicionDiaria();

  // Ocultar la tarjeta del análisis anterior
  document.getElementById("tarjetaProgresoDiario").hidden = true;

  // Ocultar y limpiar la consulta anterior
  panelConsultaMediciones.hidden = true;
  panelConsultaMediciones.dataset.analisisId = "";
  tablaConsultaMediciones.innerHTML = "";

  btnConsultarMediciones.textContent = "Consultar mediciones";

  // Reiniciar mensajes y contador
  mensajeMedicionesDiarias.textContent = "";

  actualizarContadorMedicionesDiarias();

  // Preparar el formulario
  campoPrueba.focus();

  console.log("Nuevo registro diario preparado. Sin análisis seleccionado.");
});

// =====================================
// MODAL DE NIVELES DE CONTROL
// =====================================

document.addEventListener("DOMContentLoaded", () => {
  // Elementos del modal
  const btnConfigurarNiveles = document.getElementById("btnConfigurarNiveles");
  const modalNiveles = document.getElementById("modalNiveles");
  const btnCancelarNiveles = document.getElementById("btnCancelarNiveles");

  // Abrir modal
  btnConfigurarNiveles.addEventListener("click", () => {
    modalNiveles.hidden = false;
  });

  // Cerrar modal con Cancelar
  btnCancelarNiveles.addEventListener("click", () => {
    modalNiveles.hidden = true;
  });

  // =====================================
  // AGREGAR TERCER NIVEL DE CONTROL
  // =====================================

  const btnAgregarNivel = document.getElementById("btnAgregarNivel");
  const contenedorNiveles = document.getElementById("contenedorNiveles");

  btnAgregarNivel.addEventListener("click", () => {
    // Evitar agregar más de tres niveles
    if (document.getElementById("tipoNivel3")) {
      return;
    }

    // Crear el tercer nivel
    const nuevoNivel = document.createElement("div");

    nuevoNivel.className = "campo";
    nuevoNivel.id = "campoNivel3";

    nuevoNivel.innerHTML = `
        <label for="tipoNivel3">Nivel 3</label>

        <select id="tipoNivel3" class="select-nivel">
            <option value="bajo">Bajo</option>
            <option value="normal">Normal</option>
            <option value="alto" selected>Alto</option>
        </select>

        <button
            type="button"
            id="btnEliminarNivel3"
        >
            Eliminar nivel 3
        </button>
    `;

    // Agregar el nivel al modal
    contenedorNiveles.appendChild(nuevoNivel);

    // Ocultar el botón para agregar niveles
    btnAgregarNivel.hidden = true;

    // Permitir eliminar el tercer nivel
    document
      .getElementById("btnEliminarNivel3")
      .addEventListener("click", () => {
        nuevoNivel.remove();

        // Mostrar nuevamente el botón +
        btnAgregarNivel.hidden = false;
      });
  });

  // =====================================
  // GUARDAR CONFIGURACIÓN DE NIVELES
  // =====================================

  const btnGuardarNiveles = document.getElementById("btnGuardarNiveles");
  const resumenNiveles = document.getElementById("resumenNiveles");

  // Variable para conservar los niveles seleccionados
  let nivelesConfigurados = [];

  btnGuardarNiveles.addEventListener("click", () => {
    // Obtener los niveles seleccionados
    const nivel1 = document.getElementById("tipoNivel1").value;
    const nivel2 = document.getElementById("tipoNivel2").value;

    nivelesConfigurados = [
      {
        nombre: "Nivel 1",
        tipo: nivel1,
      },
      {
        nombre: "Nivel 2",
        tipo: nivel2,
      },
    ];

    // Comprobar si existe el tercer nivel
    const nivel3 = document.getElementById("tipoNivel3");

    if (nivel3) {
      nivelesConfigurados.push({
        nombre: "Nivel 3",
        tipo: nivel3.value,
      });
    }

    // Mostrar resumen en la página
    resumenNiveles.innerHTML = `
        <strong>Niveles configurados:</strong>
        <ul>
            ${nivelesConfigurados
              .map(
                (nivel) => `
                <li>${nivel.nombre}: ${nivel.tipo}</li>
            `,
              )
              .join("")}
        </ul>
    `;

    // Cerrar el modal
    modalNiveles.hidden = true;

    console.log("Niveles configurados:", nivelesConfigurados);

    actualizarEstrategiaWestgard();
  });

  // =====================================
  // CÁLCULO AUTOMÁTICO DE N PARA WESTGARD
  // =====================================

  const medicionesPorNivel = document.getElementById("medicionesPorNivel");

  const resumenEstrategiaWestgard = document.getElementById(
    "resumenEstrategiaWestgard",
  );

  function actualizarEstrategiaWestgard() {
    // Cantidad de niveles guardados
    const cantidadNiveles = nivelesConfigurados.length;

    // Cantidad de mediciones por nivel
    const cantidadMediciones = Number(medicionesPorNivel.value);

    // Si todavía no se han configurado los niveles
    if (cantidadNiveles === 0) {
      resumenEstrategiaWestgard.textContent =
        "Configura los niveles para calcular N.";
      return;
    }

    // Calcular N
    const N = cantidadNiveles * cantidadMediciones;

    resumenEstrategiaWestgard.textContent =
      `${cantidadNiveles} niveles × ${cantidadMediciones} ` +
      `medición(es) por nivel = N = ${N}`;
      // Generar los campos de resultados de la corrida
generarCamposResultadosPorNivel();
  }

  // Actualizar cuando cambien las mediciones por nivel
  medicionesPorNivel.addEventListener("change", actualizarEstrategiaWestgard);

  // =====================================
// GENERAR CAMPOS DE RESULTADOS POR NIVEL
// =====================================

const seccionResultadosPorNivel = document.getElementById(
    "seccionResultadosPorNivel"
);

const contenedorResultadosPorNivel = document.getElementById(
    "contenedorResultadosPorNivel"
);

// =====================================
// FORMULARIO DIARIO ANTERIOR
// =====================================

const registroDiarioAnterior = document.getElementById(
    "registroDiarioAnterior"
);

function generarCamposResultadosPorNivel() {

    const cantidadMediciones = Number(medicionesPorNivel.value);

    // Limpiar los campos anteriores
    contenedorResultadosPorNivel.innerHTML = "";

    // Configurar la cantidad de columnas
contenedorResultadosPorNivel.style.gridTemplateColumns =
    `repeat(${nivelesConfigurados.length}, minmax(0, 1fr))`;

    if (nivelesConfigurados.length === 0) {

    // Ocultar los campos nuevos
    seccionResultadosPorNivel.hidden = true;

    // Mostrar el formulario anterior
    registroDiarioAnterior.hidden = false;

    return;
}

    // Recorrer cada nivel configurado
    nivelesConfigurados.forEach((nivel, indiceNivel) => {

        const numeroNivel = indiceNivel + 1;

        const bloqueNivel = document.createElement("div");

        bloqueNivel.className = "bloque-nivel-control";

        // Título del nivel
        const tituloNivel = document.createElement("h4");

        tituloNivel.textContent =
            `${nivel.nombre} — ${nivel.tipo}`;

        bloqueNivel.appendChild(tituloNivel);

        // Crear las mediciones correspondientes
        for (
            let numeroMedicion = 1;
            numeroMedicion <= cantidadMediciones;
            numeroMedicion++
        ) {

            const contenedorMedicion = document.createElement("div");

            contenedorMedicion.className = "medicion-diaria";

            const etiqueta = document.createElement("label");

            etiqueta.htmlFor =
                `resultadoNivel${numeroNivel}Medicion${numeroMedicion}`;

            etiqueta.textContent =
                `Medición ${numeroMedicion}`;

            const input = document.createElement("input");

            input.type = "number";
            input.step = "any";

            input.id =
                `resultadoNivel${numeroNivel}Medicion${numeroMedicion}`;

            input.className = "resultado-control";

            input.placeholder = "Introduce el resultado";

            input.dataset.nivel = nivel.nombre;
            input.dataset.tipo = nivel.tipo;
            input.dataset.numeroMedicion = numeroMedicion;

        // Contenedor izquierdo: número de medición y resultado
const columnaResultado = document.createElement("div");
columnaResultado.className = "campo";

columnaResultado.appendChild(etiqueta);
columnaResultado.appendChild(input);

// Contenedor derecho: fecha de la medición
const columnaFecha = document.createElement("div");
columnaFecha.className = "campo";

const etiquetaFecha = document.createElement("label");
etiquetaFecha.textContent = "Fecha";

const inputFecha = document.createElement("input");
inputFecha.type = "date";

inputFecha.id =
    `fechaNivel${numeroNivel}Medicion${numeroMedicion}`;

inputFecha.className = "fecha-resultado-control";

etiquetaFecha.htmlFor = inputFecha.id;

columnaFecha.appendChild(etiquetaFecha);
columnaFecha.appendChild(inputFecha);

// Agregar las dos columnas a la misma fila
contenedorMedicion.appendChild(columnaResultado);
contenedorMedicion.appendChild(columnaFecha);

// Agregar la fila al nivel correspondiente
bloqueNivel.appendChild(contenedorMedicion);
        }

        contenedorResultadosPorNivel.appendChild(bloqueNivel);
    });

// Mostrar los campos de los niveles configurados
seccionResultadosPorNivel.hidden = false;

// Ocultar los campos del registro anterior
registroDiarioAnterior.hidden = true;

// =====================================
// LEER Y VALIDAR RESULTADOS DE LA CORRIDA
// =====================================

const btnGuardarCorrida = document.getElementById(
    "btnGuardarCorrida"
);

const mensajeGuardarCorrida = document.getElementById(
    "mensajeGuardarCorrida"
);

btnGuardarCorrida.addEventListener("click", async () => {

    const prueba = document.getElementById("prueba").value.trim();

    const lote = document.getElementById("loteControl").value.trim();

    const equipo = document.getElementById("equipoControl").value.trim();

    const fechaCorrida = document.getElementById("fechaCorrida").value;

    const cantidadMediciones = Number(medicionesPorNivel.value);

    // Validar información general
    if (!prueba || !lote || !equipo || !fechaCorrida) {

        mensajeGuardarCorrida.textContent =
            "Completa la prueba, lote, equipo y fecha de la corrida.";

        mensajeGuardarCorrida.style.color = "red";

        return;
    }

    if (nivelesConfigurados.length < 2) {

        mensajeGuardarCorrida.textContent =
            "Debes configurar los niveles de control.";

        mensajeGuardarCorrida.style.color = "red";

        return;
    }

    const mediciones = [];

    // Recorrer los niveles configurados
    for (let i = 0; i < nivelesConfigurados.length; i++) {

        const nivel = nivelesConfigurados[i];

        for (let j = 1; j <= cantidadMediciones; j++) {

            const numeroNivel = i + 1;

            const inputResultado = document.getElementById(
                `resultadoNivel${numeroNivel}Medicion${j}`
            );

            const inputFecha = document.getElementById(
                `fechaNivel${numeroNivel}Medicion${j}`
            );

            if (!inputResultado || !inputFecha) {

                mensajeGuardarCorrida.textContent =
                    "No se encontraron todos los campos de medición.";

                mensajeGuardarCorrida.style.color = "red";

                return;
            }

            const valorTexto = inputResultado.value.trim();

            const fecha = inputFecha.value;

            if (valorTexto === "" || !fecha) {

                mensajeGuardarCorrida.textContent =
                    `Completa el resultado y la fecha de ${nivel.nombre}, medición ${j}.`;

                mensajeGuardarCorrida.style.color = "red";

                return;
            }

            const valor = Number(valorTexto);

            if (!Number.isFinite(valor)) {

                mensajeGuardarCorrida.textContent =
                    `El resultado de ${nivel.nombre}, medición ${j}, no es válido.`;

                mensajeGuardarCorrida.style.color = "red";

                return;
            }

            if (fecha !== fechaCorrida) {

                mensajeGuardarCorrida.textContent =
                    `La fecha de ${nivel.nombre}, medición ${j}, debe coincidir con la fecha de la corrida.`;

                mensajeGuardarCorrida.style.color = "red";

                return;
            }

            mediciones.push({
                nivelControl: nivel.nombre,
                tipoNivel: nivel.tipo,
                numeroMedicion: j,
                fecha: fecha,
                valor: valor
            });
        }
    }

    // Preparar los datos que posteriormente enviaremos a la API
    const datosCorrida = {
        prueba,
        lote,
        equipo,
        fechaCorrida,
        numeroNiveles: nivelesConfigurados.length,
        medicionesPorNivel: cantidadMediciones,
        N: mediciones.length,
        mediciones
    };

  
console.log("DATOS DE LA CORRIDA:", datosCorrida);

// Evitar que el usuario guarde dos veces la misma corrida
btnGuardarCorrida.disabled = true;

mensajeGuardarCorrida.textContent =
    "Guardando corrida de control en MongoDB...";

mensajeGuardarCorrida.style.color = "#123b5d";

try {

    const respuesta = await fetch(
        "/api/control/registrar-corrida",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datosCorrida)
        }
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(
            resultado.mensaje ||
            "No se pudo guardar la corrida."
        );
    }

    console.log("CORRIDA GUARDADA:", resultado);

console.log("DATOS COMPLETOS:", datosCorrida);

console.log(
    "NIVELES EN DATOS CORRIDA:",
    datosCorrida.niveles
);

console.log(
    "MEDICIONES EN DATOS CORRIDA:",
    datosCorrida.mediciones
);


    mensajeGuardarCorrida.textContent =
        resultado.mensaje ||
        "Corrida de control registrada correctamente.";

    mensajeGuardarCorrida.style.color = "green";

    //llamada a la funcion 

// Consultar el progreso de Grubbs
// después de guardar correctamente la corrida.


await consultarProgresoGrubbsPorNivel(
    datosCorrida.prueba,
    datosCorrida.lote,
    datosCorrida.equipo,
    [
        ...new Set(
            datosCorrida.mediciones.map(
                medicion => medicion.nivelControl
            )
        )
    ]
);



    // Mantener deshabilitado el botón después del éxito
    // para evitar duplicar accidentalmente esta corrida.

} catch (error) {

    console.error("ERROR AL GUARDAR CORRIDA:", error);

    mensajeGuardarCorrida.textContent =
        error.message;

    mensajeGuardarCorrida.style.color = "red";

    // Permitir reintentar si ocurrió un error
    btnGuardarCorrida.disabled = false;
}


});
}

// =====================================
// OBTENER Y VALIDAR RESULTADOS POR NIVEL
// =====================================

function obtenerResultadosPorNivel() {

    const resultados = [];

    // Obtener todos los campos de resultados
    const campos = document.querySelectorAll(
        "#contenedorResultadosPorNivel .resultado-control"
    );

    // Comprobar que existan campos
    if (campos.length === 0) {
        alert("Primero debes configurar los niveles de control.");
        return null;
    }

    for (const campo of campos) {

        const valorTexto = campo.value.trim();

        // Validar que el campo no esté vacío
        if (valorTexto === "") {
            alert("Debes completar todas las mediciones.");
            campo.focus();
            return null;
        }

        const valor = Number(valorTexto);

        // Validar que sea un número válido
        if (!Number.isFinite(valor)) {
            alert("Se encontró una medición no válida.");
            campo.focus();
            return null;
        }

        resultados.push({
            nivelControl: campo.dataset.nivel,
            tipoNivel: campo.dataset.tipo,
            numeroMedicion: Number(campo.dataset.numeroMedicion),
            valor: valor
        });
    }

    return resultados;
}
});


/* ==========================================
   CONSULTAR PROGRESO DE GRUBBS POR NIVEL
========================================== */

async function consultarProgresoGrubbsPorNivel(
    prueba,
    lote,
    equipo,
    niveles
) {

    const seccion = document.getElementById(
        "seccionProgresoGrubbs"
    );

    const contenedor = document.getElementById(
        "contenedorProgresoGrubbs"
    );

    const mensaje = document.getElementById(
        "mensajeProgresoGrubbs"
    );

    seccion.hidden = false;
    contenedor.innerHTML = "";

    mensaje.textContent =
        "Consultando mediciones registradas...";

    mensaje.style.color = "#123b5d";

    try {

        for (const nivel of niveles) {

            const nombreNivel =
                typeof nivel === "string"
                    ? nivel
                    : nivel.nombre;

            const parametros = new URLSearchParams({
                prueba,
                nivelControl: nombreNivel,
                lote,
                equipo
            });

            const respuesta = await fetch(
                `/api/control/mediciones-por-nivel?${parametros}`
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    resultado.mensaje ||
                    "No se pudo consultar el progreso."
                );
            }

            const progreso = resultado.progresoGrubbs;

            const acumuladas =
                progreso.medicionesAcumuladas;

            const faltantes =
                progreso.medicionesFaltantes;

            const porcentaje = Math.min(
                100,
                (acumuladas / 20) * 100
            );

            const tarjeta = document.createElement("div");

            tarjeta.className = "subtarjeta";

            const titulo = document.createElement("h4");
            titulo.textContent = nombreNivel;

            const contador = document.createElement("p");
            contador.textContent =
                `Mediciones registradas: ${acumuladas} de 20`;

            const barra = document.createElement("div");
            barra.className = "barra-progreso";

            const relleno = document.createElement("div");
            relleno.className = "barra-progreso-relleno";
            relleno.style.width = `${porcentaje}%`;

            barra.appendChild(relleno);

            const estado = document.createElement("p");

            if (progreso.listoParaGrubbs) {

                estado.textContent =
                    "Conjunto completo. Grubbs disponible.";

                estado.style.color = "green";

            } else {

                estado.textContent =
                    `Faltan ${faltantes} mediciones para Grubbs.`;

                estado.style.color = "#b45309";
            }

            tarjeta.appendChild(titulo);
            tarjeta.appendChild(contador);
            tarjeta.appendChild(barra);
            tarjeta.appendChild(estado);


// Mostrar resultados cuando Grubbs ya fue ejecutado
const controlGrubbs = resultado.controlGrubbs;

if (
    progreso.listoParaGrubbs &&
    controlGrubbs &&
    controlGrubbs.resultado
) {
    const grubbs = controlGrubbs.resultado;

    const seccionResultado = document.createElement("div");
    seccionResultado.className = "resultado-grubbs-nivel";

    const tituloResultado = document.createElement("h4");
    tituloResultado.textContent = "Resultados de Grubbs";

    seccionResultado.appendChild(tituloResultado);

    const tabla = document.createElement("table");

    const encabezado = document.createElement("thead");
    const filaEncabezado = document.createElement("tr");

  ["Parámetro", "Cálculo", "Resultado", "Unidades"].forEach(texto => {
        const th = document.createElement("th");
        th.textContent = texto;
        filaEncabezado.appendChild(th);
    });

    encabezado.appendChild(filaEncabezado);
    tabla.appendChild(encabezado);

    const cuerpo = document.createElement("tbody");

    const filas = [
        ["Media", grubbs.media],
        ["Desviación estándar", grubbs.desviacionEstandar],
        ["Valor mínimo", grubbs.valorMinimo],
        ["Valor máximo", grubbs.valorMaximo],
        ["Estadístico G", grubbs.estadisticoG],
        ["Valor crítico", grubbs.valorCritico]
    ];

  
filas.forEach(([parametro, calculo, valor, unidades]) => {

    const tr = document.createElement("tr");

    [parametro, calculo, valor, unidades].forEach(dato => {

        const td = document.createElement("td");

        td.textContent =
            typeof dato === "number"
                ? Number(dato.toFixed(4))
                : (dato ?? "");

        tr.appendChild(td);
    });

    cuerpo.appendChild(tr);
});


    tabla.appendChild(cuerpo);
    seccionResultado.appendChild(tabla);

    const interpretacion = document.createElement("p");

    if (grubbs.esAtipico) {
        interpretacion.textContent =
            `Posible valor atípico detectado: ` +
            `${grubbs.valorSospechoso}. ` +
            `Se requiere investigación y documentación.`;

        interpretacion.style.color = "red";
    } else {
        interpretacion.textContent =
            "No se detectaron valores atípicos.";

        interpretacion.style.color = "green";
    }

    seccionResultado.appendChild(interpretacion);
    tarjeta.appendChild(seccionResultado);
}


            contenedor.appendChild(tarjeta);
        }

        mensaje.textContent =
            "Progreso actualizado correctamente.";

        mensaje.style.color = "green";

    } catch (error) {

        console.error(
            "Error al consultar progreso de Grubbs:",
            error
        );

        mensaje.textContent = error.message;
        mensaje.style.color = "red";
    }
}

// Mostrar una fila al iniciar
agregarMedicionDiaria();
