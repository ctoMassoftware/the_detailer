import * as labsmobileService from './labsmobile.service.js';
import * as whatsappService from './whatsapp.service.js';

const NOTIFICATION_CHANNEL = process.env.NOTIFICATION_CHANNEL || 'sms';

const getNotificationService = () => {
  if (NOTIFICATION_CHANNEL === 'whatsapp') {
    console.log('📱 Using WhatsApp channel');
    return whatsappService;
  }
  console.log('📧 Using SMS (LabsMobile) channel');
  return labsmobileService;
};

export const enviarNotificacionInicioServicio = async (telefono, nombreCliente, total, metadata = {}) => {
  const service = getNotificationService();
  return service.enviarNotificacionInicioServicio(telefono, nombreCliente, total, metadata);
};

export const enviarNotificacionOrdenListaSinRifa = async (telefono, nombreCliente, total, metadata = {}) => {
  const service = getNotificationService();
  return service.enviarNotificacionOrdenListaSinRifa(telefono, nombreCliente, total, metadata);
};

export const enviarNotificacionOrdenListaConRifa = async (telefono, nombreCliente, total, numeroRifa, metadata = {}) => {
  const service = getNotificationService();
  return service.enviarNotificacionOrdenListaConRifa(telefono, nombreCliente, total, numeroRifa, metadata);
};

export const enviarNotificacionOrdenTerminada = async (telefono, nombreCliente, total, metadata = {}) => {
  const service = getNotificationService();
  return service.enviarNotificacionOrdenTerminada(telefono, nombreCliente, total, metadata);
};

export const enviarNotificacionSimple = async (telefono, mensaje, metadata = {}) => {
  const service = getNotificationService();
  return service.enviarNotificacionSimple(telefono, mensaje, metadata);
};

export const enviarNotificacionModificacion = async (telefono, nombreCliente, detallesCambio, metadata = {}) => {
  const service = getNotificationService();
  return service.enviarNotificacionModificacion(telefono, nombreCliente, detallesCambio, metadata);
};

export const enviarReciboMostrador = async (telefono, nombreCliente, detallesRecibo, total, metadata = {}) => {
  const service = getNotificationService();
  return service.enviarReciboMostrador(telefono, nombreCliente, detallesRecibo, total, metadata);
};

export const getCurrentChannel = () => NOTIFICATION_CHANNEL;
