import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MetodosPagoService {
  private http = inject(HttpClient);
  private apiUrl = 'https://thedetailer.up.railway.app/api/metodos-pago';

  private metodosActivos$ = new BehaviorSubject<any[]>([]);

  constructor() {
    this.cargarMetodosActivos();
  }

  getMetodosActivos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/activos`).pipe(
      tap((response: any) => {
        this.metodosActivos$.next(response.metodos || []);
      })
    );
  }

  getMetodos(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  activarMetodo(id: number): Observable<any> {
    console.log(`🔄 Activando método ${id}...`);
    return this.http.put(`${this.apiUrl}/${id}`, { activo: true }).pipe(
      tap((response) => {
        console.log(`✅ Método ${id} activado:`, response);
        this.cargarMetodosActivos();
      })
    );
  }

  desactivarMetodo(id: number): Observable<any> {
    console.log(`🔄 Desactivando método ${id}...`);
    return this.http.put(`${this.apiUrl}/${id}`, { activo: false }).pipe(
      tap((response) => {
        console.log(`✅ Método ${id} desactivado:`, response);
        this.cargarMetodosActivos();
      })
    );
  }

  obtenerMetodosLocal(): any[] {
    return this.metodosActivos$.value;
  }

  private cargarMetodosActivos(): void {
    this.getMetodosActivos().subscribe({
      next: (response: any) => {
        this.metodosActivos$.next(response.metodos || []);
      },
      error: (err) => {
        console.error('Error cargando métodos de pago:', err);
      }
    });
  }
}
