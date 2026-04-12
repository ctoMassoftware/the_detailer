import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DashboardStats {
  ventas: {
    dia: number;
    semana: number;
    mes: number;
  };
  top_servicios: {
    nombre_servicio: string;
    tipo: string;
    total_vendido: string;
    total_ingresos: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class EstadisticasService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/estadisticas';

  // 👈 Ahora acepta la sede como parámetro opcional
  getResumenDashboard(sede?: string): Observable<DashboardStats> {
    let params = new HttpParams();
    
    // Si la vista envía una sede (ej: CENTENARIO), la adjuntamos a la petición
    if (sede) {
      params = params.set('sede', sede);
    }

    return this.http.get<DashboardStats>(`${this.apiUrl}/dashboard`, { params });
  }
}