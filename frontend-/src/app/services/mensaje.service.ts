import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MensajeService {
  private http = inject(HttpClient);
  private apiUrl = 'thedetailer.up.railway.app/api/mensajes';

  getMensajes(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  updateMensaje(id: number | null, tipo: string, contenido: string): Observable<any> {
    return this.http.put<any>(this.apiUrl, { id_mensaje: id, tipo_mensaje: tipo, contenido });
  }
}