import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ImpresoraService {

  private authService = inject(AuthService);
  constructor() { }

  imprimirTicket(datosTicket: any, tipo: 'ORDEN' | 'MOSTRADOR', metodo: 'ANDROID' | 'WINDOWS' | 'RAWBT' = 'ANDROID') {
    const fecha = new Date().toLocaleString("es-CO");
    let ticket = '';
    // --- ENCABEZADO EMPRESA ---
    ticket += `================================\n`;
    ticket += `* No responsable de IVA *\n`;
    ticket += `================================\n`;
    ticket += `NIT 100002212-9\n`;
    // Dirección según sede
    const sede = this.authService.getSede?.() || '';
    let direccion = '';
    if (sede.toUpperCase() === 'GALAN') {
      direccion = 'Cra. 18 #2-13 Barrio Galan.';
    } else if (sede.toUpperCase() === 'CENTENARIO') {
      direccion = 'Cra. 06 #7-30 AV.Centenario.';
    } else {
      direccion = 'Cra. 18 #2-13 Armenia Q.';
    }
    ticket += `${direccion}\n`;
    ticket += `3127736569\n`;
    ticket += `================================\n`;
    ticket += `Factura de Venta\n`;
    ticket += `--------------------------------\n`;
    // --- DATOS GENERALES ---
    ticket += `Orden: ${datosTicket?.numero || '---'}\n`;
    ticket += `Fecha: ${fecha}\n`;
    ticket += `Cliente: ${(datosTicket?.cliente || 'Cliente General').substring(0, 20)}\n`;
    if (tipo === 'ORDEN' && datosTicket?.placa) ticket += `Placa: ${datosTicket.placa}\n`;
    ticket += `--------------------------------\n`;
    // --- TABLA DE PRODUCTOS/SERVICIOS ---
    ticket += `Producto  |Cant| V.Unit| Subt |\n`;
    ticket += `--------------------------------\n`;
    let servicios = datosTicket?.servicios;
    if ((!servicios || servicios.length === 0) && datosTicket?.serviciosDetallados && datosTicket.serviciosDetallados.length > 0) {
      servicios = datosTicket.serviciosDetallados;
    }
    // Siempre imprimir todos los servicios, aunque solo uno esté seleccionado
    if (servicios && servicios.length > 0) {
      servicios.forEach((item: any) => {
        const nombre = (item.servicio || item.nombre || '').substring(0, 11).padEnd(11, ' ');
        // Sin padding a la derecha ni a la izquierda
        const cant = (item.cantidad || 1).toString();
        const vunitRaw = item.precio_unitario || item.precio || item.valor || 0;
        const vunit = Math.round(vunitRaw).toLocaleString('es-CO', { maximumFractionDigits: 0 });
        const subtotalRaw = item.subtotal || ((item.cantidad || 1) * (item.precio_unitario || item.precio || 0)) || 0;
        const subtotal = Math.round(subtotalRaw).toLocaleString('es-CO', { maximumFractionDigits: 0 });
        ticket += `${nombre}| ${cant} |$${vunit}|$${subtotal}|\n`;
      });
    } else {
      const nombre = (datosTicket?.servicioPrincipal || 'Servicio').substring(0, 11).padEnd(11, ' ');
      const totalRaw = datosTicket?.total || 0;
      const totalStr = Math.round(totalRaw).toLocaleString('es-CO', { maximumFractionDigits: 0 });
      const total = totalStr.padStart(18, ' ');
      ticket += `${nombre}| 1 |${total}|\n`;
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
    ticket += `TOTAL A PAGAR: $${Math.round(totalTicket || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}\n`;
    ticket += `Forma de Pago: ${datosTicket?.metodoPago || 'Efectivo'}\n`;
    // Mostrar recibido y cambio solo si es venta mostrador y método efectivo
    if (tipo === 'MOSTRADOR' && datosTicket?.metodoPago === 'Efectivo') {
      if (datosTicket?.recibido !== null && datosTicket?.recibido !== undefined) {
        ticket += `Recibido: $${Math.round(datosTicket.recibido).toLocaleString('es-CO', { maximumFractionDigits: 0 })}\n`;
      }
      if (datosTicket?.cambio !== null && datosTicket?.cambio !== undefined) {
        ticket += `Cambio:   $${Math.round(datosTicket.cambio).toLocaleString('es-CO', { maximumFractionDigits: 0 })}\n`;
      }
    }

    // --- INFORMACIÓN DE RIFA ---
    if (datosTicket?.numeroRifa) {
      ticket += `--------------------------------\n`;
      ticket += `       *** BOLETA DE RIFA ***\n`;
      ticket += `          Numero: ${datosTicket.numeroRifa}\n`;
      ticket += `        Guarde este recibo!\n`;
      ticket += `--------------------------------\n`;
    }
    ticket += `================================\n`;
    ticket += `Gracias por su compra!\n`;
    ticket += `* No responsable de IVA *\n`;
    ticket += `================================\n\n`;

    if (metodo === 'ANDROID' || metodo === 'RAWBT') {
      // RawBT (Android)
      const ticketCodificado = encodeURIComponent(ticket);
      const intentUrl = `intent:${ticketCodificado}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
      window.location.href = intentUrl;
    } else if (metodo === 'WINDOWS') {
      // Windows: abre ventana de impresión clásica
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write('<pre style="font-family: monospace; font-size: 7px;">' + ticket + '</pre>');
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