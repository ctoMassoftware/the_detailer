import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MetodosPagoService {
  private http = inject(HttpClient);
  private apiUrl = this.getApiUrl();

  private getApiUrl(): string {
    const isDev = !window.location.hostname.includes('the-detailer.co');
    return isDev
      ? 'http://localhost:3000/api/metodos-pago'
      : 'https://thedetailer.up.railway.app/api/metodos-pago';
  }

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
    return this.http.put(`${this.apiUrl}/${id}`, { activo: true }).pipe(
      tap((response) => {
        this.cargarMetodosActivos();
      })
    );
  }

  desactivarMetodo(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, { activo: false }).pipe(
      tap((response) => {
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
