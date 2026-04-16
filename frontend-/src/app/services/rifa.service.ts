import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RifaService {
  private http = inject(HttpClient);
  private apiUrl = 'http://192.168.20.11:3000/api/rifas';

  crearRifa(datos: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/crear`, datos);
  }

  getRifaActiva(): Observable<any> {
    return this.http.get(`${this.apiUrl}/activa`);
  }

  getTodasRifas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/historial`);
  }

  registrarBoleta(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/registrar-boleta`, data);
  }

  verificarNumero(numero: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/verificar/${numero}`);
  }

  getBoletasPorEvento(idEvento: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${idEvento}/boletas`);
  }

  eliminarRifa(idEvento: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/eliminar/${idEvento}`);
  }
}