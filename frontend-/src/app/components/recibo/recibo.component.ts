import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-recibo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recibo.component.html',
  styleUrls: ['./recibo.component.css']
})
export class ReciboComponent implements OnInit {
  // API URL - usando variable de entorno en producción
  private apiUrl = this.getApiUrl();

  private getApiUrl(): string {
    // En producción: https://thedetailer.up.railway.app
    // En desarrollo: http://localhost:3000
    const isDev = !window.location.hostname.includes('the-detailer.co');
    return isDev
      ? 'http://localhost:3000/api/recibos'
      : 'https://thedetailer.up.railway.app/api/recibos';
  }

  token: string = '';
  placa: string = '';
  orden: any = null;
  ordenes: any[] = [];
  ordenSeleccionada: any = null;
  cargando: boolean = true;
  error: string = '';
  modo: 'token' | 'placa' = 'token';

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
          this.modo = 'token';
          this.obtenerRecibo();
        } else if (this.placa) {
          this.modo = 'placa';
          this.obtenerOrdenesPorPlaca();
        } else {
          this.error = 'Datos inválidos. Token o placa requerida.';
          this.cargando = false;
        }
      });
    });
  }

  obtenerRecibo(): void {
    this.cargando = true;
    this.error = '';

    const url = `${this.apiUrl}/datos/${this.token}?placa=${this.placa}`;
    console.log('📥 Obteniendo recibo:', url);

    this.http.get(url)
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
          console.error('Error obteniendo recibo:', error);
          if (error.status === 401) {
            this.error = 'Token inválido, expirado o no descargado.';
          } else if (error.status === 404) {
            this.error = 'Recibo no encontrado.';
          } else {
            this.error = `Error al cargar el recibo: ${error.status || 'desconocido'}. Intenta más tarde.`;
          }
          this.cargando = false;
        }
      );
  }

  obtenerOrdenesPorPlaca(): void {
    this.cargando = true;
    this.error = '';

    const url = `${this.apiUrl}/por-placa/${this.placa}`;
    console.log('📥 Obteniendo órdenes por placa:', url);

    this.http.get(url)
      .subscribe(
        (response: any) => {
          if (response.success && response.ordenes && response.ordenes.length > 0) {
            this.ordenes = response.ordenes;
            // Seleccionar la última orden (más reciente)
            this.ordenSeleccionada = response.ordenes[0];
            this.orden = this.ordenSeleccionada;
            console.log(`✓ ${this.ordenes.length} órdenes cargadas para placa ${this.placa}`);
          } else {
            this.error = `No hay órdenes registradas para la placa ${this.placa}`;
          }
          this.cargando = false;
        },
        (error) => {
          console.error('Error obteniendo órdenes por placa:', error);
          this.error = `Error al cargar las órdenes: ${error.status || 'desconocido'}. Intenta más tarde.`;
          this.cargando = false;
        }
      );
  }

  seleccionarOrden(ordenId: number): void {
    this.ordenSeleccionada = this.ordenes.find(o => o.id_orden === ordenId);
    this.orden = this.ordenSeleccionada;
  }

  descargarPDF(): void {
    try {
      const elemento = document.getElementById('recibo-contenido');
      if (!elemento) {
        alert('Error: Elemento del recibo no encontrado');
        return;
      }

      // Dinamically load html2pdf if not available
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => {
        this.generarPDF(elemento);
      };
      script.onerror = () => {
        alert('Error: No se pudo cargar la librería PDF. Intenta de nuevo.');
      };

      // Solo agregar si no existe
      if (!document.querySelector('script[src*="html2pdf"]')) {
        document.head.appendChild(script);
      } else {
        this.generarPDF(elemento);
      }
    } catch (error) {
      console.error('Error descargando PDF:', error);
      alert('Error al generar PDF. Intenta de nuevo.');
    }
  }

  private generarPDF(elemento: HTMLElement): void {
    try {
      if (typeof (window as any).html2pdf === 'undefined') {
        alert('Error: Librería PDF no disponible. Intenta de nuevo.');
        return;
      }

      const opt = {
        margin: 10,
        filename: `Recibo_${this.orden.placa_vehiculo || this.orden.id_orden}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
      };

      (window as any).html2pdf().set(opt).from(elemento).save();
      console.log('✓ PDF descargado exitosamente');
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar PDF');
    }
  }

  volver(): void {
    this.router.navigate(['/']);
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
