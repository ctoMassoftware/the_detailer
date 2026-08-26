import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Nav } from '../../shared/nav/nav';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';

interface Rifa {
  id_evento: number;
  fecha_sorteo: string;
  descripcion_premios: string;
  encargado: string;
  estado: boolean;
  sede?: string;
}

@Component({
  selector: 'app-gestion-rifas',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './gestion-rifas.html',
  styleUrls: ['./gestion-rifas.css']
})
export class GestionRifasComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private http = inject(HttpClient);
  private router = inject(Router);

  private apiUrl = this.getApiUrl();

  private getApiUrl(): string {
    const isDev = !window.location.hostname.includes('the-detailer.co');
    return isDev
      ? 'http://localhost:3000/api'
      : 'https://thedetailer.up.railway.app/api';
  }

  rifas: Rifa[] = [];
  cargando: boolean = false;
  error: string = '';
  sede: string = '';
  rolUsuario: string = '';

  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  rifaSeleccionada: Rifa | null = null;

  nuevaRifa: Rifa = {
    id_evento: 0,
    fecha_sorteo: '',
    descripcion_premios: '',
    encargado: '',
    estado: true,
    sede: ''
  };

  ngOnInit() {
    this.cargarUsuarioSesion();
    this.cargarRifas();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarUsuarioSesion() {
    const userStr = localStorage.getItem('user') || localStorage.getItem('usuario');
    const sedeStr = localStorage.getItem('sede');

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.rolUsuario = user.rol || user.role || '';
        this.sede = user.sede || sedeStr || '';
      } catch (e) {
        this.rolUsuario = localStorage.getItem('rol') || '';
        this.sede = sedeStr || '';
      }
    } else {
      this.rolUsuario = localStorage.getItem('rol') || '';
      this.sede = sedeStr || '';
    }

    if (!this.sede) {
      this.error = 'No se encontró la sede del usuario';
    }
  }

  cargarRifas() {
    this.cargando = true;
    this.error = '';

    this.http.get<Rifa[]>(`${this.apiUrl}/rifas/historial`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.rifas = data || [];
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando rifas:', err);
        this.error = 'Error al cargar las rifas';
        this.cargando = false;
      }
    });
  }

  abrirFormularioNueva() {
    this.modoEdicion = false;
    this.rifaSeleccionada = null;
    this.nuevaRifa = {
      id_evento: 0,
      fecha_sorteo: '',
      descripcion_premios: '',
      encargado: '',
      estado: true,
      sede: this.sede
    };
    this.mostrarFormulario = true;
  }

  abrirFormularioEditar(rifa: Rifa) {
    this.modoEdicion = true;
    this.rifaSeleccionada = rifa;
    this.nuevaRifa = { ...rifa };
    this.mostrarFormulario = true;
  }

  cerrarFormulario() {
    this.mostrarFormulario = false;
    this.rifaSeleccionada = null;
  }

  guardarRifa() {
    if (!this.nuevaRifa.fecha_sorteo || !this.nuevaRifa.descripcion_premios || !this.nuevaRifa.encargado) {
      Swal.fire('Error', 'Por favor completa todos los campos requeridos', 'error');
      return;
    }

    if (this.modoEdicion && this.rifaSeleccionada) {
      this.actualizarRifa();
    } else {
      this.crearRifa();
    }
  }

  crearRifa() {
    this.http.post(`${this.apiUrl}/rifas/crear`, {
      fecha: this.nuevaRifa.fecha_sorteo,
      descripcion_premios: this.nuevaRifa.descripcion_premios,
      encargado: this.nuevaRifa.encargado
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Rifa creada correctamente', 'success');
        this.cerrarFormulario();
        this.cargarRifas();
      },
      error: (err) => {
        console.error('Error creando rifa:', err);
        Swal.fire('Error', 'No se pudo crear la rifa', 'error');
      }
    });
  }

  actualizarRifa() {
    if (!this.rifaSeleccionada) return;

    this.http.put(`${this.apiUrl}/rifas/${this.rifaSeleccionada.id_evento}`, {
      fecha_sorteo: this.nuevaRifa.fecha_sorteo,
      descripcion_premios: this.nuevaRifa.descripcion_premios,
      encargado: this.nuevaRifa.encargado,
      estado: this.nuevaRifa.estado
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Rifa actualizada correctamente', 'success');
        this.cerrarFormulario();
        this.cargarRifas();
      },
      error: (err) => {
        console.error('Error actualizando rifa:', err);
        Swal.fire('Error', 'No se pudo actualizar la rifa', 'error');
      }
    });
  }

  toggleEstadoRifa(rifa: Rifa) {
    const nuevoEstado = !rifa.estado;
    this.http.put(`${this.apiUrl}/rifas/${rifa.id_evento}`, {
      estado: nuevoEstado
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        rifa.estado = nuevoEstado;
        const mensaje = nuevoEstado ? 'Rifa activada' : 'Rifa desactivada';
        Swal.fire('Éxito', mensaje, 'success');
      },
      error: (err) => {
        console.error('Error actualizando estado:', err);
        Swal.fire('Error', 'No se pudo actualizar el estado de la rifa', 'error');
      }
    });
  }

  eliminarRifa(rifa: Rifa) {
    Swal.fire({
      title: '¿Eliminar rifa?',
      text: `¿Estás seguro de que deseas eliminar la rifa del ${rifa.fecha_sorteo}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${this.apiUrl}/rifas/eliminar/${rifa.id_evento}`).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Rifa eliminada correctamente', 'success');
            this.cargarRifas();
          },
          error: (err) => {
            console.error('Error eliminando rifa:', err);
            Swal.fire('Error', 'No se pudo eliminar la rifa', 'error');
          }
        });
      }
    });
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'N/A';
    const [anio, mes, dia] = fecha.split('-');
    if (!anio || !mes || !dia) return fecha;
    return `${dia}/${mes}/${anio}`;
  }
}
