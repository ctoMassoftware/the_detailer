import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
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

type VentasConDetalle = {
  dia: number;
  semana: number;
  mes: number;
  detalle_dia?: any[];
};

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

  stats: Omit<DashboardStats, 'ventas'> & { ventas: VentasConDetalle } = {
    ventas: { dia: 0, semana: 0, mes: 0, detalle_dia: [] },
    top_servicios: []
  };

  totalDiaCompleto: number = 0;
  totalSemanaCompleto: number = 0;
  totalMesCompleto: number = 0;

  // Totales del día desglosados (órdenes + mostrador)
  totalHoy: number = 0;
  totalEfectivo: number = 0;
  totalTransferencia: number = 0;

  ventasDiariasMes: VentaDiariaMes[] = [];
  reporteOperativo: ReporteOperativo = {
    ventas: { total_ordenes: '0', total_ventas: '0' },
    inventario: { total_insumos: '0', stock_total: '0', alertas_stock: '0' },
    pagos: { total_pagos: '0', total_pagado: '0' }
  };

  formatoExporte: FormatoExporte = 'pdf';
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

  private getSedeParam(): string | undefined {
    if (this.rolUsuario === 'SUPER_ADMIN') {
      return this.sedeSeleccionada || undefined;
    } else if (this.rolUsuario === 'ADMIN') {
      return undefined;
    } else {
      return this.sedeUsuario || undefined;
    }
  }

  cargarDatos() {
    this.loading = true;
    this.errorCarga = '';

    const sedeParam = this.getSedeParam();

    // ✅ FIX PRINCIPAL: forkJoin espera que los 3 observables completen
    // antes de calcular cualquier total. Esto elimina el race condition
    // donde getReporteOperativo llegaba antes que getResumenDashboard
    // y calculaba totales con stats.ventas.semana/mes en 0.
    forkJoin({
      resumen: this.estadisticasService.getResumenDashboard(sedeParam),
      ventasDiarias: this.estadisticasService.getVentasDiariasMes(sedeParam),
      operativo: this.estadisticasService.getReporteOperativo(sedeParam)
    }).subscribe({
      next: ({ resumen, ventasDiarias, operativo }) => {

        // --- Asignar datos base ---
        this.stats = {
          ...resumen,
          ventas: {
            ...resumen.ventas,
            detalle_dia: Array.isArray((resumen.ventas as any).detalle_dia)
              ? (resumen.ventas as any).detalle_dia
              : []
          }
        };

        this.ventasDiariasMes = ventasDiarias || [];
        this.reporteOperativo = operativo;

        // ─── CÁLCULO DE TOTALES DEL DÍA ACTUAL ────────────────────────────────
        //
        // El backend ahora devuelve DOS fuentes con desglose por metodo_pago:
        //
        // 1) resumen.ventas.detalle_dia       → VENTA_MOSTRADOR del día por metodo_pago
        //    [{ metodo_pago: 'efectivo', total: 50000 }, ...]
        //
        // 2) resumen.ventas.ordenes_dia_detalle → ÓRDENES del día por metodo_pago
        //    [{ metodo_pago: 'efectivo', total: 120000 }, ...]
        //
        // Total del día = suma de ambas fuentes
        // Efectivo      = efectivo mostrador + efectivo órdenes
        // Transferencia = transferencia mostrador + transferencia órdenes
        // ──────────────────────────────────────────────────────────────────────

        // Helper: suma por método de pago en un array de { metodo_pago, total }
        const sumaPorMetodo = (arr: any[], filtro: (mp: string) => boolean): number =>
          (arr || [])
            .filter((v: any) => filtro((v.metodo_pago || '').toLowerCase()))
            .reduce((sum: number, v: any) => sum + Number(v.total), 0);

        const sumaTodo = (arr: any[]): number =>
          (arr || []).reduce((sum: number, v: any) => sum + Number(v.total), 0);

        // Ventas mostrador del día por metodo_pago
        const detalleDia: any[]        = this.stats.ventas.detalle_dia ?? [];
        // Órdenes del día por metodo_pago (campo nuevo del backend)
        const ordenesDia: any[]        = (resumen.ventas as any).ordenes_dia_detalle ?? [];

        // Efectivo = mostrador efectivo + órdenes efectivo
        this.totalEfectivo = sumaPorMetodo(detalleDia, mp => mp === 'efectivo')
                           + sumaPorMetodo(ordenesDia, mp => mp === 'efectivo');

        // Transferencia = mostrador transferencia + órdenes transferencia
        this.totalTransferencia = sumaPorMetodo(detalleDia, mp => mp.includes('transfer'))
                                + sumaPorMetodo(ordenesDia, mp => mp.includes('transfer'));

        // Total del día = toda la venta mostrador + todas las órdenes del día
        this.totalHoy         = sumaTodo(detalleDia) + sumaTodo(ordenesDia);
        this.totalDiaCompleto = this.totalHoy;

        // ✅ FIX #3: Semana y Mes — ahora ambos valores están disponibles
        // porque forkJoin garantiza que resumen Y operativo llegaron
        const totalOrdenesSemana = Number(this.stats.ventas.semana) || 0;
        const totalOrdenesMes = Number(this.stats.ventas.mes) || 0;
        const totalMostradorSemana = Number((operativo.ventas as any).total_ventas_semana) || 0;
        const totalMostradorMes = Number((operativo.ventas as any).total_ventas_mes) || 0;

        this.totalSemanaCompleto = totalOrdenesSemana + totalMostradorSemana;
        this.totalMesCompleto = totalOrdenesMes + totalMostradorMes;

        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando datos del dashboard', err);
        this.errorCarga = 'No se pudieron cargar los datos del dashboard. Intenta de nuevo.';
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
      const originalWidth = comisionesElement.scrollWidth;
      const originalHeight = comisionesElement.scrollHeight;
      const canvas = await html2canvas(comisionesElement, {
        width: originalWidth,
        height: originalHeight,
        scale: 2,
        useCORS: true,
        backgroundColor: '#1A1A1A'
      });
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      let pageCanvas = document.createElement('canvas');
      let pageCtx = pageCanvas.getContext('2d');
      const pagePxHeight = Math.floor((pageHeight - margin * 2) * (canvas.width / contentWidth));
      let renderedHeight = 0;
      while (renderedHeight < canvas.height) {
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(pagePxHeight, canvas.height - renderedHeight);
        if (pageCtx) {
          pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(canvas, 0, renderedHeight, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
        }
        const pageImageData = pageCanvas.toDataURL('image/png');
        const pageDrawHeight = (pageCanvas.height * contentWidth) / canvas.width;
        pdf.addImage(pageImageData, 'PNG', margin, margin, contentWidth, pageDrawHeight);
        renderedHeight += pagePxHeight;
        if (renderedHeight < canvas.height) pdf.addPage();
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

    const sedeParam = this.getSedeParam();

    this.estadisticasService.exportarReporte(tipo, formato, sedeParam).subscribe({
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
      const originalWidth = dashboardElement.scrollWidth;
      const originalHeight = dashboardElement.scrollHeight;
      const canvas = await html2canvas(dashboardElement, {
        width: originalWidth,
        height: originalHeight,
        scale: 2,
        useCORS: true,
        backgroundColor: '#1A1A1A'
      });
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      let pageCanvas = document.createElement('canvas');
      let pageCtx = pageCanvas.getContext('2d');
      const pagePxHeight = Math.floor((pageHeight - margin * 2) * (canvas.width / contentWidth));
      let renderedHeight = 0;
      while (renderedHeight < canvas.height) {
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(pagePxHeight, canvas.height - renderedHeight);
        if (pageCtx) {
          pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(canvas, 0, renderedHeight, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
        }
        const pageImageData = pageCanvas.toDataURL('image/png');
        const pageDrawHeight = (pageCanvas.height * contentWidth) / canvas.width;
        pdf.addImage(pageImageData, 'PNG', margin, margin, contentWidth, pageDrawHeight);
        renderedHeight += pagePxHeight;
        if (renderedHeight < canvas.height) pdf.addPage();
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