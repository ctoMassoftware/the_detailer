import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Nav } from '../../shared/nav/nav';
import { VentaMostradorService } from '../../services/venta-mostrador.service';

@Component({
  selector: 'app-cuaderno-recibos',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './cuaderno-recibos.html',
  styleUrl: './cuaderno-recibos.css'
})
export class CuadernoRecibos implements OnInit {

  private ventaMostradorService = inject(VentaMostradorService);

  historialVentas: any[] = [];
  filtroFecha: string = '';
  totalDelDia: number = 0;
  totalEfectivo: number = 0;
  totalTransferencia: number = 0;

  detallesVisibles: boolean[] = [];

  ngOnInit() {
    this.filtroFecha = new Date().toISOString().split('T')[0];
    this.cargarHistorial();
  }

  cargarHistorial() {
    this.ventaMostradorService.getHistorial(this.filtroFecha).subscribe({
      next: (res: any[]) => {
        this.historialVentas = res;
        this.calcularTotalDelDia();
        this.detallesVisibles = new Array(res.length).fill(false);
      },
      error: (err) => console.error('Error al cargar historial', err)
    });
  }

  aplicarFiltros() {
    this.cargarHistorial();
  }

  limpiarFiltros() {
    this.filtroFecha = new Date().toISOString().split('T')[0];
    this.cargarHistorial();
  }

  calcularTotalDelDia() {
    this.totalDelDia = this.historialVentas.reduce((sum, venta) => sum + Number(venta.total), 0);
    this.totalEfectivo = this.historialVentas
      .filter(venta => (venta.metodo_pago || '').toLowerCase() === 'efectivo')
      .reduce((sum, venta) => sum + Number(venta.total), 0);
    this.totalTransferencia = this.historialVentas
      .filter(venta => (venta.metodo_pago || '').toLowerCase().includes('transfer'))
      .reduce((sum, venta) => sum + Number(venta.total), 0);
  }

  obtenerNombreVendedor(venta: any): string {
    let nombreVendedor = venta.vendedor_nombre ? venta.vendedor_nombre.trim() : '';
    let nombreLimpio = nombreVendedor.replace(/sede\s*/i, '').trim();
    let resultadoFinal = nombreLimpio ? nombreLimpio : (venta.sede || '');
    resultadoFinal = resultadoFinal.replace(/sede\s*/i, '').trim();

    if (!resultadoFinal) return 'No registrado';
    return resultadoFinal.charAt(0).toUpperCase() + resultadoFinal.slice(1).toLowerCase();
  }

  toggleDetalles(index: number) {
    this.detallesVisibles[index] = !this.detallesVisibles[index];
  }
}