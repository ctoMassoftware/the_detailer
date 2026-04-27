import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InventarioVentaService {
  private http = inject(HttpClient);
  private apiUrl = 'https://thedetailer.up.railway.app/api/inventario-venta';

  getProductos(sede?: string): Observable<any[]> {
    let params = new HttpParams();
    
    if (sede) {
      params = params.set('sede', sede);
    }

    return this.http.get<any[]>(this.apiUrl, { params });
  }

  createProducto(producto: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, producto);
  }

  updateProducto(id: number, producto: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, producto);
  }

  deleteProducto(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}