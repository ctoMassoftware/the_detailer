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
  
  // Variable para el input de fecha
  fechaSeleccionada: string = ''; 
  dashboardData: any = null;

  ngOnInit(): void {
    this.role = this.authService.getRole();
    this.sede = this.authService.getSede();
    
    // Establecemos la fecha de hoy por defecto al entrar
    const hoy = new Date();
    // Ajuste de zona horaria para Colombia (evita que marque un día antes por la noche)
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    this.fechaSeleccionada = hoy.toISOString().split('T')[0]; 
    
    this.cargarResumenDia();
  }

  cargarResumenDia(): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    // Enviamos la fecha seleccionada en la URL
    const url = `http://localhost:3000/api/estadisticas/dashboard?fecha=${this.fechaSeleccionada}`;

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