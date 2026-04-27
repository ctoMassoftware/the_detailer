import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http'; // 👈 Añadido HttpParams
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrdenService {
  private apiUrl = 'thedetailer.up.railway.app/api/ordenes';
  private http = inject(HttpClient);

  // 👈 Modificado para atrapar la sede y mandarla en la URL
  getOrdenes(sede?: string): Observable<any[]> {
    let params = new HttpParams();
    if (sede) {
      params = params.set('sede', sede);
    }
    return this.http.get<any[]>(this.apiUrl, { params });
  }

  createOrden(orden: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, orden);
  }

  updateOrden(id: number | string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }

  deleteOrden(id: number | string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  notificarOrdenLista(data: { nombre: string, telefono: string, placa: string, total: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/notificar`, data);
  }

  notificarModificacion(data: { nombre: string, telefono: string, placa: string, total: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/notificar-modificacion`, data);
  }
}