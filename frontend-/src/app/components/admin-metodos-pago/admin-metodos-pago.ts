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
  template: `
    <app-nav></app-nav>

    <main class="main-content">
      <div class="content-wrapper">
        <header class="page-header">
          <h1 class="page-title">⚙️ Configurar Métodos de Pago</h1>
        </header>

        <div class="info-card">
          <p>Selecciona qué métodos de pago deseas aceptar en tu negocio.</p>
        </div>

        <div class="methods-container" *ngIf="metodos.length > 0; else cargando">
          <div class="method-item" *ngFor="let metodo of metodos">
            <div class="method-info">
              <h3>{{ metodo.nombre }}</h3>
              <p *ngIf="metodo.descripcion">{{ metodo.descripcion }}</p>
            </div>

            <div class="method-toggle">
              <label class="switch">
                <input
                  type="checkbox"
                  [checked]="metodo.activo"
                  (change)="toggleMetodo(metodo)"
                  [disabled]="cargando"
                >
                <span class="slider" [ngClass]="{'active': metodo.activo}"></span>
              </label>
              <span class="status" [ngClass]="{'active': metodo.activo}">
                {{ metodo.activo ? '✅ Activo' : '❌ Inactivo' }}
              </span>
            </div>
          </div>
        </div>

        <ng-template #cargando>
          <div class="loading">
            <p>Cargando métodos de pago...</p>
          </div>
        </ng-template>
      </div>
    </main>
  `,
  styles: [`
    .main-content {
      padding: 2rem;
    }

    .content-wrapper {
      max-width: 900px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-title {
      font-size: 2rem;
      color: #2c3e50;
      margin: 0;
    }

    .info-card {
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 2rem;
    }

    .methods-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .method-item {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: box-shadow 0.3s;
    }

    .method-item:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .method-info h3 {
      margin: 0 0 0.5rem 0;
      color: #2c3e50;
      font-size: 1.2rem;
    }

    .method-info p {
      margin: 0;
      color: #7f8c8d;
      font-size: 0.9rem;
    }

    .method-toggle {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 24px;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: 0.4s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.4s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: #27ae60;
    }

    input:checked + .slider:before {
      transform: translateX(26px);
    }

    .slider.active {
      background-color: #27ae60;
    }

    .status {
      font-weight: 600;
      min-width: 120px;
      text-align: right;
    }

    .status.active {
      color: #27ae60;
    }

    .status:not(.active) {
      color: #e74c3c;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: #7f8c8d;
    }

    @media (max-width: 600px) {
      .method-item {
        flex-direction: column;
        gap: 1rem;
      }

      .method-toggle {
        width: 100%;
        justify-content: space-between;
      }
    }
  `]
})
export class AdminMetodosPagoComponent implements OnInit {
  private metodosPagoService = inject(MetodosPagoService);

  metodos: any[] = [];
  cargando = false;

  ngOnInit(): void {
    this.cargarMetodos();
  }

  cargarMetodos(): void {
    this.cargando = true;
    this.metodosPagoService.getMetodos().subscribe({
      next: (response: any) => {
        this.metodos = response.metodos || [];
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando métodos:', err);
        Swal.fire('Error', 'No se pudieron cargar los métodos de pago', 'error');
        this.cargando = false;
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
        console.log(`📍 Toggle solicitado para: ${metodo.nombre} (ID: ${metodo.id_metodo})`);
        if (!metodo.activo) {
          this.metodosPagoService.activarMetodo(metodo.id_metodo).subscribe({
            next: () => {
              console.log(`✅ Activación exitosa`);
              metodo.activo = true;
              Swal.fire('Éxito', `${metodo.nombre} ha sido activado`, 'success');
            },
            error: (err: any) => {
              console.error('❌ Error activando:', err);
              Swal.fire('Error', `No se pudo activar el método de pago: ${err.message}`, 'error');
            }
          });
        } else {
          this.metodosPagoService.desactivarMetodo(metodo.id_metodo).subscribe({
            next: () => {
              console.log(`✅ Desactivación exitosa`);
              metodo.activo = false;
              Swal.fire('Éxito', `${metodo.nombre} ha sido desactivado`, 'success');
            },
            error: (err: any) => {
              console.error('❌ Error desactivando:', err);
              Swal.fire('Error', `No se pudo desactivar el método de pago: ${err.message}`, 'error');
            }
          });
        }
      }
    });
  }
}
