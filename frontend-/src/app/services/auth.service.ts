import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';
  private http = inject(HttpClient);
  private router = inject(Router);

  login(correo: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { correo, password }).pipe(
      tap(response => {
        if (response.token) {
          localStorage.setItem('token', response.token);
          // Al guardar el user, ahora también se está guardando la sede
          localStorage.setItem('user', JSON.stringify(response.user));
        }
      })
    );
  }

  getRole(): string | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr).rol;
    }
    return null;
  }

  getSede(): string | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr).sede;
    }
    return null;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }
}