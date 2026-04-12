import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImpresoraService {

  constructor() {}

  imprimirTicket(datosTicket: any, tipo: 'ORDEN' | 'MOSTRADOR') {
    const fecha = new Date().toLocaleString("es-CO");
    let ticket = '';

    // --- CABECERA ---
    ticket += `================================\n`;
    ticket += `          THE DETAILER\n`;
    ticket += `        Wash & Detailing\n`;
    ticket += `================================\n\n`;

    // --- DATOS DEL CLIENTE ---
    ticket += `Ticket #: ${datosTicket?.numero || '0000'}\n`;
    ticket += `Fecha: ${fecha}\n`;
    ticket += `Cliente: ${datosTicket?.cliente || 'Cliente General'}\n`;
    
    if (tipo === 'ORDEN' && datosTicket?.placa) {
      ticket += `Vehiculo: ${datosTicket.placa}\n`;
    }
    ticket += `\n`;

    // --- SERVICIOS ---
    ticket += `CANT | PRODUCTO/SERVICIO   | SUBTOTAL\n`;
    ticket += `--------------------------------\n`;
    
    if (datosTicket?.servicios && datosTicket.servicios.length > 0) {
      datosTicket.servicios.forEach((item: any) => {
        const nombreCorto = (item.nombre || '').substring(0, 15).padEnd(15, ' ');
        const cant = (item.cantidad || 1).toString().padEnd(4, ' ');
        const subtotal = item.subtotal || (item.cantidad * item.precio) || 0;
        ticket += `${cant} | ${nombreCorto} | $${subtotal}\n`;
      });
    } else {
      const nombreCorto = (datosTicket?.servicioPrincipal || 'Servicio').substring(0, 15).padEnd(15, ' ');
      ticket += `1    | ${nombreCorto} | $${datosTicket?.total || 0}\n`;
    }

    ticket += `--------------------------------\n`;
    
    // --- TOTALES ---
    ticket += `TOTAL A PAGAR:      $${datosTicket?.total || 0}\n`;
    ticket += `Metodo de Pago:     ${datosTicket?.metodoPago || 'Efectivo'}\n\n`;
    
    // --- RIFA ---
    if (datosTicket?.numeroRifa) {
      ticket += `--------------------------------\n`;
      ticket += `       *** BOLETA DE RIFA ***\n`;
      ticket += `          Numero: ${datosTicket.numeroRifa}\n`;
      ticket += `        Guarde este recibo!\n`;
      ticket += `--------------------------------\n\n`;
    }

    ticket += `================================\n`;
    ticket += `      Gracias por su compra!\n`;
    ticket += `     * No responsable de IVA *\n`;
    ticket += `================================\n\n\n`;

    // --- MÉTODO CLÁSICO SEGURO (El que no tumba el WiFi) ---
    const ticketCodificado = encodeURI(ticket);
    const intentUrl = `intent:${ticketCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    
    window.location.href = intentUrl;
  }
}