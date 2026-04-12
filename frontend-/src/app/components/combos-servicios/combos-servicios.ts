import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Nav } from "../../shared/nav/nav";
import { ServicioService } from '../../services/servicio.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-combos-servicios',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './combos-servicios.html',
  styleUrls: ['./combos-servicios.css']
})
export class CombosServicios implements OnInit {
  listaCompleta: any[] = [];
  itemsFiltrados: any[] = [];

  mostrarModal: boolean = false;
  esEdicion: boolean = false;
  mostrarAlerta: boolean = false;
  tipoAlerta: 'success' | 'error' = 'success';
  mensajeAlerta: string = '';
  filtroBusqueda: string = '';

  // Variable para manejar la seguridad de la vista
  role: string | null = null;

  nuevoItem: any = {
    id_servicio: null,
    nombre: '',
    tipo: 'Servicio',
    descripcion: '',
    precioAuto: 0,
    precioCampero: 0,
    precioCamioneta: 0,
    precioMoto: 0,
    aplicaAuto: true,
    aplicaCampero: true,
    aplicaCamioneta: true,
    aplicaMoto: true
  };

  private servicioService = inject(ServicioService);
  private authService = inject(AuthService); // Inyectamos el servicio de autenticación

  ngOnInit() {
    this.role = this.authService.getRole(); // Capturamos el rol al iniciar
    this.cargarDatos();
  }

  cargarDatos() {
    this.servicioService.getServicios().subscribe({
      next: (data) => {
        this.listaCompleta = data.map(item => ({
          ...item,
          nombre: item.nombre_servicio,
          tipo: item.tipo,
          precioAuto: item.precio_automovil,
          precioCampero: item.precio_campero,
          precioCamioneta: item.precio_camioneta,
          precioMoto: item.precio_moto,
          aplicaAuto: item.aplica_automovil !== false,
          aplicaCampero: item.aplica_campero !== false,
          aplicaCamioneta: item.aplica_camioneta !== false,
          aplicaMoto: item.aplica_moto !== false
        }));

        this.aplicarFiltro();
      },
      error: (err) => {
        if (err.status === 401) {
          this.mostrarMensaje('Sesión caducada. Reingresa al login.', 'error');
        } else {
          this.mostrarMensaje('Error cargando datos', 'error');
        }
      }
    });
  }

  aplicarFiltro() {
    const texto = this.filtroBusqueda.toLowerCase();
    this.itemsFiltrados = this.listaCompleta.filter(item =>
      (item.nombre && item.nombre.toLowerCase().includes(texto)) ||
      (item.descripcion && item.descripcion.toLowerCase().includes(texto))
    );
  }

  // --- LAS FUNCIONES DE MODALES SE MANTIENEN, EL HTML BLOQUEA EL ACCESO ---
  abrirModal() {
    this.esEdicion = false;
    this.reiniciarFormulario();
    this.mostrarModal = true;
  }

  abrirModalEditar(item: any) {
    this.esEdicion = true;
    this.mostrarModal = true;

    this.nuevoItem = {
      id_servicio: item.id_servicio,
      nombre: item.nombre,
      tipo: item.tipo,
      descripcion: item.descripcion,
      precioAuto: item.precioAuto,
      precioCampero: item.precioCampero,
      precioCamioneta: item.precioCamioneta,
      precioMoto: item.precioMoto,
      aplicaAuto: item.aplicaAuto,
      aplicaCampero: item.aplicaCampero,
      aplicaCamioneta: item.aplicaCamioneta,
      aplicaMoto: item.aplicaMoto
    };
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  reiniciarFormulario() {
    this.nuevoItem = {
      id_servicio: null,
      nombre: '',
      tipo: 'Servicio',
      descripcion: '',
      precioAuto: 0,
      precioCampero: 0,
      precioCamioneta: 0,
      precioMoto: 0,
      aplicaAuto: true,
      aplicaCampero: true,
      aplicaCamioneta: true,
      aplicaMoto: true
    };
  }

  guardarItem() {
    if (!this.nuevoItem.nombre || !this.nuevoItem.tipo || !this.nuevoItem.descripcion) {
      this.mostrarMensaje('Por favor, completa todos los campos (Nombre, Tipo y Descripción)', 'error');
      return;
    }

    if (
      this.nuevoItem.precioAuto < 0 ||
      this.nuevoItem.precioCampero < 0 ||
      this.nuevoItem.precioCamioneta < 0 ||
      this.nuevoItem.precioMoto < 0
    ) {
      this.mostrarMensaje('Los precios deben ser valores válidos desde $0 en adelante', 'error');
      return;
    }

    const datosParaBackend = {
      nombre_servicio: this.nuevoItem.nombre,
      tipo: this.nuevoItem.tipo,
      descripcion: this.nuevoItem.descripcion,
      precio_automovil: this.nuevoItem.precioAuto,
      precio_campero: this.nuevoItem.precioCampero,
      precio_camioneta: this.nuevoItem.precioCamioneta,
      precio_moto: this.nuevoItem.precioMoto,
      aplica_automovil: this.nuevoItem.aplicaAuto,
      aplica_campero: this.nuevoItem.aplicaCampero,
      aplica_camioneta: this.nuevoItem.aplicaCamioneta,
      aplica_moto: this.nuevoItem.aplicaMoto
    };

    if (this.esEdicion) {
      this.servicioService.updateServicio(this.nuevoItem.id_servicio, datosParaBackend).subscribe({
        next: () => {
          this.mostrarMensaje('Actualizado correctamente', 'success');
          this.cargarDatos();
          this.cerrarModal();
        },
        error: () => this.mostrarMensaje('Error al actualizar el servicio', 'error')
      });
    } else {
      this.servicioService.createServicio(datosParaBackend).subscribe({
        next: () => {
          this.mostrarMensaje('Creado correctamente', 'success');
          this.cargarDatos();
          this.cerrarModal();
        },
        error: () => this.mostrarMensaje('Error al crear el servicio', 'error')
      });
    }
  }

  mostrarModalEliminar: boolean = false;
  itemParaEliminar: any = null;

  eliminarItem(item: any) {
    this.itemParaEliminar = item;
    this.mostrarModalEliminar = true;
  }

  confirmarEliminacion() {
    if (this.itemParaEliminar) {
      this.servicioService.deleteServicio(this.itemParaEliminar.id_servicio).subscribe({
        next: () => {
          this.mostrarMensaje('Eliminado correctamente', 'success');
          this.cargarDatos();
          this.cerrarModalEliminar();
        },
        error: () => {
          this.mostrarMensaje('Error al eliminar el servicio', 'error');
          this.cerrarModalEliminar();
        }
      });
    }
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.itemParaEliminar = null;
  }

  mostrarMensaje(msg: string, tipo: 'success' | 'error') {
    this.mensajeAlerta = msg;
    this.tipoAlerta = tipo;
    this.mostrarAlerta = true;
    setTimeout(() => this.mostrarAlerta = false, 3000);
  }
}