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
          <h1 class="page-title">Configurar Métodos de Pago</h1>
        </header>

        <div class="info-card">
          <p>Selecciona qué métodos de pago deseas aceptar en tu negocio.</p>
        </div>

        <div class="methods-container" *ngIf="metodos.length > 0; else estado">
          <div class="method-item" *ngFor="let metodo of metodos" [class.loading]="metodosCargando[metodo.id_metodo]">
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
                  [disabled]="metodosCargando[metodo.id_metodo] || cargando"
                >
                <span class="slider" [ngClass]="{'active': metodo.activo}"></span>
              </label>
              <span class="status" [ngClass]="{'active': metodo.activo}">
                {{ metodo.activo ? 'Activo' : 'Inactivo' }}
              </span>
              <span *ngIf="metodosCargando[metodo.id_metodo]" class="loading-spinner">
                Actualizando...
              </span>
            </div>
          </div>
        </div>

        <ng-template #estado>
          <div class="loading" *ngIf="cargando; else sinDatos">
            <p>Cargando métodos de pago...</p>
          </div>
          <div class="error" *ngIf="!cargando && error">
            <p>{{ error }}</p>
            <button (click)="cargarMetodos()" class="retry-btn">Intentar nuevamente</button>
          </div>
          <ng-template #sinDatos>
            <div class="empty" *ngIf="!cargando">
              <p>No hay métodos de pago disponibles</p>
            </div>
          </ng-template>
        </ng-template>
      </div>
    </main>
  `,
  styles: [`
    .main-content {
      padding: 2rem 1rem;
      background: #f5f7fa;
      min-height: 100vh;
    }

    .content-wrapper {
      max-width: 900px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-title {
      font-size: 1.8rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
      padding-bottom: 1rem;
      border-bottom: 2px solid #007bff;
    }

    .info-card {
      background: #e7f3ff;
      border-left: 4px solid #007bff;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 2rem;
      color: #0052cc;
      font-size: 0.95rem;
    }

    .methods-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .method-item {
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
    }

    .method-item:hover:not(.loading) {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: #007bff;
    }

    .method-item.loading {
      opacity: 0.6;
      pointer-events: none;
    }

    .method-info h3 {
      margin: 0 0 0.5rem 0;
      color: #1a1a1a;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .method-info p {
      margin: 0;
      color: #666;
      font-size: 0.85rem;
    }

    .method-toggle {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 48px;
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
      transition: 0.3s;
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
      transition: 0.3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: #28a745;
    }

    input:checked + .slider:before {
      transform: translateX(24px);
    }

    input:disabled + .slider {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .slider.active {
      background-color: #28a745;
    }

    .status {
      font-weight: 600;
      min-width: 80px;
      text-align: right;
      font-size: 0.9rem;
    }

    .status.active {
      color: #28a745;
    }

    .status:not(.active) {
      color: #dc3545;
    }

    .loading-spinner {
      font-size: 0.8rem;
      color: #007bff;
      min-width: 120px;
      text-align: right;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .loading, .error, .empty {
      text-align: center;
      padding: 3rem 1rem;
      background: white;
      border-radius: 6px;
      color: #666;
    }

    .loading p, .error p, .empty p {
      margin: 0;
      font-size: 1rem;
    }

    .error {
      border: 1px solid #dc3545;
      background: #fff5f7;
      color: #721c24;
    }

    .retry-btn {
      margin-top: 1rem;
      padding: 0.5rem 1.5rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.3s;
    }

    .retry-btn:hover {
      background: #0056b3;
    }

    @media (max-width: 600px) {
      .method-item {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .method-toggle {
        width: 100%;
        justify-content: space-between;
      }

      .page-title {
        font-size: 1.5rem;
      }

      .status {
        text-align: left;
      }
    }
  `]
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
