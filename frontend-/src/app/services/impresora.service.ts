import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImpresoraService {

  constructor() {}

  imprimirTicket(datosTicket: any, tipo: 'ORDEN' | 'MOSTRADOR', metodo: 'ANDROID' | 'WINDOWS' = 'ANDROID') {
    const fecha = new Date().toLocaleString("es-CO");
    let ticket = '';
    // --- ENCABEZADO EMPRESA ---
    ticket += `================================\n`;
    ticket += `        THE DETAILER\n`;
    ticket += `     Wash & Detailing\n`;
    ticket += `================================\n`;
    ticket += `NIT 100002212-9\n`;
    ticket += `REGIMEN RESPONSABLE DEL IVA\n`;
    ticket += `Crr 18 #2-13 Armenia Q.\n`;
    ticket += `3127736569\n`;
    ticket += `================================\n`;
    ticket += `Factura de Venta\n`;
    ticket += `--------------------------------\n`;
    // --- DATOS GENERALES ---
    ticket += `Orden: ${datosTicket?.numero || '---'}\n`;
    ticket += `Fecha: ${fecha}\n`;
    ticket += `Cliente: ${(datosTicket?.cliente || 'Cliente General').substring(0,20)}\n`;
    if (datosTicket?.placa) ticket += `Placa: ${datosTicket.placa}\n`;
    ticket += `--------------------------------\n`;
    // --- TABLA DE PRODUCTOS/SERVICIOS ---
    ticket += `Producto        Cant V.Unit  Subt\n`;
    ticket += `--------------------------------\n`;
    let servicios = datosTicket?.servicios;
    if ((!servicios || servicios.length === 0) && datosTicket?.serviciosDetallados && datosTicket.serviciosDetallados.length > 0) {
      servicios = datosTicket.serviciosDetallados;
    }
    if (servicios && servicios.length > 0) {
      servicios.forEach((item: any) => {
        // Nombre: 13, Cant: 4, V.Unit: 7, Subt: 7
        const nombre = (item.servicio || item.nombre || '').substring(0, 13).padEnd(13, ' ');
        const cant = (item.cantidad || 1).toString().padStart(4, ' ');
        const vunit = (item.precio_unitario || item.precio || item.valor || 0).toString().padStart(7, ' ');
        const subtotal = (item.subtotal || ((item.cantidad || 1) * (item.precio_unitario || item.precio || 0)) || 0).toString().padStart(7, ' ');
        ticket += `${nombre}${cant}${vunit}${subtotal}\n`;
      });
    } else {
      const nombre = (datosTicket?.servicioPrincipal || 'Servicio').substring(0, 13).padEnd(13, ' ');
      ticket += `${nombre}   1${(datosTicket?.total || 0).toString().padStart(14, ' ')}\n`;
    }
    ticket += `--------------------------------\n`;
    // --- TOTALES Y PAGO ---
    let totalTicket = datosTicket?.total;
    if ((totalTicket === undefined || totalTicket === null) && servicios && servicios.length > 0) {
      totalTicket = servicios.reduce((acc: number, s: any) => acc + (s.subtotal || (s.cantidad || 1) * (s.precio || s.precio_unitario || 0)), 0);
    }
    if (totalTicket === undefined || totalTicket === null) {
      totalTicket = 0;
    }
    ticket += `TOTAL A PAGAR: $${(totalTicket || 0).toLocaleString('es-CO')}\n`;
    ticket += `Forma de Pago: ${datosTicket?.metodoPago || 'Efectivo'}\n`;
    if (datosTicket?.recibido !== null && datosTicket?.recibido !== undefined) {
      ticket += `Recibido: $${(datosTicket.recibido).toLocaleString('es-CO')}\n`;
    }
    if (datosTicket?.cambio !== null && datosTicket?.cambio !== undefined) {
      ticket += `Cambio:   $${(datosTicket.cambio).toLocaleString('es-CO')}\n`;
    }
    ticket += `================================\n`;
    ticket += `Gracias por su compra!\n`;
    ticket += `* No responsable de IVA *\n`;
    ticket += `================================\n\n`;

    if (metodo === 'ANDROID') {
      // RawBT (Android)
      const ticketCodificado = encodeURI(ticket);
      const intentUrl = `intent:${ticketCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
      window.location.href = intentUrl;
    } else if (metodo === 'WINDOWS') {
      // Windows: abre ventana de impresión clásica
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write('<pre style="font-family: monospace; font-size: 13px;">' + ticket + '</pre>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      } else {
        alert('No se pudo abrir la ventana de impresión.');
      }
    }
  }
}