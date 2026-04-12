import { Component, OnInit, inject } from '@angular/core';
import { Nav } from '../../shared/nav/nav';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router'; // 1. Agregamos Router aquí
import { OperarioService } from '../../services/operario.service';

@Component({
  selector: 'app-gestion-operarios',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './gestion-operarios.html',
  styleUrls: ['./gestion-operarios.css'],
})
export class GestionOperarios implements OnInit {
  private operarioService = inject(OperarioService);
  private route = inject(ActivatedRoute);
  private router = inject(Router); // 2. Inyectamos el servicio Router

  operarios: any[] = [];
  operariosFiltrados: any[] = [];
  filtroBusqueda: string = '';

  // 3. Declaramos las variables que el HTML está reclamando
  roleUsuario: string = ''; 
  sedes: string[] = ['Principal', 'Norte', 'Sur']; // Ajusta estos nombres a tus sedes reales

  mostrarModal: boolean = false;
  esEdicion: boolean = false;
  tituloModal: string = 'Nuevo Operario';

  mostrarConfirmacion: boolean = false;
  operarioAEliminar: any = null;

  mostrarAlerta: boolean = false;
  mensajeAlerta: string = '';
  tipoAlerta: 'success' | 'error' = 'success';

  sedeSeleccionada: string | null = null;

  nuevoOperario: any = {
    id_user: null,
    nombre: '',
    telefono: '',
    domicilio: '',
    sede: '',
  };

  ngOnInit() {
    // 4. Obtenemos el rol del usuario (esto suele venir de un AuthService o localStorage)
    // Por ahora lo inicializamos para que el HTML no falle
    const userJson = localStorage.getItem('user'); // O como guardes tu sesión
    if (userJson) {
      const user = JSON.parse(userJson);
      this.roleUsuario = user.rol || '';
    }

    this.route.queryParams.subscribe((params) => {
      this.sedeSeleccionada = params['sede'] || null;
      this.cargarOperarios();
    });
  }

  capitalizarPalabras(texto: string): string {
    if (!texto) return '';
    return texto
      .split(' ')
      .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
      .join(' ');
  }

  cargarOperarios() {
    this.operarioService.getOperarios(this.sedeSeleccionada || undefined).subscribe({
      next: (data) => {
        this.operarios = data;
        this.aplicarFiltro();
      },
      error: (err) => console.error('Error al cargar operarios', err),
    });
  }

  aplicarFiltro() {
    if (!this.filtroBusqueda) {
      this.operariosFiltrados = this.operarios;
      return;
    }
    const texto = this.filtroBusqueda.toLowerCase();
    this.operariosFiltrados = this.operarios.filter(
      (op) =>
        (op.nombre || '').toLowerCase().includes(texto) ||
        (op.domicilio || '').toLowerCase().includes(texto) ||
        (op.telefono || '').toLowerCase().includes(texto),
    );
  }

  onSedeChange() {
    // 5. Ahora this.router ya existe y no dará error
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sede: this.sedeSeleccionada },
      queryParamsHandling: 'merge',
    });
    this.cargarOperarios();
  }

  cambiarEstado(operario: any) {
    const nuevoEstado = !operario.estado_operario;
    operario.estado_operario = nuevoEstado;

    this.operarioService
      .updateOperario(operario.id_user, { estado_operario: nuevoEstado })
      .subscribe({
        next: () => {
          this.mostrarMensaje(
            `Operario marcado como ${nuevoEstado ? 'Activo' : 'Inactivo'}`,
            'success',
          );
        },
        error: () => {
          operario.estado_operario = !nuevoEstado;
          this.mostrarMensaje('Error al cambiar el estado', 'error');
        },
      });
  }

  abrirModal() {
    this.esEdicion = false;
    this.tituloModal = 'Nuevo Operario';
    this.limpiarFormulario();
    this.mostrarModal = true;
  }

  editarOperario(operario: any) {
    this.esEdicion = true;
    this.tituloModal = 'Editar Operario';
    this.nuevoOperario = { ...operario };
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.limpiarFormulario();
  }

  guardarOperario() {
    if (
      !this.nuevoOperario.nombre ||
      !this.nuevoOperario.telefono ||
      !this.nuevoOperario.domicilio
    ) {
      this.mostrarMensaje('Por favor, completa todos los campos del operario', 'error');
      return;
    }

    const regexNumeros = /^[0-9]+$/;
    if (!regexNumeros.test(this.nuevoOperario.telefono)) {
      this.mostrarMensaje('El teléfono solo debe contener números', 'error');
      return;
    }

    if (this.esEdicion) {
      this.operarioService
        .updateOperario(this.nuevoOperario.id_user, this.nuevoOperario)
        .subscribe({
          next: () => {
            this.mostrarMensaje('Operario actualizado correctamente', 'success');
            this.cargarOperarios();
            this.cerrarModal();
          },
          error: (err) => {
            console.error(err);
            this.mostrarMensaje('Error al actualizar el operario', 'error');
          },
        });
    } else {
      this.operarioService.createOperario(this.nuevoOperario).subscribe({
        next: () => {
          this.mostrarMensaje('Operario creado correctamente', 'success');
          this.cargarOperarios();
          this.cerrarModal();
        },
        error: (err) => {
          console.error(err);
          this.mostrarMensaje('Error al crear el operario', 'error');
        },
      });
    }
  }

  confirmarEliminacion(operario: any) {
    this.operarioAEliminar = operario;
    this.mostrarConfirmacion = true;
  }

  cancelarEliminacion() {
    this.mostrarConfirmacion = false;
    this.operarioAEliminar = null;
  }

  eliminarOperario() {
    if (!this.operarioAEliminar) return;

    this.operarioService.deleteOperario(this.operarioAEliminar.id_user).subscribe({
      next: () => {
        this.mostrarMensaje('Operario eliminado', 'success');
        this.cargarOperarios();
        this.cancelarEliminacion();
      },
      error: () => {
        this.mostrarMensaje('Error al eliminar operario', 'error');
        this.cancelarEliminacion();
      },
    });
  }

  limpiarFormulario() {
    this.nuevoOperario = {
      id_user: null,
      nombre: '',
      telefono: '',
      domicilio: '',
      sede: this.sedeSeleccionada || '',
    };
  }

  mostrarMensaje(texto: string, tipo: 'success' | 'error') {
    this.mensajeAlerta = texto;
    this.tipoAlerta = tipo;
    this.mostrarAlerta = true;
    setTimeout(() => (this.mostrarAlerta = false), 3000);
  }
}