import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Nav } from '../../shared/nav/nav';
import {
  EstadisticasService,
  DashboardStats,
  VentaDiariaMes,
  ReporteOperativo,
  TipoExporte,
  FormatoExporte
} from '../../services/estadisticas.service';

@Component({
  selector: 'app-graficas',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './visualizar-graficas.html',
  styleUrl: './visualizar-graficas.css',
})
export class Graficas implements OnInit {
  @ViewChild('dashboardPdfTarget') dashboardPdfTarget?: ElementRef<HTMLElement>;
  @ViewChild('comisionesPdfTarget') comisionesPdfTarget?: ElementRef<HTMLElement>;
  descargandoPdfComisiones = false;

  private estadisticasService = inject(EstadisticasService);

  stats: DashboardStats = {
    ventas: { dia: 0, semana: 0, mes: 0 },
    top_servicios: []
  };

  ventasDiariasMes: VentaDiariaMes[] = [];
  reporteOperativo: ReporteOperativo = {
    ventas: { total_ordenes: '0', total_ventas: '0' },
    inventario: { total_insumos: '0', stock_total: '0', alertas_stock: '0' },
    pagos: { total_pagos: '0', total_pagado: '0' }
  };

  formatoExporte: FormatoExporte = 'csv';
  exportandoClave: string | null = null;
  descargandoPdfGraficas = false;
  errorCarga = '';

  loading = true;

  sedeUsuario: string | null = null;
  rolUsuario: string | null = null;
  sedeSeleccionada: string | null = null;
  sedesDisponibles: string[] = ['CENTENARIO', 'GALAN'];

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    // Obtener sede y rol del usuario logueado
    const userStr = localStorage.getItem('user') || localStorage.getItem('usuario');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.sedeUsuario = user.sede || user.sede_actual || null;
        this.rolUsuario = user.rol || null;
      } catch (e) {
        this.sedeUsuario = null;
        this.rolUsuario = null;
      }
    }

    // Leer sede desde queryParams si viene de home
    this.route.queryParams.subscribe(params => {
      const sedeParam = params['sede'];
      if (sedeParam && this.sedesDisponibles.includes(sedeParam)) {
        this.sedeSeleccionada = sedeParam;
      } else if (this.rolUsuario === 'SUPER_ADMIN') {
        this.sedeSeleccionada = this.sedesDisponibles[0];
      } else {
        this.sedeSeleccionada = this.sedeUsuario;
      }
      this.cargarDatos();
    });
  }

  cargarDatos() {
    this.loading = true;
    this.errorCarga = '';

    // Si es SUPER_ADMIN, usar la sede seleccionada
    let sedeParam: string | undefined = undefined;
    if (this.rolUsuario === 'SUPER_ADMIN') {
      sedeParam = this.sedeSeleccionada || undefined;
    } else if (this.rolUsuario === 'ADMIN') {
      sedeParam = undefined; // Puede ver todas
    } else {
      sedeParam = this.sedeUsuario || undefined;
    }

    this.estadisticasService.getResumenDashboard(sedeParam).subscribe({
      next: (data) => {
        this.stats = data;
      },
      error: (err) => {
        console.error('Error cargando estadísticas', err);
        this.errorCarga = 'No se pudo cargar el dashboard de ventas.';
      }
    });

    this.estadisticasService.getVentasDiariasMes(sedeParam).subscribe({
      next: (data: VentaDiariaMes[]) => {
        this.ventasDiariasMes = data || [];
      },
      error: (err: any) => {
        console.error('Error cargando ventas diarias del mes', err);
      }
    });

    this.estadisticasService.getReporteOperativo(sedeParam).subscribe({
      next: (data: ReporteOperativo) => {
        this.reporteOperativo = data;
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error cargando reporte operativo', err);
        if (!this.errorCarga) {
          this.errorCarga = 'No se pudieron cargar los reportes operativos.';
        }
        this.loading = false;
      }
    });
  }

  async descargarPdfComisiones() {
    if (!this.comisionesPdfTarget?.nativeElement || this.descargandoPdfComisiones) {
      return;
    }
    this.descargandoPdfComisiones = true;
    try {
      const comisionesElement = this.comisionesPdfTarget.nativeElement;
      // Ajustar el tamaño del canvas para capturar todo el contenido
      const originalWidth = comisionesElement.scrollWidth;
      const originalHeight = comisionesElement.scrollHeight;
      const canvas = await html2canvas(comisionesElement, {
        width: originalWidth,
        height: originalHeight,
        scale: 2,
        useCORS: true,
        backgroundColor: '#1A1A1A'
      });
      const imageData = canvas.toDataURL('image/png');
      // Siempre usar orientación horizontal (landscape)
      const pdf = new jsPDF({
        orientation: 'landscape', // NO CAMBIAR A portrait
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      let yOffset = 0;
      let pageCanvas = document.createElement('canvas');
      let pageCtx = pageCanvas.getContext('2d');
      const pagePxHeight = Math.floor((pageHeight - margin * 2) * (canvas.width / contentWidth));
      let renderedHeight = 0;
      while (renderedHeight < canvas.height) {
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(pagePxHeight, canvas.height - renderedHeight);
        if (pageCtx) {
          pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(
            canvas,
            0,
            renderedHeight,
            canvas.width,
            pageCanvas.height,
            0,
            0,
            canvas.width,
            pageCanvas.height
          );
        }
        const pageImageData = pageCanvas.toDataURL('image/png');
        const pageDrawHeight = (pageCanvas.height * contentWidth) / canvas.width;
        pdf.addImage(pageImageData, 'PNG', margin, margin, contentWidth, pageDrawHeight);
        renderedHeight += pagePxHeight;
        if (renderedHeight < canvas.height) {
          pdf.addPage();
        }
      }
      const datePart = new Date().toISOString().slice(0, 10);
      pdf.save(`reporte-comisiones-${datePart}.pdf`);
    } catch (error) {
      console.error('Error generando PDF de comisiones', error);
    } finally {
      this.descargandoPdfComisiones = false;
    }
  }

  exportar(tipo: TipoExporte) {
    const formato = this.formatoExporte;
    const clave = `${tipo}-${formato}`;
    this.exportandoClave = clave;

      this.estadisticasService.exportarReporte(tipo, formato).subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          const extension = formato === 'excel' ? 'xlsx' : formato;
          anchor.download = `reporte-${tipo}.${extension}`;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.URL.revokeObjectURL(url);
          this.exportandoClave = null;
        },
        error: (err: any) => {
          console.error(`Error exportando reporte ${tipo} en formato ${formato}`, err);
          this.exportandoClave = null;
        }
      });
  }

  async descargarPdfGraficas() {
    if (!this.dashboardPdfTarget?.nativeElement || this.descargandoPdfGraficas) {
      return;
    }

    this.descargandoPdfGraficas = true;
    try {
      const dashboardElement = this.dashboardPdfTarget.nativeElement;
      // Ajustar el tamaño del canvas para capturar todo el contenido
      const originalWidth = dashboardElement.scrollWidth;
      const originalHeight = dashboardElement.scrollHeight;
      const canvas = await html2canvas(dashboardElement, {
        width: originalWidth,
        height: originalHeight,
        scale: 2,
        useCORS: true,
        backgroundColor: '#1A1A1A'
      });

      const imageData = canvas.toDataURL('image/png');
      // Siempre usar orientación horizontal (landscape)
      const pdf = new jsPDF({
        orientation: 'landscape', // NO CAMBIAR A portrait
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      let pageCanvas = document.createElement('canvas');
      let pageCtx = pageCanvas.getContext('2d');
      const pagePxHeight = Math.floor((pageHeight - margin * 2) * (canvas.width / contentWidth));
      let renderedHeight = 0;
      while (renderedHeight < canvas.height) {
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(pagePxHeight, canvas.height - renderedHeight);
        if (pageCtx) {
          pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(
            canvas,
            0,
            renderedHeight,
            canvas.width,
            pageCanvas.height,
            0,
            0,
            canvas.width,
            pageCanvas.height
          );
        }
        const pageImageData = pageCanvas.toDataURL('image/png');
        const pageDrawHeight = (pageCanvas.height * contentWidth) / canvas.width;
        pdf.addImage(pageImageData, 'PNG', margin, margin, contentWidth, pageDrawHeight);
        renderedHeight += pagePxHeight;
        if (renderedHeight < canvas.height) {
          pdf.addPage();
        }
      }

      const datePart = new Date().toISOString().slice(0, 10);
      pdf.save(`graficas-dashboard-${datePart}.pdf`);
    } catch (error) {
      console.error('Error generando PDF de gráficas', error);
    } finally {
      this.descargandoPdfGraficas = false;
    }
  }

  parseAmount(value?: string | number): number {
    return Number(value || 0);
  }

  maxVentaDiaria(): number {
    if (!this.ventasDiariasMes.length) return 1;
    return Math.max(...this.ventasDiariasMes.map((v) => this.parseAmount(v.total)), 1);
  }

  getPorcentajeVentaDia(total: number | string): string {
    const max = this.maxVentaDiaria();
    const actual = this.parseAmount(total);
    return `${Math.max(8, Math.round((actual / max) * 100))}%`;
  }


  getPorcentajeBarra(valorActual: string): string {
    if (!this.stats.top_servicios.length) return '0%';
    
    const maxVenta = Math.max(...this.stats.top_servicios.map(item => Number(item.total_vendido)));
    
    const actual = Number(valorActual);
    const porcentaje = (actual / maxVenta) * 100;
    
    return `${porcentaje}%`;
  }
}