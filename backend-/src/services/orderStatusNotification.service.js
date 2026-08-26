import {
  enviarNotificacionInicioServicio,
  enviarNotificacionOrdenListaSinRifa,
  enviarNotificacionOrdenListaConRifa,
  enviarNotificacionOrdenTerminada,
  enviarNotificacionModificacion
} from './notificationRouter.service.js';
import { generarTokenRecibo } from './reciboToken.service.js';
import { pool } from '../config/db.js';

// Obtener número de boleta real de la tabla rifa
const obtenerNumeroBoleta = async (id_evento_rifa, placa_vehiculo) => {
  try {
    const result = await pool.query(
      `SELECT numero_boleta FROM rifa
       WHERE id_evento_rifa = $1 AND UPPER(placa_vehiculo) = UPPER($2)
       LIMIT 1`,
      [id_evento_rifa, placa_vehiculo]
    );
    return result.rows.length > 0 ? result.rows[0].numero_boleta : null;
  } catch (error) {
    console.error('⚠️ Error obteniendo número de boleta:', error.message);
    return null;
  }
};

/**
 * Enviar notificación automática basada en cambio de estado
 * Se dispara cada vez que el estado de la orden cambia
 */
export const enviarNotificacionPorCambioEstado = async (
  estadoAnterior,
  estadoNuevo,
  ordenDatos,
  id_rifa = null,
  credentials = null
) => {
  const { nombre_cliente, telefono_cliente, placa_vehiculo, tipo_vehiculo, cantidad_cascos, valorTotal, id_orden } = ordenDatos;

  // Validar datos mínimos
  if (!nombre_cliente || !telefono_cliente || !placa_vehiculo || !valorTotal) {
    console.warn('⚠️ Datos incompletos para enviar notificación', { id_orden });
    return { success: false, error: 'Datos incompletos' };
  }

  console.log(`📱 Cambio de estado: "${estadoAnterior}" → "${estadoNuevo}"`);
  console.log(`📋 Auditoría SMS - Orden #${id_orden}:`, { nombre_cliente, telefono_cliente, id_rifa });
  console.log(`📝 Estados normalizados: anterior="${estadoAnterior?.toLowerCase()}" nuevo="${estadoNuevo?.toLowerCase()}"`);

  try {
    // Normalizar estados para comparación
    const estadoNuevoNorm = estadoNuevo?.toLowerCase() || '';
    const estadoAnteriorNorm = estadoAnterior?.toLowerCase() || '';

    console.log(`🔍 Evaluando transiciones:`);
    console.log(`   Anterior: "${estadoAnterior}" (normalizado: "${estadoAnteriorNorm}")`);
    console.log(`   Nuevo: "${estadoNuevo}" (normalizado: "${estadoNuevoNorm}")`);

    // ✅ CUALQUIER ESTADO → PROCESO (Sin ser Proceso aún)
    const esTransicionAProceso = estadoNuevoNorm.includes('proceso') && !estadoAnteriorNorm.includes('proceso');
    console.log(`   ✓ ¿Transición a PROCESO? ${esTransicionAProceso}`);

    if (esTransicionAProceso) {
      console.log(`✉️ Enviando SMS #1: Orden EN PROCESO a ${telefono_cliente}`);
      return await enviarNotificacionModificacion(
        telefono_cliente,
        nombre_cliente,
        '⏳ Tu orden está EN PROCESO.\nNos comunicaremos cuando esté lista.\n¡Gracias por tu paciencia! 🙏',
        { orderId: id_orden, tipo: 'estado_proceso' },
        credentials
      );
    }

    // ✅ CUALQUIER ESTADO → LISTA (Con o sin Rifa)
    // Permite transición: NULL→LISTA, PROCESO→LISTA, etc.
    const esTransicionALista = estadoNuevoNorm === 'lista' && estadoAnteriorNorm !== 'lista';
    console.log(`   ✓ ¿Transición a LISTA? ${esTransicionALista}`);

    if (esTransicionALista) {
      console.log(`✉️ Enviando SMS #2: Orden LISTA a ${telefono_cliente}`);

      // 📥 Generar token para descarga de recibo cuando la orden está lista
      console.log(`📥 Generando token para orden ${id_orden}, placa: ${placa_vehiculo}`);
      const tokenRecibo = await generarTokenRecibo(id_orden, placa_vehiculo);
      console.log(`📥 Token generado para Lista: ${tokenRecibo ? '✓ SÍ' : '✗ NO'}`);

      // Si hay rifa, obtener número de boleta real y usar plantilla con rifa
      if (id_rifa) {
        const numeroBoleta = await obtenerNumeroBoleta(id_rifa, placa_vehiculo);
        if (numeroBoleta) {
          console.log(`   Con rifa - Boleta #${numeroBoleta}`);
          return await enviarNotificacionOrdenListaConRifa(
            telefono_cliente,
            nombre_cliente,
            valorTotal,
            numeroBoleta,
            placa_vehiculo,
            id_orden,
            { orderId: id_orden, tipo: 'estado_lista_rifa', tokenRecibo },
            credentials
          );
        } else {
          console.log(`   ⚠️ Rifa asignada pero sin boleta registrada aún`);
        }
      }

      // Sin rifa o sin boleta registrada, usar plantilla normal
      return await enviarNotificacionOrdenListaSinRifa(
        telefono_cliente,
        nombre_cliente,
        valorTotal,
        placa_vehiculo,
        id_orden,
        { orderId: id_orden, tipo: 'estado_lista', tokenRecibo },
        credentials
      );
    }

    // ✅ LISTA → FINALIZADO/FINALIZADA/COMPLETADO (flexible con estado)
    // Solo envía si estado anterior es LISTA y nuevo incluye 'finaliz' (FINALIZADA, FINALIZADO, etc)
    const esTransicionAFinalizada = estadoNuevoNorm.includes('finaliz') && estadoAnteriorNorm === 'lista';
    console.log(`   ✓ ¿Transición a FINALIZADA? ${esTransicionAFinalizada} (anterior=${estadoAnteriorNorm}, nuevo=${estadoNuevoNorm})`);

    if (esTransicionAFinalizada) {
      console.log(`✉️ Enviando SMS #3: Orden COMPLETADA a ${telefono_cliente}`);
      console.log(`📊 Datos extraídos: tipo_vehiculo="${tipo_vehiculo}", cantidad_cascos=${cantidad_cascos}`);

      // 📥 Generar token para descarga de recibo
      console.log(`📥 Generando token para orden ${id_orden}, placa: ${placa_vehiculo}`);
      const tokenRecibo = await generarTokenRecibo(id_orden, placa_vehiculo);
      console.log(`📥 Token generado: ${tokenRecibo ? '✓ SÍ' : '✗ NO'}`);

      return await enviarNotificacionOrdenTerminada(
        telefono_cliente,
        nombre_cliente,
        valorTotal,
        placa_vehiculo,
        tipo_vehiculo,
        cantidad_cascos,
        id_orden,
        tokenRecibo,
        { orderId: id_orden, tipo: 'orden_completada' },
        credentials
      );
    }

    // ✅ CANCELACIÓN (Cualquier estado → Cancelada)
    if (estadoNuevo && estadoNuevo.toLowerCase().includes('cancel')) {
      console.log(`✉️ Enviando SMS: Orden CANCELADA a ${telefono_cliente}`);
      return await enviarNotificacionModificacion(
        telefono_cliente,
        nombre_cliente,
        '❌ Tu orden ha sido CANCELADA.\nSi tienes dudas, contáctanos.',
        { orderId: id_orden, tipo: 'orden_cancelada' },
        credentials
      );
    }

    console.warn(`⚠️ Transición no reconocida: ${estadoAnterior} → ${estadoNuevo}`);
    return { success: false, error: 'Transición de estado no reconocida' };

  } catch (error) {
    console.error('❌ Error enviando notificación automática:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Enviar notificación cuando hay cambio en los datos (no estado)
 */
export const enviarNotificacionPorModificacion = async (
  telefono,
  nombre,
  detallesCambio,
  metadata = {},
  credentials = null
) => {
  try {
    console.log(`✉️ Enviando SMS: Modificación de orden a ${telefono}`);
    return await enviarNotificacionModificacion(
      telefono,
      nombre,
      detallesCambio,
      { tipo: 'modificacion_orden', ...metadata },
      credentials
    );
  } catch (error) {
    console.error('❌ Error enviando notificación de modificación:', error.message);
    return { success: false, error: error.message };
  }
};
