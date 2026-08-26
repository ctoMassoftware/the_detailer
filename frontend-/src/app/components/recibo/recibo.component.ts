import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-recibo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recibo.component.html',
  styleUrls: ['./recibo.component.css']
})
export class ReciboComponent implements OnInit {
  token: string = '';
  placa: string = '';
  orden: any = null;
  cargando: boolean = true;
  error: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.placa = params['placa'] || '';
      this.route.params.subscribe(params => {
        this.token = params['token'] || '';
        if (this.token) {
          this.obtenerRecibo();
        } else if (!this.token && !this.placa) {
          this.error = 'Datos inválidos. Token requerido.';
          this.cargando = false;
        }
      });
    });
  }

  obtenerRecibo(): void {
    this.cargando = true;
    this.error = '';

    this.http.get(`/api/recibos/datos/${this.token}?placa=${this.placa}`)
      .subscribe(
        (response: any) => {
          if (response.success && response.orden) {
            this.orden = response.orden;
            console.log('✓ Recibo cargado:', this.orden);
          } else {
            this.error = 'No se pudo cargar el recibo';
          }
          this.cargando = false;
        },
        (error) => {
          console.error('Error:', error);
          if (error.status === 401) {
            this.error = 'Token inválido, expirado o ya descargado.';
          } else if (error.status === 404) {
            this.error = 'Recibo no encontrado.';
          } else {
            this.error = 'Error al cargar el recibo. Intenta más tarde.';
          }
          this.cargando = false;
        }
      );
  }

  descargarPDF(): void {
    if (typeof (window as any).html2pdf === 'undefined') {
      alert('Error: Librería PDF no disponible');
      return;
    }

    const elemento = document.getElementById('recibo-contenido');
    if (!elemento) return;

    const opt = {
      margin: 10,
      filename: `${this.orden.placa_vehiculo || 'recibo'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    (window as any).html2pdf().set(opt).from(elemento).save();
  }

  volver(): void {
    this.router.navigate(['/home']);
  }

  obtenerFecha(fecha: string): string {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  obtenerTotal(servicios: any[]): number {
    return servicios?.reduce((sum, s) => sum + (s.subtotal || 0), 0) || 0;
  }

  formatEstado(estado: string): string {
    return estado.toLowerCase().replace(/ /g, '-');
  }
}
