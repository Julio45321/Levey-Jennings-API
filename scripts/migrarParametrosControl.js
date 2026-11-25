
require('dotenv').config();

const mongoose = require('mongoose');
const ParametroControl = require('../models/parametroControl');

// definir los campos pendientes de migracion

const camposMigracion = {
    version: 1,
    activo: false,
    fechaValidacion: null,
    validadoPor: null,
    versionAnteriorId: null,
    estado: 'pendiente_validacion',
    analisisOrigenId: null
};

// ejecutar la migracion de parametros

async function migrarParametrosControl() {

    try {

        // obtener la cadena de conexion

        const uri = process.env.MONGODB_URI ||
                    process.env.MONGO_URI;

        if (!uri) {
            throw new Error(
                'No se encontro la cadena de conexion a MongoDB.'
            );
        }

        // conectar con mongodb

        await mongoose.connect(uri, {
            autoIndex: false,
            autoCreate: false
        });

        console.log('Conexion establecida con MongoDB.');

        // obtener la coleccion original

        const coleccion = ParametroControl.collection;

        const nombreRespaldo =
            'respaldo_parametrocontrols_20261124';

        // verificar que exista el respaldo

        const respaldoExiste = await mongoose.connection.db
            .listCollections({ name: nombreRespaldo })
            .hasNext();

        if (!respaldoExiste) {
            throw new Error(
                'No existe la coleccion de respaldo.'
            );
        }

        const respaldo = mongoose.connection.db
            .collection(nombreRespaldo);

        // consultar los documentos originales y respaldados

        const originales = await coleccion.find({})
            .sort({ _id: 1 })
            .toArray();

        const respaldados = await respaldo.find({})
            .sort({ _id: 1 })
            .toArray();

        const totalAntes = originales.length;

        // verificar la integridad del respaldo

        if (
            totalAntes !== 5 ||
            respaldados.length !== 5 ||
            JSON.stringify(originales) !==
                JSON.stringify(respaldados)
        ) {
            throw new Error(
                'El respaldo no coincide con los documentos originales. ' +
                'No se realizara la migracion.'
            );
        }

        console.log('Respaldo verificado correctamente.');

        const resumenCampos = [];

        // agregar solamente los campos que no existan

        for (const [campo, valor] of Object.entries(
            camposMigracion
        )) {

            const resultado = await coleccion.updateMany(
                {
                    [campo]: {
                        $exists: false
                    }
                },
                {
                    $set: {
                        [campo]: valor
                    }
                }
            );

            resumenCampos.push({
                campo,
                documentosEncontrados:
                    resultado.matchedCount,
                documentosModificados:
                    resultado.modifiedCount
            });
        }

        // verificar los campos pendientes

        const filtroPendientes = {
            $or: Object.keys(camposMigracion).map(
                campo => ({
                    [campo]: {
                        $exists: false
                    }
                })
            )
        };

        const documentosPendientes =
            await coleccion.countDocuments(
                filtroPendientes
            );

        const totalDespues =
            await coleccion.countDocuments({});

        // verificar los estados de validacion

        const parametrosValidados =
            await coleccion.countDocuments({
                estado: 'validado'
            });

        const parametrosPendientesValidacion =
            await coleccion.countDocuments({
                estado: 'pendiente_validacion'
            });

        const parametrosActivos =
            await coleccion.countDocuments({
                activo: true
            });

        // verificar que los datos originales se conservaron

        const documentosMigrados = await coleccion.find({})
            .sort({ _id: 1 })
            .toArray();

        const datosOriginalesConservados =
            originales.every((original, indice) => {

                const migrado = documentosMigrados[indice];

                if (!migrado) {
                    return false;
                }

                return Object.keys(original).every(campo =>
                    JSON.stringify(original[campo]) ===
                    JSON.stringify(migrado[campo])
                );
            });

        // generar el resumen general

        const resumen = {
            totalDocumentosAntes: totalAntes,
            totalDocumentosDespues: totalDespues,
            documentosPendientes,
            parametrosValidados,
            parametrosPendientesValidacion,
            parametrosActivos,
            datosOriginalesConservados,
            detalleMigracion: resumenCampos,
            migracionExitosa:
                totalAntes === totalDespues &&
                documentosPendientes === 0 &&
                parametrosValidados === 3 &&
                parametrosPendientesValidacion === 2 &&
                parametrosActivos === 0 &&
                datosOriginalesConservados
        };

        console.log('\nRESUMEN DE MIGRACION:');

        console.log(
            JSON.stringify(resumen, null, 2)
        );

        if (!resumen.migracionExitosa) {
            process.exitCode = 1;
        }

    } catch (error) {

        console.error(
            'Error durante la migracion:',
            error.message
        );

        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();

        console.log('\nConexion con MongoDB cerrada.');
    }
}

migrarParametrosControl();
