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
      if (
        resultado.analisisGrubbs.esAtipico &&
        resultado.medicionSospechosa
      ) {
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

  // Mostrar la sección de resultados
  seccionResultados.hidden = false;

  // Nombre de la prueba
  nombrePruebaResultado.textContent = `Prueba: ${analisis.prueba}`;

  // Limpiar resultados anteriores
  tablaResultados.innerHTML = "";

  // Crear las filas de la tabla
  const filas = [
    ["Número de mediciones", "n", grubbs.numeroMediciones, "Mediciones"],

    ["Media", "Σx / n", grubbs.media, "Según prueba"],

    [
      "Desviación estándar",
      "√[Σ(x - media)² / (n - 1)]",
      grubbs.desviacionEstandar,
      "Según prueba",
    ],

    [
      "Valor mínimo",
      "Mínimo de los valores",
      grubbs.valorMinimo,
      "Según prueba",
    ],

    [
      "Valor máximo",
      "Máximo de los valores",
      grubbs.valorMaximo,
      "Según prueba",
    ],

    [
      "Distancia inferior",
      "Media - mínimo",
      grubbs.distanciaInferior,
      "Según prueba",
    ],

    [
      "Distancia superior",
      "Máximo - media",
      grubbs.distanciaSuperior,
      "Según prueba",
    ],

    [
      "Distancia máxima",
      "Máximo de las distancias",
      grubbs.distanciaMaxima,
      "Según prueba",
    ],

    [
      "Estadístico G",
      "Distancia máxima / DE",
      grubbs.estadisticoG,
      "Adimensional",
    ],

    [
      "Valor crítico G",
      "Grubbs bilateral, α = 0.05",
      grubbs.valorCritico,
      "Adimensional",
    ],

    ["Nivel de significancia", "α", grubbs.nivelSignificancia, "Adimensional"],

    [
      "Coeficiente de variación",
      "(DE / Media) × 100",
      analisis.coeficienteVariacion,
      "%",
    ],
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
      contenedor.className = "campo";

      const nombrePrueba = document.createElement("strong");
      nombrePrueba.textContent = analisis.prueba;

      const detalles = document.createElement("p");

      const fecha = analisis.createdAt
        ? new Date(analisis.createdAt).toLocaleDateString("es-MX")
        : "Fecha no disponible";

      detalles.textContent =
        `Fecha: ${fecha} | ` +
        `Estado: ${analisis.estado} | ` +
        `Válidas: ${analisis.totalMedicionesValidas || 0}/` +
        `${analisis.medicionesRequeridas || 20}`;

      const boton = document.createElement("button");
      boton.type = "button";
      boton.textContent = "Seleccionar análisis";

      boton.addEventListener("click", () => {
        recuperarAnalisis(analisis._id);
      });

      contenedor.appendChild(nombrePrueba);
      contenedor.appendChild(detalles);
      contenedor.appendChild(boton);

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
        requiere_reemplazo: "Requiere reemplazo"
    };

    estado.textContent = estados[analisis.estado] || analisis.estado || "Sin estado";

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
  [tabGrubbs, tabLevey, tabWestgard].forEach(tab => {
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
    "contenedorMedicionesDiarias"
);

const contadorMedicionesDiarias = document.getElementById(
    "contadorMedicionesDiarias"
);

const btnAgregarMedicion = document.getElementById(
    "btnAgregarMedicion"
);

const MAX_MEDICIONES_DIARIAS = 20;

let siguienteIdMedicionDiaria = 1;


// Actualizar contador
function actualizarContadorMedicionesDiarias() {

    const total = contenedorMedicionesDiarias.children.length;

    contadorMedicionesDiarias.textContent =
        `Mediciones capturadas: ${total} de ${MAX_MEDICIONES_DIARIAS}`;

    btnAgregarMedicion.disabled =
        total >= MAX_MEDICIONES_DIARIAS;
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

    const btnEliminar = fila.querySelector(
        ".boton-eliminar-medicion"
    );

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


// Mostrar una fila al iniciar
agregarMedicionDiaria();
