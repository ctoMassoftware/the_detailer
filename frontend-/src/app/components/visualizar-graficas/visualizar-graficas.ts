import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Nav } from '../../shared/nav/nav';
import { EstadisticasService, DashboardStats } from '../../services/estadisticas.service';

@Component({
  selector: 'app-graficas',
  standalone: true,
  imports: [Nav, CommonModule],
  templateUrl: './visualizar-graficas.html',
  styleUrl: './visualizar-graficas.css',
})
export class Graficas implements OnInit {
  
  private estadisticasService = inject(EstadisticasService);
  private route = inject(ActivatedRoute);

  stats: DashboardStats = {
    ventas: { dia: 0, semana: 0, mes: 0 },
    top_servicios: []
  };

  loading = true;
  sedeSeleccionada: string | null = null;

  ngOnInit() {
    // Leemos el parámetro de la URL (ej: ?sede=CENTENARIO)
    this.route.queryParams.subscribe(params => {
      this.sedeSeleccionada = params['sede'] || null;
      this.cargarEstadisticas();
    });
  }

  cargarEstadisticas() {
    this.loading = true;
    // Enviamos la sede seleccionada al servicio
    this.estadisticasService.getResumenDashboard(this.sedeSeleccionada || undefined).subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando estadísticas', err);
        this.loading = false;
      }
    });
  }

  getPorcentajeBarra(valorActual: string): string {
    if (!this.stats.top_servicios || this.stats.top_servicios.length === 0) return '0%';
    
    const maxVenta = Math.max(...this.stats.top_servicios.map(item => Number(item.total_vendido)));
    
    const actual = Number(valorActual);
    
    // Evitamos errores matemáticos si no hay ventas (división por cero)
    if (maxVenta === 0) return '0%';
    
    const porcentaje = (actual / maxVenta) * 100;
    
    return `${porcentaje}%`;
  }
}