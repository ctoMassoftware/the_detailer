import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Nav } from '../../shared/nav/nav';
import { VentaMostradorService } from '../../services/venta-mostrador.service';
import { InventarioVentaService } from '../../services/inventario-venta.service';
import { RifaService } from '../../services/rifa.service'; 
import { ImpresoraService } from '../../services/impresora.service';

@Component({
  selector: 'app-venta-mostrador',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './venta-mostrador.html',
  styleUrl: './venta-mostrador.css',
})
export class VentaMostrador implements OnInit {
  // ...existing code...

  probarImpresoraWindows() {
    const datosTicket = {
      numero: '9999',
      cliente: 'Héctor (Prueba Windows)',
      placa: 'AWS-2026',
      total: 25000,
      metodoPago: 'Efectivo',
      numeroRifa: '777',
      servicios: [
        { nombre: 'Lavado VIP Prueba', cantidad: 1, precio: 25000, subtotal: 25000 }
      ]
    };
    const fecha = new Date().toLocaleString("es-CO");
    let ticket = '';
    ticket += `================================\n`;
    ticket += `          THE DETAILER\n`;
    ticket += `        Wash & Detailing\n`;
    ticket += `================================\n\n`;
    ticket += `Ticket #: ${datosTicket?.numero || '0000'}\n`;
    ticket += `Fecha: ${fecha}\n`;
    ticket += `Cliente: ${datosTicket?.cliente || 'Cliente General'}\n`;
    if (datosTicket?.placa) {
      ticket += `Vehiculo: ${datosTicket.placa}\n`;
    }
    ticket += `\n`;
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
      const nombreCorto = (datosTicket?.servicios?.[0]?.nombre || 'Servicio').substring(0, 15).padEnd(15, ' ');
      ticket += `1    | ${nombreCorto} | $${datosTicket?.total || 0}\n`;
    }
    ticket += `--------------------------------\n`;
    ticket += `TOTAL A PAGAR:      $${datosTicket?.total || 0}\n`;
    ticket += `Metodo de Pago:     ${datosTicket?.metodoPago || 'Efectivo'}\n\n`;
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
    // Abrir ventana de impresión
    const printWindow = window.open('', '', 'width=350,height=600');
    if (printWindow) {
      printWindow.document.write('<pre style="font-size:14px;">' + ticket + '</pre>');
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      this.mostrarMensaje('Abriendo ticket de prueba para impresión en Windows...', 'success');
    }
  }
  
  private ventaMostradorService = inject(VentaMostradorService);
  private inventarioService = inject(InventarioVentaService);
  private rifaService = inject(RifaService); 
  private impresoraService = inject(ImpresoraService);

  productosDisponibles: any[] = [];
  productosFiltrados: any[] = [];
  terminoBusqueda: string = '';

  carrito: any[] = [];
  totalCarrito: number = 0;

  clienteNombre: string = '';
  clienteTelefono: string = '';
  metodoPago: string = 'Efectivo';
  
  // VARIABLES NUEVAS CALCULADORA
  montoRecibido: number | null = null;

  mostrarFactura: boolean = false;
  mostrarRifa: boolean = false;
  facturaActual: any = {};
  
  preferenciaRecibo: 'VIRTUAL' | 'FISICO' = 'VIRTUAL';

  numeroBoletaRifa: string = '';
  datosRifaActiva: any = {
    fecha_sorteo: '',
    descripcion_premios: 'Cargando premios...',
    encargado: 'Cargando...'
  };
  numerosRifa: any[] = [];
  numerosRifaFiltrados: any[] = [];
  filtroRifa: string = '';

  mostrarAlerta: boolean = false;
  mensajeAlerta: string = '';
  tipoAlerta: 'success' | 'error' | 'confirm' = 'success';

  ngOnInit() {
    this.cargarProductos();
    this.cargarRifaActiva(); 
  }

  // GETTER PARA CALCULAR EL CAMBIO AUTOMÁTICAMENTE
  get cambioDevolver(): number {
    return (this.montoRecibido || 0) - this.totalCarrito;
  }

  // MÉTODO PARA BOTONES RÁPIDOS DE DINERO
  setMontoRecibido(monto: number) {
    this.montoRecibido = monto;
  }

  cargarProductos() {
    this.inventarioService.getProductos().subscribe({
      next: (res: any[]) => {
        this.productosDisponibles = res.filter(p => p.cantidad > 0);
        this.productosFiltrados = [...this.productosDisponibles];
      },
      error: (err: any) => console.error('Error al cargar inventario', err)
    });
  }

  buscarProducto() {
    if (!this.terminoBusqueda) {
      this.productosFiltrados = [...this.productosDisponibles];
      return;
    }
    const termino = this.terminoBusqueda.toLowerCase();
    this.productosFiltrados = this.productosDisponibles.filter(p => 
      p.nombre_producto.toLowerCase().includes(termino) || 
      (p.categoria && p.categoria.toLowerCase().includes(termino))
    );
  }

  agregarAlCarrito(producto: any) {
    const itemExistente = this.carrito.find(item => item.id_producto_venta === producto.id_producto_venta);

    if (itemExistente) {
      if (itemExistente.cantidad < producto.cantidad) { 
        itemExistente.cantidad++;
        itemExistente.subtotal = itemExistente.cantidad * itemExistente.precio_venta;
      } else {
        this.mostrarMensaje(`No hay suficiente stock. Máximo disponible: ${producto.cantidad}`, 'error');
      }
    } else {
      this.carrito.push({
        ...producto,
        cantidad: 1, 
        subtotal: producto.precio_venta
      });
    }
    this.calcularTotalCarrito();
  }

  quitarDelCarrito(index: number) {
    this.carrito.splice(index, 1);
    this.calcularTotalCarrito();
  }

  actualizarCantidad(index: number, nuevaCantidad: number) {
    const item = this.carrito[index];
    const productoOriginal = this.productosDisponibles.find(p => p.id_producto_venta === item.id_producto_venta);

    if (nuevaCantidad > 0 && nuevaCantidad <= productoOriginal.cantidad) {
      item.cantidad = nuevaCantidad;
      item.subtotal = item.cantidad * item.precio_venta;
    } else if (nuevaCantidad > productoOriginal.cantidad) {
      this.mostrarMensaje(`El stock máximo de ${productoOriginal.nombre_producto} es ${productoOriginal.cantidad}.`, 'error');
      item.cantidad = productoOriginal.cantidad;
      item.subtotal = item.cantidad * item.precio_venta;
    }
    this.calcularTotalCarrito();
  }

  calcularTotalCarrito() {
    this.totalCarrito = this.carrito.reduce((sum, item) => sum + Number(item.subtotal), 0);
  }

  capitalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto.toLowerCase().split(' ').map(palabra => 
      palabra.charAt(0).toUpperCase() + palabra.slice(1)
    ).join(' ');
  }

  cargarRifaActiva() {
    this.rifaService.getRifaActiva().subscribe({
      next: (data: any) => {
        if (data && data.id_evento) {
          this.datosRifaActiva = data;
        } else {
          this.datosRifaActiva.descripcion_premios = 'No hay rifa activa actualmente';
          this.datosRifaActiva.fecha_sorteo = '';
          this.datosRifaActiva.encargado = '---';
        }
      },
      error: (err: any) => {
        console.error('Error cargando rifa activa', err);
        this.datosRifaActiva.descripcion_premios = 'Error de conexión / Sin rifa activa';
      }
    });
  }

  abrirFactura() {
    if (this.carrito.length === 0) {
      this.mostrarMensaje('El carrito está vacío.', 'error');
      return;
    }
    
    this.facturaActual = {
      numero: 'Pte. Generar',
      fecha: new Date().toLocaleDateString('es-CO'),
      cliente: this.clienteNombre || 'Cliente General',
      celular: this.clienteTelefono || 'No registrado',
      vehiculoPlaca: 'N/A', 
      valorTotal: this.totalCarrito,
      metodoPago: this.metodoPago,
      // Guardamos la info del cambio en la factura para imprimirla
      montoRecibido: this.montoRecibido,
      cambio: this.cambioDevolver,
      serviciosDetallados: this.carrito.map(c => ({
        servicio: c.nombre_producto,
        cantidad: c.cantidad,
        precio_unitario: c.precio_venta,
        subtotal: c.subtotal
      }))
    };

    this.preferenciaRecibo = 'VIRTUAL';
    this.mostrarFactura = true;
    this.mostrarRifa = false;
    this.numeroBoletaRifa = '';
  }

  cerrarFactura() {
    this.mostrarFactura = false;
    this.mostrarRifa = false;
  }

  aceptarRifa() {
    this.mostrarRifa = true;
    this.cargarNumerosRifa();
  }

  rechazarRifa() {
    this.mostrarRifa = false;
    this.numeroBoletaRifa = '';
  }

  cargarNumerosRifa() {
    if (!this.datosRifaActiva?.id_evento) return;

    const totalNumeros = 1000;
    const baseGrid = Array.from({ length: totalNumeros }, (_, i) => {
      const valor = i.toString().padStart(3, '0');
      return { valor, estado: 'libre', ocupadoPor: '', nombre: '', telefono: '' };
    });

    this.rifaService.getBoletasPorEvento(this.datosRifaActiva.id_evento).subscribe({
      next: (boletasOcupadas: any[]) => {
        boletasOcupadas.forEach(b => {
          const idx = parseInt(b.numero_boleta, 10);
          if (baseGrid[idx]) {
            baseGrid[idx].estado = 'ocupado';
            baseGrid[idx].ocupadoPor = b.nombre;
          }
        });

        this.numerosRifa = baseGrid;
        this.aplicarFiltroRifa();
      },
      error: (err: any) => console.error('Error cargando boletas de rifa', err)
    });
  }

  aplicarFiltroRifa() {
    const texto = (this.filtroRifa || '').trim();
    if (!texto) {
      this.numerosRifaFiltrados = this.numerosRifa;
      return;
    }
    this.numerosRifaFiltrados = this.numerosRifa.filter(n => n.valor.includes(texto));
  }

  seleccionarNumeroRifa(item: any) {
    if (item.estado === 'ocupado') return;

    const anterior = this.numerosRifa.find(n => n.estado === 'seleccionado');
    if (anterior) anterior.estado = 'libre';

    item.estado = 'seleccionado';
    this.numeroBoletaRifa = item.valor;
  }


  metodoImpresion: 'WINDOWS' | 'RAWBT' = 'WINDOWS';

  confirmarFacturaYVenta() {
    if (this.preferenciaRecibo === 'VIRTUAL' && !this.facturaActual.celular && this.facturaActual.celular !== 'No registrado') {
      this.mostrarMensaje('Para el recibo virtual es obligatorio el número de WhatsApp.', 'error');
      return;
    }

    if (this.mostrarRifa) {
      if (!this.numeroBoletaRifa || this.numeroBoletaRifa.length !== 3 || isNaN(Number(this.numeroBoletaRifa))) {
        this.mostrarMensaje('Debe seleccionar un número de boleta de 3 dígitos.', 'error');
        return;
      }
    }

    const nombreFormateado = this.capitalizarTexto(this.facturaActual.cliente);

    const payloadVenta = {
      cliente_nombre: nombreFormateado,
      telefono_cliente: this.facturaActual.celular === 'No registrado' ? '' : this.facturaActual.celular,
      metodo_pago: this.facturaActual.metodoPago,
      total: this.facturaActual.valorTotal,
      productos: this.carrito,
      preferencia_recibo: this.preferenciaRecibo
    };

    this.ventaMostradorService.registrarVenta(payloadVenta).subscribe({
      next: (res: any) => {
        if (this.mostrarRifa) {
          const boletaData = {
            numero_boleta: this.numeroBoletaRifa,
            nombre: nombreFormateado,
            telefono: payloadVenta.telefono_cliente,
            placa_vehiculo: 'N/A',
            total_pagar: this.facturaActual.valorTotal,
            preferencia_recibo: this.preferenciaRecibo
          };

          this.rifaService.registrarBoleta(boletaData).subscribe({
            next: () => {
              this.procesarImpresion(res.id_venta, nombreFormateado);
              this.finalizarProcesoExito(`¡Venta y Rifa #${this.numeroBoletaRifa} registradas con éxito!`);
            },
            error: (err: any) => {
              const msj = err.error?.error || 'Error al registrar la boleta';
              this.mostrarMensaje(`La venta se guardó, pero hubo un error en la Rifa: ${msj}`, 'error');
              this.limpiarCarritoSoloDatos();
              this.cerrarFactura();
            }
          });
        } else {
          this.procesarImpresion(res.id_venta, nombreFormateado);
          this.finalizarProcesoExito('¡Venta registrada con éxito!');
        }
      },
      error: (err: any) => {
        console.error('Error al registrar la venta', err);
        this.mostrarMensaje('Ocurrió un error al registrar la venta en la base de datos.', 'error');
      }
    });
  }

  private procesarImpresion(idVenta: number, nombreFormateado: string) {
    if (this.preferenciaRecibo === 'FISICO') {
      const datosTicket = {
        numero: idVenta,
        cliente: nombreFormateado,
        placa: 'N/A',
        total: this.facturaActual.valorTotal,
        metodoPago: this.facturaActual.metodoPago,
        recibido: this.facturaActual.metodoPago === 'Efectivo' ? this.facturaActual.montoRecibido : null,
        cambio: this.facturaActual.metodoPago === 'Efectivo' ? this.facturaActual.cambio : null,
        numeroRifa: this.mostrarRifa ? this.numeroBoletaRifa : null,
        servicios: this.carrito.map(c => ({
          nombre: c.nombre_producto,
          cantidad: c.cantidad,
          precio: c.precio_venta,
          subtotal: c.subtotal
        }))
      };
      if (this.metodoImpresion === 'RAWBT') {
        this.probarImpresoraDirectoConDatos(datosTicket);
      } else {
        this.probarImpresoraWindowsConDatos(datosTicket);
      }
    }
  }

  probarImpresoraDirectoConDatos(datosTicket: any) {
    this.impresoraService.imprimirTicket(datosTicket, 'MOSTRADOR');
    this.mostrarMensaje('Enviando ticket a RawBT...', 'success');
  }

  probarImpresoraWindowsConDatos(datosTicket: any) {
    const fecha = new Date().toLocaleString("es-CO");
    let ticket = '';
    // Encabezado para 58mm (32 caracteres)
    ticket += `================================\n`;
    ticket += `        THE DETAILER\n`;
    ticket += `     Wash & Detailing\n`;
    ticket += `================================\n`;
    ticket += `Ticket: ${String(datosTicket?.numero || '0000').padEnd(6)}\n`;
    ticket += `Fecha: ${fecha}\n`;
    ticket += `Cliente: ${(datosTicket?.cliente || 'Cliente General').substring(0,20)}\n`;
    if (datosTicket?.placa) {
      ticket += `Placa: ${datosTicket.placa}\n`;
    }
    ticket += `--------------------------------\n`;
    ticket += `C  Producto         Subt\n`;
    ticket += `--------------------------------\n`;
    if (datosTicket?.servicios && datosTicket.servicios.length > 0) {
      datosTicket.servicios.forEach((item: any) => {
        const nombreCorto = (item.nombre || '').substring(0, 13).padEnd(13, ' ');
        const cant = (item.cantidad || 1).toString().padStart(2, ' ');
        const subtotal = (item.subtotal || (item.cantidad * item.precio) || 0).toString().padStart(6, ' ');
        ticket += `${cant} ${nombreCorto} ${subtotal}\n`;
      });
    } else {
      const nombreCorto = (datosTicket?.servicios?.[0]?.nombre || 'Servicio').substring(0, 13).padEnd(13, ' ');
      ticket += ` 1 ${nombreCorto} ${(datosTicket?.total || 0).toString().padStart(6, ' ')}\n`;
    }
    ticket += `--------------------------------\n`;
    ticket += `TOTAL:        $${(datosTicket?.total || 0).toString().padStart(7, ' ')}\n`;
    ticket += `Pago: ${datosTicket?.metodoPago || 'Efectivo'}\n`;
    if (datosTicket?.recibido !== null && datosTicket?.recibido !== undefined) {
      ticket += `Recibido: $${(datosTicket.recibido).toString().padStart(7, ' ')}\n`;
    }
    if (datosTicket?.cambio !== null && datosTicket?.cambio !== undefined) {
      ticket += `Cambio:   $${(datosTicket.cambio).toString().padStart(7, ' ')}\n`;
    }
    if (datosTicket?.numeroRifa) {
      ticket += `--------------------------------\n`;
      ticket += `  *** BOLETA DE RIFA ***\n`;
      ticket += `  Numero: ${datosTicket.numeroRifa}\n`;
      ticket += `  Guarde este recibo!\n`;
      ticket += `--------------------------------\n`;
    }
    ticket += `================================\n`;
    ticket += `Gracias por su compra!\n`;
    ticket += `* No responsable de IVA *\n`;
    ticket += `================================\n\n`;
    // Abrir ventana de impresión con tamaño de letra pequeño y ancho 58mm
    const printWindow = window.open('', '', 'width=220,height=700');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(`<pre style='font-size:12px; font-family:monospace; margin:0; padding:0;'>${ticket}</pre>`);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      this.mostrarMensaje('Abriendo ticket de prueba para impresión en Windows...', 'success');
    }
  }



  finalizarProcesoExito(mensajeDeseado: string) {
    this.cerrarFactura();
    this.limpiarCarritoSoloDatos();
    this.cargarProductos(); 
    setTimeout(() => {
      this.mostrarMensaje(mensajeDeseado, 'success');
    }, 150);
  }

  limpiarCarritoSoloDatos() {
    this.carrito = [];
    this.clienteNombre = '';
    this.clienteTelefono = '';
    this.metodoPago = 'Efectivo';
    this.terminoBusqueda = '';
    this.montoRecibido = null; // Reiniciamos la calculadora
    this.buscarProducto();
    this.calcularTotalCarrito();
  }

  limpiarCarrito() {
    this.limpiarCarritoSoloDatos();
  }

  mostrarMensaje(texto: string, tipo: 'success' | 'error' | 'confirm') {
    this.mensajeAlerta = texto;
    this.tipoAlerta = tipo;
    this.mostrarAlerta = true;
  }

  cerrarAlerta() {
    this.mostrarAlerta = false;
  }

  // --- BOTÓN TEMPORAL DE PRUEBA DE IMPRESORA ---
  probarImpresoraDirecto() {
    const datosTicket = {
      numero: '9999',
      cliente: 'Héctor (Prueba Docker)',
      placa: 'AWS-2026',
      total: 25000,
      metodoPago: 'Efectivo',
      numeroRifa: '777',
      servicios: [
        { nombre: 'Lavado VIP Prueba', cantidad: 1, precio: 25000, subtotal: 25000 }
      ]
    };

    this.impresoraService.imprimirTicket(datosTicket, 'MOSTRADOR');
    this.mostrarMensaje('Enviando ticket de prueba a RawBT...', 'success');
  }

}