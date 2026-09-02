import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Nav } from '../../shared/nav/nav';
import { MetodosPagoService } from '../../services/metodos-pago.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-metodos-pago',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './admin-metodos-pago.html',
  styleUrls: ['./admin-metodos-pago.css']
})
export class AdminMetodosPagoComponent implements OnInit {
  private metodosPagoService = inject(MetodosPagoService);

  metodos: any[] = [];
  cargando = false;
  error: string | null = null;
  metodosCargando: { [key: number]: boolean } = {};

  ngOnInit(): void {
    this.cargarMetodos();
  }

  cargarMetodos(): void {
    this.cargando = true;
    this.error = null;
    this.metodosPagoService.getMetodos().subscribe({
      next: (response: any) => {
        this.metodos = response.metodos || [];
        this.cargando = false;
        if (this.metodos.length === 0) {
          this.error = 'No hay métodos de pago disponibles';
        }
      },
      error: (err: any) => {
        this.cargando = false;
        this.error = 'No se pudieron cargar los métodos de pago. Por favor, intenta nuevamente.';
        console.error('Error cargando métodos:', err);
      }
    });
  }

  toggleMetodo(metodo: any): void {
    const accion = !metodo.activo ? 'activar' : 'desactivar';

    Swal.fire({
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} ${metodo.nombre}?`,
      text: `¿Estás seguro de que deseas ${accion} "${metodo.nombre}" como método de pago?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.metodosCargando[metodo.id_metodo] = true;

        if (!metodo.activo) {
          this.metodosPagoService.activarMetodo(metodo.id_metodo).subscribe({
            next: () => {
              metodo.activo = true;
              this.metodosCargando[metodo.id_metodo] = false;
              Swal.fire('Éxito', `${metodo.nombre} ha sido activado`, 'success');
            },
            error: (err: any) => {
              this.metodosCargando[metodo.id_metodo] = false;
              const errorMsg = err?.error?.error || 'Error desconocido';
              Swal.fire('Error', `No se pudo activar: ${errorMsg}`, 'error');
            }
          });
        } else {
          this.metodosPagoService.desactivarMetodo(metodo.id_metodo).subscribe({
            next: () => {
              metodo.activo = false;
              this.metodosCargando[metodo.id_metodo] = false;
              Swal.fire('Éxito', `${metodo.nombre} ha sido desactivado`, 'success');
            },
            error: (err: any) => {
              this.metodosCargando[metodo.id_metodo] = false;
              const errorMsg = err?.error?.error || 'Error desconocido';
              Swal.fire('Error', `No se pudo desactivar: ${errorMsg}`, 'error');
            }
          });
        }
      }
    });
  }
}
