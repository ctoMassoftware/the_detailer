import { Component, OnInit, inject } from '@angular/core';
import { Nav } from '../../shared/nav/nav';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OrdenService } from '../../services/orden.service';
import { OperarioService } from '../../services/operario.service';
import { RifaService } from '../../services/rifa.service';
import { ServicioService } from '../../services/servicio.service';
import { ImpresoraService } from '../../services/impresora.service';
import Swal from 'sweetalert2';

interface Orden {
  id_orden_db: number;
  numero: string;
  fecha: string;
  hora: string;
  estado: string;
  cliente: string;
  cedula: string;
  celular: string;
  email: string;
  direccion: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoPlaca: string;
  vehiculoTipo?: string;
  serviciosDetallados?: any[];
  servicioPrincipal?: string;
  operario?: string;
  id_operario?: number | null;
  metodoPago?: string;
  caja?: string;
  valorTotal?: number;
  notas?: string;
  // ✅ Campos de casco
  dejoCasco?: boolean;
  cantidadCascos?: number;
}

@Component({
  selector: 'app-consultar-orden',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './consultar-orden.html',
  styleUrls: ['./consultar-orden.css']
})
export class ConsultarOrden implements OnInit {

  totalEfectivoFiltrado: number = 0;
  totalTransferenciaFiltrado: number = 0;

  // --- Adicional (modal y lógica) ---
  mostrarModalAdicional: boolean = false;
  descAdicional: string = '';
  valorAdicional: number | null = null;

  onServicioSeleccionado() {
    if (this.servicioSeleccionadoParaAgregar === 'ADICIONAL') {
      this.servicioSeleccionadoParaAgregar = null;
      this.abrirModalAdicional();
    }
  }

  abrirModalAdicional() {
    this.descAdicional = '';
    this.valorAdicional = null;
    this.mostrarModalAdicional = true;
  }

  cerrarModalAdicional() {
    this.mostrarModalAdicional = false;
  }

  confirmarAdicional() {
    if (!this.descAdicional || !this.valorAdicional || this.valorAdicional <= 0) return;
    if (!this.ordenSeleccionada.serviciosDetallados) this.ordenSeleccionada.serviciosDetallados = [];
    this.ordenSeleccionada.serviciosDetallados.push({
      nombre: this.descAdicional,
      precio: this.valorAdicional,
      cantidad: 1,
      tipo: 'Adicional'
    });
    this.ordenSeleccionada.serviciosDetallados = this.ordenSeleccionada.serviciosDetallados.filter(
      (s: any) => s.tipo !== 'Adicional' || (s.precio && s.precio > 0)
    );
    this.recalcularTotal();
    this.cerrarModalAdicional();
  }

  validarSoloNumeros(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onPreferenciaReciboChange(tipo: string, event: any) {
    if (event.target.checked) {
      if (!this.preferenciaRecibo.includes(tipo)) {
        this.preferenciaRecibo.push(tipo);
      }
    } else {
      this.preferenciaRecibo = this.preferenciaRecibo.filter(t => t !== tipo);
    }
    if (this.preferenciaRecibo.length === 2) return;
    if (tipo === 'VIRTUAL' && event.target.checked) {
      this.preferenciaRecibo = ['VIRTUAL'];
    } else if (tipo === 'FISICO' && event.target.checked) {
      this.preferenciaRecibo = ['FISICO'];
    }
  }

  metodoImpresionFacturaOrden: 'WINDOWS' | 'RAWBT' = 'RAWBT';

  private ordenService = inject(OrdenService);
  private operarioService = inject(OperarioService);
  private rifaService = inject(RifaService);
  private servicioService = inject(ServicioService);
  private impresoraService = inject(ImpresoraService);
  private route = inject(ActivatedRoute);

  sedeSeleccionada: string | null = null;
  rolUsuario: string = '';

  filtroOperario: string = '';
  filtroFecha: string = '';

  mostrarModal: boolean = false;
  mostrarFactura: boolean = false;
  mostrarRifa: boolean = false;
  modoEdicion: boolean = false;

  preferenciaRecibo: string[] = ['VIRTUAL'];

  // VARIABLES CALCULADORA
  montoRecibido: number | null = null;

  ordenSeleccionada: Orden | any = {
    dejoCasco: false,
    cantidadCascos: 1
  };
  ordenesRegistradas: Orden[] = [];
  ordenesFiltradas: Orden[] = [];
  listaOperarios: any[] = [];
  listaServicios: any[] = [];
  servicioSeleccionadoParaAgregar: any = null;

  paginaActual: number = 1;
  itemsPorPagina: number = 10;
  totalItems: number = 0;

  totalFiltrado: number = 0;
  pagoOperarioFiltrado: number = 0;
  mostrarTotal: boolean = false;

  numeroBoletaRifa: string = '';
  datosRifaActiva: any = {
    fecha_sorteo: '',
    descripcion_premios: 'Cargando premios...',
    encargado: 'Cargando...'
  };

  ngOnInit() {
    const userStr = localStorage.getItem('user') || localStorage.getItem('usuario');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.rolUsuario = user.rol || user.role || '';
      } catch (e) {}
    }
    if (!this.rolUsuario) {
      this.rolUsuario = localStorage.getItem('rol') || localStorage.getItem('role') || '';
    }

    this.route.queryParams.subscribe(params => {
      this.sedeSeleccionada = params['sede'] || null;
      this.cargarOrdenes();
      this.cargarOperarios();
      this.cargarServicios();
      this.cargarRifaActiva();
    });
  }

  // GETTER Y MÉTODOS CALCULADORA DE VUELTOS
  get cambioDevolver(): number {
    return (this.montoRecibido || 0) - (this.ordenSeleccionada?.valorTotal || 0);
  }

  setMontoRecibido(monto: number) {
    this.montoRecibido = monto;
  }

  resetCalculadora() {
    this.montoRecibido = null;
  }

  puedeModificarOrden(orden: Orden): boolean {
    if (this.rolUsuario === 'SUPER_ADMIN') return true;
    if (orden.estado === 'Orden finalizada') return false;
    return true;
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

  private formatearFecha(fecha: string | Date): string {
    if (!fecha) return '';
    if (typeof fecha === 'string') return fecha.split('T')[0];
    return new Date(fecha).toISOString().split('T')[0];
  }

  cargarOperarios() {
    this.operarioService.getOperarios(this.sedeSeleccionada || undefined).subscribe({
      next: (data: any[]) => this.listaOperarios = data,
      error: (err: any) => console.error('Error cargando operarios', err)
    });
  }

  cargarServicios() {
    this.servicioService.getServicios().subscribe({
      next: (data: any) => {
        let rawList: any[] = [];
        if (Array.isArray(data)) {
          rawList = data;
        } else if (data && typeof data === 'object') {
          const keys = Object.keys(data);
          for (const key of keys) {
            if (Array.isArray(data[key])) rawList = [...rawList, ...data[key]];
          }
        }

        this.listaServicios = rawList.map((item: any) => {
          const precioDefault = Number(item.precio_automovil || item.precio || item.valor || 0);
          return {
            ...item,
            id_servicio: item.id_servicio,
            nombre: item.nombre || item.nombre_servicio || item.descripcion || item.servicio || 'Sin Nombre',
            precio: precioDefault,
            precio_automovil: Number(item.precio_automovil || 0),
            precio_campero: Number(item.precio_campero || 0),
            precio_camioneta: Number(item.precio_camioneta || 0),
            precio_moto: Number(item.precio_moto || 0),
            aplica_automovil: item.aplica_automovil !== false,
            aplica_campero: item.aplica_campero !== false,
            aplica_camioneta: item.aplica_camioneta !== false,
            aplica_moto: item.aplica_moto !== false,
            tipo: item.tipo || 'General'
          };
        });
      },
      error: (err: any) => console.error('Error cargando servicios', err)
    });
  }

  get serviciosDisponiblesParaVehiculo() {
    const tipo = (this.ordenSeleccionada?.vehiculoTipo || '').toLowerCase();
    return this.listaServicios.filter((item: any) => {
      if ((item.tipo === 'Adicional' || item.nombre?.toLowerCase().includes('adicional')) && (!item.precio || item.precio <= 0)) {
        return false;
      }
      if (tipo.includes('automovil')) return item.aplica_automovil !== false;
      if (tipo.includes('campero')) return item.aplica_campero !== false;
      if (tipo.includes('camioneta')) return item.aplica_camioneta !== false;
      if (tipo.includes('moto')) return item.aplica_moto !== false;
      return true;
    });
  }

  agregarServicio() {
    if (!this.servicioSeleccionadoParaAgregar) return;

    const tipoVehiculo = (this.ordenSeleccionada.vehiculoTipo || '').toLowerCase();
    let precioSegunTipo = this.servicioSeleccionadoParaAgregar.precio_automovil || 0;

    if (tipoVehiculo.includes('campero')) precioSegunTipo = this.servicioSeleccionadoParaAgregar.precio_campero || 0;
    else if (tipoVehiculo.includes('camioneta')) precioSegunTipo = this.servicioSeleccionadoParaAgregar.precio_camioneta || 0;
    else if (tipoVehiculo.includes('moto')) precioSegunTipo = this.servicioSeleccionadoParaAgregar.precio_moto || 0;

    const nuevoServicio = {
      id_servicio: this.servicioSeleccionadoParaAgregar.id_servicio,
      servicio: this.servicioSeleccionadoParaAgregar.nombre,
      nombre: this.servicioSeleccionadoParaAgregar.nombre,
      cantidad: 1,
      precio: precioSegunTipo,
      precio_unitario: precioSegunTipo
    };

    if (!this.ordenSeleccionada.serviciosDetallados) this.ordenSeleccionada.serviciosDetallados = [];
    this.ordenSeleccionada.serviciosDetallados.push(nuevoServicio);
    this.recalcularTotal();
    this.servicioSeleccionadoParaAgregar = null;
  }

  eliminarServicio(index: number) {
    this.ordenSeleccionada.serviciosDetallados.splice(index, 1);
    this.recalcularTotal();
  }

  recalcularTotal() {
    if (this.ordenSeleccionada.serviciosDetallados) {
      this.ordenSeleccionada.serviciosDetallados = this.ordenSeleccionada.serviciosDetallados.filter(
        (s: any) => s.tipo !== 'Adicional' || (s.precio && s.precio > 0)
      );
    }
    let total = 0;
    if (this.ordenSeleccionada.serviciosDetallados) {
      this.ordenSeleccionada.serviciosDetallados.forEach((item: any) => {
        const precio = parseFloat(item.precio || item.valor || item.precio_unitario || 0);
        const cantidad = item.cantidad || 1;
        total += precio * cantidad;
      });
    }
    this.ordenSeleccionada.valorTotal = total;
  }

  cargarOrdenes() {
    this.ordenService.getOrdenes(this.sedeSeleccionada || undefined).subscribe({
      next: (data: any[]) => {
        this.ordenesRegistradas = data.map((o: any) => {
          // ✅ Lógica de estados ORIGINAL — no modificar
          let estadoNormalizado = 'Proceso';
          const raw = (o.estado || '').toString().toUpperCase().trim();

          if (raw === 'FINALIZADA_ENTREGADA') {
            estadoNormalizado = 'Orden finalizada';
          } else if (raw.includes('LISTA') || raw.includes('TERMINADO')) {
            estadoNormalizado = 'Lista';
          } else if (raw.includes('CANCEL')) {
            estadoNormalizado = 'Cancelada';
          } else {
            estadoNormalizado = 'Proceso';
          }

          return {
            id_orden_db: o.id_orden,
            numero: `#${o.id_orden}`,
            fecha: this.formatearFecha(o.fecha),
            hora: o.hora ? o.hora.substring(0, 5) : '00:00',
            estado: estadoNormalizado,
            cliente: o.nombre_cliente,
            cedula: o.cedula_cliente,
            celular: o.telefono_cliente,
            email: o.correo_cliente,
            direccion: o.direccion_cliente,
            vehiculoMarca: o.marca_vehiculo,
            vehiculoModelo: o.modelo_vehiculo,
            vehiculoPlaca: o.placa_vehiculo,
            vehiculoTipo: o.tipo_vehiculo,
            serviciosDetallados: (o.lista_servicios || []).map((s: any) => ({
              ...s,
              precio: s.precio !== undefined ? s.precio
                : (s.valor !== undefined ? s.valor
                : (s.precio_unitario !== undefined ? s.precio_unitario : 0)),
              cantidad: s.cantidad || 1,
              nombre: s.nombre || s.servicio || s.descripcion || 'Servicio'
            })),
            servicioPrincipal: (o.lista_servicios && o.lista_servicios.length > 0 && (o.lista_servicios[0].servicio || o.lista_servicios[0].nombre))
              ? (o.lista_servicios[0].servicio || o.lista_servicios[0].nombre)
              : 'Sin servicios',
            operario: o.nombre_operario ? o.nombre_operario : 'Sin asignar',
            id_operario: o.id_user_encargado ? Number(o.id_user_encargado) : null,
            metodoPago: o.metodo_pago,
            caja: o.caja,
            valorTotal: parseFloat(o.total_orden) || 0,
            notas: o.notas || '',
            // ✅ Campos de casco
            dejoCasco: o.deja_casco ?? false,
            cantidadCascos: o.cantidad_cascos ?? 0,
          };
        });

        this.aplicarFiltros();
      },
      error: (err: any) => {
        console.error(err);
        Swal.fire('Error', 'No se pudieron cargar las órdenes', 'error');
      }
    });
  }

  aplicarFiltros() {
    const tieneFiltroOp = (this.filtroOperario || '').trim() !== '';
    const tieneFiltroFecha = (this.filtroFecha || '').trim() !== '';

    this.mostrarTotal = tieneFiltroOp || tieneFiltroFecha;

    this.ordenesFiltradas = this.ordenesRegistradas.filter(orden => {
      const coincideOperario = tieneFiltroOp
        ? (orden.operario || '').toLowerCase().includes(this.filtroOperario.toLowerCase())
        : true;
      const coincideFecha = tieneFiltroFecha ? orden.fecha === this.filtroFecha : true;
      return coincideOperario && coincideFecha;
    });

    this.totalItems = this.ordenesFiltradas.length;
    this.paginaActual = 1;

    if (this.mostrarTotal) {
      this.totalFiltrado = this.ordenesFiltradas.reduce((acc, orden) => acc + (orden.valorTotal || 0), 0);
      this.pagoOperarioFiltrado = this.ordenesFiltradas.reduce((acc, orden) => acc + ((orden.valorTotal || 0) * 0.40), 0);
      this.totalEfectivoFiltrado = this.ordenesFiltradas
        .filter(orden => (orden.metodoPago || '').toLowerCase() === 'efectivo')
        .reduce((acc, orden) => acc + (orden.valorTotal || 0), 0);
      this.totalTransferenciaFiltrado = this.ordenesFiltradas
        .filter(orden => (orden.metodoPago || '').toLowerCase().includes('transfer'))
        .reduce((acc, orden) => acc + (orden.valorTotal || 0), 0);
    } else {
      this.totalFiltrado = 0;
      this.pagoOperarioFiltrado = 0;
      this.totalEfectivoFiltrado = 0;
      this.totalTransferenciaFiltrado = 0;
    }
  }

  get ordenesPaginadas(): Orden[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.ordenesFiltradas.slice(inicio, fin);
  }

  cambiarPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) this.paginaActual = pagina;
  }

  get totalPaginas(): number {
    return Math.ceil(this.totalItems / this.itemsPorPagina);
  }

  get paginasArray(): number[] {
    return Array(this.totalPaginas).fill(0).map((x, i) => i + 1);
  }

  limpiarFiltros() {
    this.filtroOperario = '';
    this.filtroFecha = '';
    this.mostrarTotal = false;
    this.totalFiltrado = 0;
    this.pagoOperarioFiltrado = 0;
    this.totalEfectivoFiltrado = 0;
    this.totalTransferenciaFiltrado = 0;
    this.aplicarFiltros();
  }

  verificarCambioEstado(orden: Orden) {
    if (orden.estado === 'Lista') {
      this.abrirFactura(orden);
    } else {
      this.ejecutarUpdateEstado(orden);
    }
  }

  private ejecutarUpdateEstado(orden: any) {
    const serviciosMapeados = (orden.serviciosDetallados || []).map((s: any) => ({
      id_servicio: s.id_servicio || s.id,
      cantidad: s.cantidad || 1,
      precio: s.precio || s.precio_unitario || s.valor || 0
    }));

    // ✅ Mapear estado visual → valor de backend ORIGINAL
    let estadoBackend = orden.estado;
    if (orden.estado === 'Orden finalizada') {
      estadoBackend = 'FINALIZADA_ENTREGADA';
    }

    const payload = {
      cedula_cliente: orden.cedula,
      nombre_cliente: orden.cliente,
      correo_cliente: orden.email,
      telefono_cliente: orden.celular,
      direccion_cliente: orden.direccion,
      placa_vehiculo: orden.vehiculoPlaca,
      marca_vehiculo: orden.vehiculoMarca,
      modelo_vehiculo: orden.vehiculoModelo,
      tipo_vehiculo: orden.vehiculoTipo,
      metodo_pago: orden.metodoPago,
      caja: orden.caja,
      id_user_encargado: orden.id_operario,
      estado: estadoBackend,
      fecha: orden.fecha,
      hora: orden.hora,
      notas: orden.notas,
      servicios: serviciosMapeados
    };

    this.ordenService.updateOrden(orden.id_orden_db, payload).subscribe({
      next: () => {
        Swal.fire({
          title: 'Orden Actualizada',
          text: `La orden ${orden.numero} fue guardada correctamente`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        this.cargarOrdenes();
      },
      error: () => {
        Swal.fire('Error', 'No se pudo actualizar la orden', 'error');
        this.cargarOrdenes();
      }
    });
  }

  abrirModalVer(orden: Orden) {
    this.ordenSeleccionada = { ...orden };
    this.modoEdicion = false;
    this.mostrarModal = true;
  }

  abrirModalEditar(orden: Orden) {
    this.ordenSeleccionada = { ...orden };
    this.ordenSeleccionada.serviciosDetallados = orden.serviciosDetallados
      ? JSON.parse(JSON.stringify(orden.serviciosDetallados))
      : [];
    this.modoEdicion = true;
    this.mostrarModal = true;
  }

  guardarCambios() {
    const notifData = {
      nombre: this.ordenSeleccionada.cliente,
      telefono: this.ordenSeleccionada.celular,
      placa: this.ordenSeleccionada.vehiculoPlaca,
      total: this.ordenSeleccionada.valorTotal
    };

    this.ordenService.notificarModificacion(notifData).subscribe({
      next: () => console.log('Notificación de modificación enviada'),
      error: (err) => console.error('Error enviando notificación de modificación:', err)
    });

    this.ejecutarUpdateEstado(this.ordenSeleccionada);
    this.cerrarModal();
  }

  eliminarOrden(orden: Orden) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: `Se eliminará la orden ${orden.numero}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.ordenService.deleteOrden(orden.id_orden_db).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Orden eliminada correctamente', 'success');
            this.cargarOrdenes();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar la orden', 'error')
        });
      }
    });
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  abrirFactura(orden: Orden) {
    this.ordenSeleccionada = { ...orden };
    this.montoRecibido = null;
    this.mostrarFactura = true;
    this.mostrarModal = false;
    this.mostrarRifa = false;
    this.metodoImpresionFacturaOrden = 'WINDOWS';
    this.numeroBoletaRifa = '';
    this.cargarRifaActiva();
  }

  cerrarFactura() {
    this.mostrarFactura = false;
    this.mostrarRifa = false;
    this.cargarOrdenes();
  }

  enviarFactura() {
    if (!this.preferenciaRecibo || this.preferenciaRecibo.length === 0) {
      Swal.fire('Atención', 'Debe seleccionar al menos una opción de recibo (Virtual o Físico).', 'warning');
      return;
    }
    if (this.mostrarRifa && (!this.numeroBoletaRifa || this.numeroBoletaRifa.length !== 3 || isNaN(Number(this.numeroBoletaRifa)))) {
      Swal.fire('Atención', 'El número de boleta debe ser de 3 dígitos numéricos', 'warning');
      return;
    }

    const guardarCambioEstadoFinal = (mensajeAlerta: string) => {
      this.ordenSeleccionada.estado = 'Lista';
      this.ejecutarUpdateEstado(this.ordenSeleccionada);
      this.mostrarFactura = false;
      this.mostrarRifa = false;
      Swal.fire('Completado', mensajeAlerta, 'success');
    };

    const procesarImpresionOWhatsapp = () => {
      if (this.preferenciaRecibo.includes('FISICO')) {
        const datosTicket = {
          numero: this.ordenSeleccionada.numero,
          cliente: this.ordenSeleccionada.cliente,
          placa: this.ordenSeleccionada.vehiculoPlaca,
          total: this.ordenSeleccionada.valorTotal,
          metodoPago: this.ordenSeleccionada.metodoPago,
          recibido: this.ordenSeleccionada.metodoPago === 'Efectivo' ? this.montoRecibido : null,
          cambio: this.ordenSeleccionada.metodoPago === 'Efectivo' ? this.cambioDevolver : null,
          numeroRifa: this.mostrarRifa ? this.numeroBoletaRifa : null,
          servicios: this.ordenSeleccionada.serviciosDetallados && this.ordenSeleccionada.serviciosDetallados.length > 0 ? this.ordenSeleccionada.serviciosDetallados : [],
          serviciosDetallados: this.ordenSeleccionada.serviciosDetallados && this.ordenSeleccionada.serviciosDetallados.length > 0 ? this.ordenSeleccionada.serviciosDetallados : [],
          servicioPrincipal: this.ordenSeleccionada.servicioPrincipal || (this.ordenSeleccionada.serviciosDetallados && this.ordenSeleccionada.serviciosDetallados.length > 0 ? this.ordenSeleccionada.serviciosDetallados[0].nombre : undefined)
        };
        this.impresoraService.imprimirTicket(datosTicket, 'ORDEN', 'RAWBT');
      }
      if (this.preferenciaRecibo.includes('VIRTUAL') && !this.mostrarRifa) {
        if (!this.ordenSeleccionada.celular) {
          Swal.fire('Atención', 'El cliente no tiene número de celular para enviar el WhatsApp.', 'warning');
          return;
        }
        const notifData = {
          nombre: this.ordenSeleccionada.cliente,
          telefono: this.ordenSeleccionada.celular,
          placa: this.ordenSeleccionada.vehiculoPlaca,
          total: this.ordenSeleccionada.valorTotal
        };
        this.ordenService.notificarOrdenLista(notifData).subscribe();
      }
    };

    if (this.mostrarRifa) {
      const boletaData = {
        numero_boleta: this.numeroBoletaRifa,
        nombre: this.ordenSeleccionada.cliente,
        telefono: this.ordenSeleccionada.celular,
        placa_vehiculo: this.ordenSeleccionada.vehiculoPlaca,
        total_pagar: this.ordenSeleccionada.valorTotal,
        preferencia_recibo: this.preferenciaRecibo
      };

      this.rifaService.registrarBoleta(boletaData).subscribe({
        next: () => {
          procesarImpresionOWhatsapp();
          guardarCambioEstadoFinal(`Orden completada y Boleta #${this.numeroBoletaRifa} registrada.`);
        },
        error: (err) => {
          Swal.fire('Error en Rifa', err.error?.error || 'Error al registrar la boleta', 'error');
        }
      });
    } else {
      procesarImpresionOWhatsapp();
      guardarCambioEstadoFinal('Orden completada exitosamente.');
    }
  }

  numerosRifa: any[] = [];
  numerosRifaFiltrados: any[] = [];
  filtroRifa: string = '';

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
            baseGrid[idx].nombre = b.nombre || '';
            baseGrid[idx].telefono = b.telefono || '';
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
}