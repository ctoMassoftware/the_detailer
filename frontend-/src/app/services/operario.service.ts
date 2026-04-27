import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OperarioService {
  private http = inject(HttpClient);
  private apiUrl = 'thedetailer.up.railway.app/api/operarios';

  // 👈 Modificado para recibir la sede y enviarla como parámetro
  getOperarios(sede?: string): Observable<any[]> {
    let params = new HttpParams();
    
    if (sede) {
      params = params.set('sede', sede);
    }
    
    return this.http.get<any[]>(this.apiUrl, { params });
  }

  createOperario(operario: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, operario);
  }

  updateOperario(id: number, operario: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, operario);
  }

  deleteOperario(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}