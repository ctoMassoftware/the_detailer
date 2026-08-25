import {
  enviarNotificacionInicioServicio,
  enviarNotificacionOrdenListaSinRifa,
  enviarNotificacionOrdenListaConRifa,
  enviarNotificacionOrdenTerminada,
  enviarNotificacionModificacion
} from './notificationRouter.service.js';

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
  const { nombre_cliente, telefono_cliente, placa_vehiculo, valorTotal, id_orden } = ordenDatos;

  // Validar datos mínimos
  if (!nombre_cliente || !telefono_cliente || !placa_vehiculo || !valorTotal) {
    console.warn('⚠️ Datos incompletos para enviar notificación', { id_orden });
    return { success: false, error: 'Datos incompletos' };
  }

  console.log(`📱 Cambio de estado: ${estadoAnterior} → ${estadoNuevo}`);

  try {
    // RECIBIDA → PROCESO (Sin cambio de estado visible, ya se envía al crear)
    // Solo se envía una vez al crear la orden en createOrden()

    // PROCESO → LISTA (Sin Rifa)
    if (estadoAnterior !== 'Lista' && estadoNuevo === 'Lista' && !numeroRifa) {
      console.log(`✉️ Enviando SMS: Orden LISTA (sin rifa) a ${telefono_cliente}`);
      return await enviarNotificacionOrdenListaSinRifa(
        telefono_cliente,
        nombre_cliente,
        valorTotal,
        { orderId: id_orden, tipo: 'estado_lista' },
        credentials
      );
    }

    // PROCESO → LISTA (Con Rifa)
    if (estadoAnterior !== 'Lista' && estadoNuevo === 'Lista' && numeroRifa) {
      console.log(`✉️ Enviando SMS: Orden LISTA con rifa #${numeroRifa} a ${telefono_cliente}`);
      return await enviarNotificacionOrdenListaConRifa(
        telefono_cliente,
        nombre_cliente,
        valorTotal,
        numeroRifa,
        { orderId: id_orden, tipo: 'estado_lista_rifa' },
        credentials
      );
    }

    // LISTA → FINALIZADA
    if (estadoAnterior === 'Lista' && estadoNuevo === 'Orden finalizada') {
      console.log(`✉️ Enviando SMS: Orden COMPLETADA a ${telefono_cliente}`);
      return await enviarNotificacionOrdenTerminada(
        telefono_cliente,
        nombre_cliente,
        valorTotal,
        { orderId: id_orden, tipo: 'orden_completada' },
        credentials
      );
    }

    // PROCESO → CANCELADA
    if (estadoNuevo === 'Cancelada') {
      console.log(`✉️ Enviando SMS: Orden CANCELADA a ${telefono_cliente}`);
      return await enviarNotificacionModificacion(
        telefono_cliente,
        nombre_cliente,
        '❌ Tu orden ha sido CANCELADA.\nSi tienes dudas, contáctanos.',
        { orderId: id_orden, tipo: 'orden_cancelada' },
        credentials
      );
    }

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
