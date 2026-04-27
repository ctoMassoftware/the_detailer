import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // 👈 ESTA ES LA SOLUCIÓN AL ERROR
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Footer } from '../../shared/footer/footer';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
  imports: [CommonModule, Footer, RouterLink, FormsModule] // 👈 AÑADIDO CommonModule AQUÍ
})
export class Home implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  isMenuOpen: boolean = false;
  role: string | null = null;
  sede: string | null = null;
  
  // Variables para el rango de fechas
  fechaDesde: string = '';
  fechaHasta: string = '';
  dashboardData: any = null;

  ngOnInit(): void {
    this.role = this.authService.getRole();
    this.sede = this.authService.getSede();
    // Establecemos la fecha de hoy por defecto al entrar
    const hoy = new Date();
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    const hoyStr = hoy.toISOString().split('T')[0];
    this.fechaDesde = hoyStr;
    this.fechaHasta = hoyStr;
    this.cargarResumenDia();
  }

  cargarResumenDia(): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    // Enviamos el rango de fechas en la URL
    let url = `https://thedetailer.up.railway.app/api/estadisticas/dashboard?`;
    if (this.fechaDesde) url += `fecha_desde=${this.fechaDesde}&`;
    if (this.fechaHasta) url += `fecha_hasta=${this.fechaHasta}`;

    this.http.get(url, { headers }).subscribe({
      next: (data) => {
        this.dashboardData = data;
      },
      error: (err) => console.error('Error cargando el dashboard:', err)
    });
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  logout(): void {
    this.authService.logout();
  }
}