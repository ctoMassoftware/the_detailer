import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router'; // 👈 Añadido para leer la URL
import { Nav } from "../../shared/nav/nav";
import { InventarioVentaService } from '../../services/inventario-venta.service';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule], 
  templateUrl: './inventario.html',
  styleUrls: ['./inventario.css']
})
export class Inventario implements OnInit {
  private inventarioService = inject(InventarioVentaService);
  private route = inject(ActivatedRoute); // 👈 Inyectado para atrapar la sede

  productos: any[] = [];
  productosFiltrados: any[] = [];
  filtroBusqueda: string = ''; 

  mostrarAlerta: boolean = false;
  mensajeAlerta: string = '';
  tipoAlerta: 'success' | 'error' = 'success';

  mostrarModal: boolean = false;
  esEdicion: boolean = false;
  
  mostrarConfirmacion: boolean = false; 
  productoAEliminar: any = null; 

  sedeSeleccionada: string | null = null; // 👈 Variable para guardar la sede

  nuevoProducto: any = {
    id_producto_venta: null,
    nombre_producto: '',
    proveedor: '',
    categoria: '',
    ubicacion: '',
    costo: 0,
    precio_venta: 0,
    cantidad: 0,
    stock_minimo: 5,
    sede: '' // 👈 Añadido para saber a qué sede enviarlo al crear
  };

  ngOnInit() {
    // 👈 Atrapamos la sede de la URL y luego cargamos los productos
    this.route.queryParams.subscribe(params => {
      this.sedeSeleccionada = params['sede'] || null;
      this.cargarProductos();
    });
  }

  cargarProductos() {
    // 👈 Le pasamos la sede al servicio para que el backend filtre
    this.inventarioService.getProductos(this.sedeSeleccionada || undefined).subscribe({
      next: (data) => {
        this.productos = data;
        this.aplicarFiltro();
      },
      error: (err) => console.error('Error cargando inventario', err)
    });
  }

  paginaActual: number = 1;
  itemsPorPagina: number = 10;

  get productosPaginados() {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.productosFiltrados.slice(inicio, fin);
  }

  get totalPaginas() {
    return Math.ceil(this.productosFiltrados.length / this.itemsPorPagina);
  }

  cambiarPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  aplicarFiltro() {
    this.paginaActual = 1;
    if (!this.filtroBusqueda) {
      this.productosFiltrados = this.productos;
      return;
    }
    
    const texto = this.filtroBusqueda.toLowerCase();
    this.productosFiltrados = this.productos.filter(p => 
      (p.nombre_producto || '').toLowerCase().includes(texto) || 
      (p.proveedor || '').toLowerCase().includes(texto) ||
      (p.categoria || '').toLowerCase().includes(texto) ||
      String(p.id_producto_venta).includes(texto)
    );
  }

  abrirModal() {
    this.esEdicion = false;
    this.limpiarFormulario();
    this.mostrarModal = true;
  }

  editarProducto(producto: any) {
    this.esEdicion = true;
    this.nuevoProducto = { ...producto }; 
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.limpiarFormulario();
  }

  guardarProducto() {
    if (
      !this.nuevoProducto.nombre_producto || 
      !this.nuevoProducto.categoria || 
      !this.nuevoProducto.proveedor || 
      !this.nuevoProducto.ubicacion || 
      this.nuevoProducto.cantidad === null || 
      this.nuevoProducto.cantidad === undefined
    ) {
      this.mostrarMensaje('Por favor, completa todos los campos del producto', 'error');
      return;
    }

    if (this.nuevoProducto.costo < 0 || this.nuevoProducto.precio_venta < 0) {
      this.mostrarMensaje('El costo y el precio deben ser de 0 en adelante', 'error');
      return;
    }

    if (this.nuevoProducto.cantidad < 0) {
      this.mostrarMensaje('La cantidad no puede ser un valor negativo', 'error');
      return;
    }

    if (this.esEdicion) {
      this.inventarioService.updateProducto(this.nuevoProducto.id_producto_venta, this.nuevoProducto).subscribe({
        next: () => {
          this.mostrarMensaje('Producto actualizado exitosamente', 'success');
          this.cargarProductos();
          this.cerrarModal();
        },
        error: () => this.mostrarMensaje('Error al actualizar el producto', 'error')
      });
    } else {
      this.inventarioService.createProducto(this.nuevoProducto).subscribe({
        next: () => {
          this.mostrarMensaje('Producto creado exitosamente', 'success');
          this.cargarProductos();
          this.cerrarModal();
        },
        error: () => this.mostrarMensaje('Error al crear el producto', 'error')
      });
    }
  }

  confirmarEliminacion(producto: any) {
    this.productoAEliminar = producto;
    this.mostrarConfirmacion = true;
  }

  cancelarEliminacion() {
    this.mostrarConfirmacion = false;
    this.productoAEliminar = null;
  }

  eliminarProducto() {
    if (!this.productoAEliminar) return;

    this.inventarioService.deleteProducto(this.productoAEliminar.id_producto_venta).subscribe({
      next: () => {
        this.mostrarMensaje('Producto eliminado', 'success');
        this.cargarProductos();
        this.cancelarEliminacion();
      },
      error: () => {
        this.mostrarMensaje('Error al eliminar producto', 'error');
        this.cancelarEliminacion();
      }
    });
  }

  limpiarFormulario() {
    this.nuevoProducto = {
      id_producto_venta: null,
      nombre_producto: '',
      proveedor: '',
      categoria: '',
      ubicacion: '',
      costo: 0,
      precio_venta: 0,
      cantidad: 0,
      stock_minimo: 5,
      sede: this.sedeSeleccionada || '' // 👈 Se autocompleta con la sede de la URL
    };
  }

  mostrarMensaje(texto: string, tipo: 'success' | 'error') {
    this.mensajeAlerta = texto;
    this.tipoAlerta = tipo;
    this.mostrarAlerta = true;
    setTimeout(() => this.mostrarAlerta = false, 3000);
  }
}