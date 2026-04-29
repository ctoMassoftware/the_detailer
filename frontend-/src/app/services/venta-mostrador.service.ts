import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VentaMostradorService {
  
  // URL directa a tu backend local. 
  // (Si en el futuro subes esto a un servidor, solo cambias el localhost por tu dominio)
  private apiUrl = 'https://thedetailer.up.railway.app/api/venta-mostrador';

  constructor(private http: HttpClient) { }

  /**
   * Card 1: Registra una nueva venta de mostrador y descuenta stock
   * @param ventaData Datos del cliente, pago y array de productos
   */
  registrarVenta(ventaData: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, ventaData);
  }

  /**
   * Card 2: Obtiene el historial para el "Cuaderno de Recibos"
   * @param fecha Filtro de fecha (formato YYYY-MM-DD)
   * @param sede Filtro de sede (opcional, útil para el SUPER_ADMIN)
   */
  getHistorial(fecha?: string, sede?: string): Observable<any> {
    let params = new HttpParams();

    if (fecha) {
      params = params.set('fecha', fecha);
    }
    
    if (sede) {
      params = params.set('sede', sede);
    }

    // Retorna la ruta GET: /api/venta-mostrador/historial?fecha=...&sede=...
    return this.http.get<any>(`${this.apiUrl}/historial`, { params });
  }
}