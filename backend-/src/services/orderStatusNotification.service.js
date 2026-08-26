import {
  enviarNotificacionInicioServicio,
  enviarNotificacionOrdenListaSinRifa,
  enviarNotificacionOrdenListaConRifa,
  enviarNotificacionOrdenTerminada,
  enviarNotificacionModificacion
} from './notificationRouter.service.js';
import { generarTokenRecibo } from './reciboToken.service.js';

/**
 * Enviar notificación automática basada en cambio de estado
 * Se dispara cada vez que el estado de la orden cambia
 */
export const enviarNotificacionPorCambioEstado = async (
  estadoAnterior,
  estadoNuevo,
  ordenDatos,
  numeroRifa = null,
  credentials = null
) => {
  const { nombre_cliente, telefono_cliente, placa_vehiculo, tipo_vehiculo, cantidad_cascos, valorTotal, id_orden } = ordenDatos;

  // Validar datos mínimos
  if (!nombre_cliente || !telefono_cliente || !placa_vehiculo || !valorTotal) {
    console.warn('⚠️ Datos incompletos para enviar notificación', { id_orden });
    return { success: false, error: 'Datos incompletos' };
  }

  console.log(`📱 Cambio de estado: ${estadoAnterior} → ${estadoNuevo}`);

  try {
    // ✅ CUALQUIER ESTADO → PROCESO (Sin ser Proceso aún)
    if (estadoNuevo && estadoNuevo.toLowerCase().includes('proceso') && !estadoAnterior?.toLowerCase().includes('proceso')) {
      console.log(`✉️ Enviando SMS: Orden EN PROCESO a ${telefono_cliente}`);
      return await enviarNotificacionModificacion(
        telefono_cliente,
        nombre_cliente,
        '⏳ Tu orden está EN PROCESO.\nNos comunicaremos cuando esté lista.\n¡Gracias por tu paciencia! 🙏',
        { orderId: id_orden, tipo: 'estado_proceso' },
        credentials
      );
    }

    // ✅ CUALQUIER ESTADO → LISTA (Con o sin Rifa)
    if (estadoAnterior !== 'Lista' && estadoNuevo === 'Lista') {
      console.log(`✉️ Enviando SMS: Orden LISTA a ${telefono_cliente}`);

      // 📥 Generar token para descarga de recibo cuando la orden está lista
      console.log(`📥 Generando token para orden ${id_orden}, placa: ${placa_vehiculo}`);
      const tokenRecibo = await generarTokenRecibo(id_orden, placa_vehiculo);
      console.log(`📥 Token generado para Lista: ${tokenRecibo ? '✓ SÍ' : '✗ NO'}`);

      // Si hay rifa, usar plantilla con rifa
      if (numeroRifa) {
        console.log(`   Con rifa #${numeroRifa}`);
        return await enviarNotificacionOrdenListaConRifa(
          telefono_cliente,
          nombre_cliente,
          valorTotal,
          numeroRifa,
          placa_vehiculo,
          id_orden,
          { orderId: id_orden, tipo: 'estado_lista_rifa', tokenRecibo },
          credentials
        );
      }

      // Sin rifa, usar plantilla normal
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
    if (estadoAnterior === 'Lista' && estadoNuevo && estadoNuevo.toLowerCase().includes('finaliz')) {
      console.log(`✉️ Enviando SMS: Orden COMPLETADA a ${telefono_cliente}`);
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
