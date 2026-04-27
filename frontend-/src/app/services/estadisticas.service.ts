export type TipoExporte = 'ventas' | 'operativo' | 'inventario' | 'comisiones' | 'pagos';
export type FormatoExporte = 'csv' | 'excel' | 'pdf';

export interface VentaDiariaMes {
  fecha: string;
  total: number;
}

export interface ReporteOperativo {
  ventas: { total_ordenes: string; total_ventas: string };
  inventario: { total_insumos: string; stock_total: string; alertas_stock: string };
  pagos: { total_pagos: string; total_pagado: string };
}

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

    getVentasDiariasMes(sede?: string): Observable<VentaDiariaMes[]> {
      let params = new HttpParams();
      if (sede) {
        params = params.set('sede', sede);
      }
      return this.http.get<VentaDiariaMes[]>(`${this.apiUrl}/ventas-diarias-mes`, { params });
    }

    getReporteOperativo(sede?: string): Observable<ReporteOperativo> {
      let params = new HttpParams();
      if (sede) {
        params = params.set('sede', sede);
      }
      return this.http.get<ReporteOperativo>(`${this.apiUrl}/reporte-operativo`, { params });
    }

    exportarReporte(tipo: TipoExporte, formato: FormatoExporte) {
      const params = new HttpParams().set('tipo', tipo).set('formato', formato);
      return this.http.get(`${this.apiUrl}/exportar`, { params, responseType: 'blob' });
    }
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