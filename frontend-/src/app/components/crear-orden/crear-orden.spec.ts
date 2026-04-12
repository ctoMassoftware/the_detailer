import { Component } from '@angular/core';
import { Nav } from '../../shared/nav/nav';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // 1. Importamos el Router

@Component({
  selector: 'app-crear-orden',
  standalone: true,
  imports: [Nav, CommonModule],
  templateUrl: './crear-orden.html',
  styleUrl: './crear-orden.css'
})
export class CrearOrden {
  valorTotal: number = 0;
  mostrarAlerta: boolean = false;

  constructor(private router: Router) {}

  actualizarTotal(event: any, precio: number) {
    if (event.target.checked) {
      this.valorTotal += precio;
    } else {
      this.valorTotal -= precio;
    }
  }

  get valorTotalFormateado(): string {
    return '$ ' + this.valorTotal.toLocaleString('es-CO');
  }

  guardarOrden() {
    this.mostrarAlerta = true;
  }

  cerrarAlerta() {
    this.mostrarAlerta = false;
    this.router.navigate(['/home']);
  }
}