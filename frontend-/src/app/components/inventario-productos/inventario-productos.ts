import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router'; // 👈 Añadido
import { Nav } from "../../shared/nav/nav";
import { InventarioProductoService } from '../../services/inventario-producto.service';

@Component({
  selector: 'app-inventario-productos',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule], 
  templateUrl: './inventario-productos.html',
  styleUrls: ['./inventario-productos.css']
})
export class InventarioProductos implements OnInit {
  private inventarioService = inject(InventarioProductoService);
  private route = inject(ActivatedRoute); // 👈 Inyectado

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

  sedeSeleccionada: string | null = null; // 👈 Variable para la sede

  nuevoProducto: any = {
    id_producto: null,
    nombre_producto: '',
    proveedor: '',
    categoria: '',
    ubicacion: '',
    costo: 0,
    cantidad: 0,
    stock_minimo: 5,
    sede: '' // 👈 Añadido para mandar la sede al backend
  };

  ngOnInit() {
    // 👈 Atrapamos la sede de la URL y luego cargamos los productos
    this.route.queryParams.subscribe(params => {
      this.sedeSeleccionada = params['sede'] || null;
      this.cargarProductos();
    });
  }

  cargarProductos() {
    // 👈 Le pasamos la sede al servicio
    this.inventarioService.getProductos(this.sedeSeleccionada || undefined).subscribe({
      next: (data) => {
        this.productos = data;
        this.aplicarFiltro();
      },
      error: (err) => console.error('Error cargando insumos', err)
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
      String(p.id_producto).includes(texto)
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
      this.nuevoProducto.cantidad === undefined ||
      this.nuevoProducto.costo === null ||
      this.nuevoProducto.costo === undefined
    ) {
      this.mostrarMensaje('Por favor, completa todos los campos del insumo', 'error');
      return;
    }

    if (this.nuevoProducto.costo < 0) {
      this.mostrarMensaje('El costo debe ser un valor de al menos $0 en adelante', 'error');
      return;
    }

    if (this.nuevoProducto.cantidad < 0) {
      this.mostrarMensaje('La cantidad no puede ser un valor negativo', 'error');
      return;
    }

    if (this.esEdicion) {
      this.inventarioService.updateProducto(this.nuevoProducto.id_producto, this.nuevoProducto).subscribe({
        next: () => {
          this.mostrarMensaje('Insumo actualizado correctamente', 'success');
          this.cargarProductos();
          this.cerrarModal();
        },
        error: () => this.mostrarMensaje('Error al actualizar el insumo', 'error')
      });
    } else {
      this.inventarioService.createProducto(this.nuevoProducto).subscribe({
        next: () => {
          this.mostrarMensaje('Insumo creado correctamente', 'success');
          this.cargarProductos();
          this.cerrarModal();
        },
        error: () => this.mostrarMensaje('Error al crear el insumo', 'error')
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

    this.inventarioService.deleteProducto(this.productoAEliminar.id_producto).subscribe({
      next: () => {
        this.mostrarMensaje('Insumo eliminado', 'success');
        this.cargarProductos();
        this.cancelarEliminacion();
      },
      error: () => {
        this.mostrarMensaje('Error al eliminar', 'error');
        this.cancelarEliminacion();
      }
    });
  }

  limpiarFormulario() {
    this.nuevoProducto = {
      id_producto: null,
      nombre_producto: '',
      proveedor: '',
      categoria: '',
      ubicacion: '',
      costo: 0,
      cantidad: 0,
      stock_minimo: 5,
      sede: this.sedeSeleccionada || '' // 👈 Pre-carga la sede actual
    };
  }

  mostrarMensaje(texto: string, tipo: 'success' | 'error') {
    this.mensajeAlerta = texto;
    this.tipoAlerta = tipo;
    this.mostrarAlerta = true;
    setTimeout(() => this.mostrarAlerta = false, 3000);
  }
}