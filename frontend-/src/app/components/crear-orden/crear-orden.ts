
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Nav } from "../../shared/nav/nav";
import { ServicioService } from '../../services/servicio.service';
import { OrdenService } from '../../services/orden.service';
import { OperarioService } from '../../services/operario.service';

@Component({
  selector: 'app-crear-orden',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './crear-orden.html',
  styleUrls: ['./crear-orden.css']
})
export class CrearOrdenComponent implements OnInit {
    // --- Autocompletar clientes/placas para el input de nombre_cliente ---
    sugerenciasClientes: any[] = [];
    buscandoCliente = false;

    buscarClientePlaca(event: Event) {
      const input = event.target as HTMLInputElement | null;
      const valor = input?.value || '';
      if (valor.length >= 2) {
        this.buscandoCliente = true;
        this.ordenService.buscarClientesPlacas(valor).subscribe({
          next: (res: any[]) => {
            this.sugerenciasClientes = res;
            this.buscandoCliente = false;
          },
          error: (err: any) => {
            this.sugerenciasClientes = [];
            this.buscandoCliente = false;
          }
        });
      } else {
        this.sugerenciasClientes = [];
      }
    }

    seleccionarSugerenciaCliente(s: any) {
      if (!s) return;
      this.datosOrden.nombre_cliente = s.nombre_cliente || '';
      this.datosOrden.telefono_cliente = s.telefono_cliente || '';
      this.datosOrden.placa = s.placa_vehiculo || '';
      // Autocompletar tipo de vehículo, marca y modelo (mapeo correcto)
      this.datosOrden.tipoVehiculo = s.tipo_vehiculo || '';
      this.datosOrden.marca = s.marca_vehiculo || '';
      this.datosOrden.modelo = s.modelo_vehiculo || '';
      this.sugerenciasClientes = [];
    }
  // --- Autocompletar placas ---
  sugerenciasPlaca: any[] = [];
  buscandoPlaca = false;

  buscarPlaca(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const valor = input?.value || '';
    if (valor.length >= 2) {
      this.buscandoPlaca = true;
      this.ordenService.buscarClientesPlacas(valor).subscribe({
        next: (res: any[]) => {
          this.sugerenciasPlaca = res;
          this.buscandoPlaca = false;
        },
        error: (err: any) => {
          this.sugerenciasPlaca = [];
          this.buscandoPlaca = false;
        }
      });
    } else {
      this.sugerenciasPlaca = [];
    }
  }

  seleccionarSugerenciaPlaca(s: any) {
    if (!s) return;
    this.datosOrden.placa = s.placa_vehiculo || '';
    this.datosOrden.nombre_cliente = s.nombre_cliente || '';
    this.datosOrden.telefono_cliente = s.telefono_cliente || '';
    // Autocompletar tipo de vehículo, marca y modelo (mapeo correcto)
    this.datosOrden.tipoVehiculo = s.tipo_vehiculo || '';
    this.datosOrden.marca = s.marca_vehiculo || '';
    this.datosOrden.modelo = s.modelo_vehiculo || '';
    this.sugerenciasPlaca = [];
  }
  // ...resto de la clase y métodos...

// ...el resto de la clase CrearOrdenComponent sigue aquí...

  private servicioService = inject(ServicioService);
  private ordenService = inject(OrdenService);
  private operarioService = inject(OperarioService);
  private router = inject(Router);

  serviciosUnitarios: any[] = [];
  combos: any[] = [];
  tecnicos: any[] = [];
  nombreTecnicoSeleccionado: string = '';

  rolUsuario: string = '';

  datosOrden: any = {
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
    nombre_cliente: '',
    cedula_cliente: '',
    telefono_cliente: '',
    correo_cliente: '',
    direccion_cliente: '',
    placa: '',
    marca: '',
    modelo: '',
    color: '',
    tipoVehiculo: '',
    tecnico_asignado: null,
    metodo_pago: 'Efectivo',
    caja: 'Caja 1',
    notas: '',
    deja_casco: false,
    cantidad_cascos: 0
  };

  itemsSeleccionados: any[] = [];
  total: number = 0;
  
  mostrarAlerta: boolean = false;
  mensajeAlerta: string = '';
  tipoAlerta: 'success' | 'error' = 'success';

  mostrarModalAdicional: boolean = false;
  descAdicional: string = '';
  valorAdicional: number | null = null;
  servicioComodin: any = null;

  ngOnInit() {
    this.cargarUsuarioSesion();
    this.cargarServicios();
    this.cargarOperarios();
  }

  capitalizarPalabras(texto: string): string {
    if (!texto) return '';
    return texto.trim().split(' ').map(palabra => 
      palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    ).join(' ');
  }

  formatearNombreCliente() {
    if (this.datosOrden.nombre_cliente) {
      this.datosOrden.nombre_cliente = this.capitalizarPalabras(this.datosOrden.nombre_cliente);
    }
  }

  formatearMarca() {
    if (this.datosOrden.marca) {
      this.datosOrden.marca = this.capitalizarPalabras(this.datosOrden.marca);
    }
  }

  formatearModelo() {
    if (this.datosOrden.modelo) {
      this.datosOrden.modelo = this.capitalizarPalabras(this.datosOrden.modelo);
    }
  }

  marcasYModelos: { [key: string]: string[] } = {
    'Renault': ['Kwid', 'Sandero', 'Kardian', 'Stepway', 'Logan', 'Duster', 'Oroch', 'Captur', 'Koleos', 'Arkana E-Tech', 'Megane E-Tech'],
    'Chevrolet': ['Onix', 'Sail', 'Aveo', 'Spark EUV', 'Spark', 'Joy', 'Tracker', 'Captiva', 'Colorado', 'Equinox', 'Blazer', 'Traverse', 'Tahoe'],
    'Toyota': ['Corolla', 'Corolla Cross', 'Hilux', 'SW4 Fortuner', 'RAV4', 'Yaris', 'Prado', '4Runner', 'Land Cruiser'],
    'Mazda': ['2', '3', 'CX-30', 'CX-5', 'CX-50', 'CX-9', 'CX-90'],
    'Kia': ['Picanto', 'Sonet', 'Rio', 'Soluto', 'Cerato', 'Stonic', 'Niro', 'Sportage', 'Sorento'],
    'Suzuki': ['Swift', 'S-Presso', 'Baleno', 'Vitara', 'Jimny', 'Fronx', 'Ertiga'],
    'Nissan': ['March', 'Versa', 'Sentra', 'Kicks', 'Qashqai', 'X-Trail', 'Frontier'],
    'Volkswagen': ['Polo', 'Virtus', 'Nivus', 'T-Cross', 'Taos', 'Tiguan', 'Amarok', 'Jetta'],
    'Hyundai': ['HB20', 'Accent', 'Tucson', 'Creta', 'Kona', 'Palisade'],
    'Ford': ['Ranger', 'F-150', 'Explorer', 'Escape', 'Mustang', 'Territory'],
    'Foton': ['Tunland', 'FRF'],
    'JAC': ['S2', 'S3', 'S4'],
    'Otra': ['Otro']
  };

  marcasYModelosMoto: { [key: string]: string[] } = {
    'Yamaha': ['FZ 150i', 'FZ 25', 'MT-03', 'YZF-R3', 'NMAX 155', 'Crypton', 'Fazer 150', 'SZ-RR'],
    'Honda': ['CB 150F', 'CB 190R', 'CB 300R', 'XR 150L', 'PCX 150', 'CB 650R', 'Africa Twin', 'ADV 150', 'Wave 110'],
    'Bajaj': ['Pulsar NS200', 'Pulsar RS200', 'Pulsar 150', 'Pulsar 200 NS', 'Dominar 400', 'Platina 110', 'CT100', 'Avenger 220'],
    'KTM': ['Duke 200', 'Duke 390', 'RC 390', 'Adventure 390', 'Duke 125'],
    'Suzuki': ['GN125', 'GSX-R150', 'V-Strom 650', 'Gixxer 150', 'Bandit 650'],
    'Royal Enfield': ['Meteor 350', 'Himalayan', 'Classic 350', 'Thunderbird 350', 'Hunter 350'],
    'AKT': ['NKD 125', 'TTR 200', 'Dynamic R 150', 'RTX 200', 'Evo R 150'],
    'Hero': ['Hunk 150', 'Dash 110', 'Eco Deluxe', 'Splendor Plus', 'Xtreme 160R'],
    'TVS': ['Apache RTR 160', 'Apache RTR 200', 'Sport 110', 'Ronin 225'],
    'Kawasaki': ['Ninja 300', 'Ninja 400', 'Z400', 'Versys 650', 'W800'],
    'Benelli': ['TRK 502', 'Leoncino 500', '302R', '502C'],
    'CF Moto': ['650 MT', '300 NK', '400 NK', '650 NK'],
    'Auteco': ['Beat 110', 'Discover 125', 'Platina 110'],
    'Otra': ['Otra']
  };

  get listaMarcas(): string[] {
    if (this.datosOrden.tipoVehiculo === 'moto') {
      return Object.keys(this.marcasYModelosMoto);
    }
    return Object.keys(this.marcasYModelos);
  }

  get listaModelos(): string[] {
    const marcaInput = this.datosOrden.marca;
    if (!marcaInput) return [];

    const catalogo = this.datosOrden.tipoVehiculo === 'moto'
      ? this.marcasYModelosMoto
      : this.marcasYModelos;

    const marcaEncontrada = Object.keys(catalogo).find(
      m => m.toLowerCase() === marcaInput.toLowerCase()
    );

    return marcaEncontrada ? catalogo[marcaEncontrada] : [];
  }

  cargarOperarios() {
    this.operarioService.getOperarios().subscribe({
      next: (data: any[]) => {
        this.tecnicos = data.filter(tech => tech.estado_operario === true);
      },
      error: (err) => console.error('Error cargando operarios', err)
    });
  }

  cargarUsuarioSesion() {
    const userStored = localStorage.getItem('user') || localStorage.getItem('usuario');
    if (userStored) {
      try {
        const user = JSON.parse(userStored);
        this.rolUsuario = (user.rol || user.role || '').toUpperCase(); 
        
        if (this.rolUsuario === 'OPERARIO') {
          const userName = user.nombre || user.name || user.email;
          if (userName) {
            this.nombreTecnicoSeleccionado = userName;
          }
        }
      } catch (e) {
        console.error('Error al leer usuario de sesión', e);
      }
    }
  }

  get valorTotalFormateado(): string {
    return '$ ' + this.total.toLocaleString('es-CO');
  }

  cargarServicios() {
    this.servicioService.getServicios().subscribe({
      next: (data) => {
        const listaCompleta = data.map((item: any) => ({
          ...item,
          precio_automovil: Number(item.precio_automovil) || 0,
          precio_campero: Number(item.precio_campero) || 0,
          precio_camioneta: Number(item.precio_camioneta) || 0,
          precio_moto: Number(item.precio_moto) || 0,
          aplica_automovil: item.aplica_automovil !== false,
          aplica_campero: item.aplica_campero !== false,
          aplica_camioneta: item.aplica_camioneta !== false,
          aplica_moto: item.aplica_moto !== false,
          nombre_servicio: item.nombre_servicio,
          descripcion: item.descripcion
        }));

        this.servicioComodin = listaCompleta.find(s => s.nombre_servicio.toLowerCase().includes('adicional'));

        this.combos = listaCompleta.filter((s: any) =>
          (s.tipo || '').toUpperCase().includes('COMBO')
        );

        this.serviciosUnitarios = listaCompleta.filter((s: any) => {
           const esCombo = (s.tipo || '').toUpperCase().includes('COMBO');
           const esComodin = this.servicioComodin && s.id_servicio === this.servicioComodin.id_servicio;
           return !esCombo && !esComodin;
        });
      },
      error: (err) => console.error(err)
    });
  }

  onTipoVehiculoChange() {
    this.itemsSeleccionados = [];
    this.total = 0;
    this.datosOrden.marca = '';
    this.datosOrden.modelo = '';
  }

  normalizarPlaca() {
    if (this.datosOrden.placa) {
      this.datosOrden.placa = this.datosOrden.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
  }

  isItemChecked(id_servicio: any): boolean {
    return this.itemsSeleccionados.some(s => s.id_servicio === id_servicio && !s.isAdicional);
  }

  aplicaParaVehiculoActual(item: any): boolean {
    if (!item) return false;
    const tipo = this.datosOrden.tipoVehiculo;
    if (tipo === 'moto') return item.aplica_moto !== false;
    if (tipo === 'automovil') return item.aplica_automovil !== false;
    if (tipo === 'campero') return item.aplica_campero !== false;
    if (tipo === 'camioneta') return item.aplica_camioneta !== false;
    return true;
  }

  seleccionarServicio(event: any, item: any, precioAplicado: number) {
    const isChecked = event.target.checked;
    if (isChecked) {
      this.itemsSeleccionados.push({
        id_servicio: item.id_servicio,
        nombre: item.nombre_servicio,
        cantidad: 1,
        precio: precioAplicado,
        isAdicional: false
      });
      this.total += precioAplicado;
    } else {
      const index = this.itemsSeleccionados.findIndex(s => s.id_servicio === item.id_servicio && !s.isAdicional);
      if (index > -1) {
        this.total -= this.itemsSeleccionados[index].precio;
        this.itemsSeleccionados.splice(index, 1);
      }
    }
  }

  abrirModalAdicional() {
    if (!this.servicioComodin) {
      this.mostrarMensaje('El Jefe debe crear un servicio llamado "Adicional" (con precio $0) en el sistema para poder usar esta función.', 'error');
      return;
    }
    this.descAdicional = '';
    this.valorAdicional = null;
    this.mostrarModalAdicional = true;
  }

  cerrarModalAdicional() {
    this.mostrarModalAdicional = false;
  }

  confirmarAdicional() {
    if (!this.descAdicional || !this.valorAdicional || this.valorAdicional <= 0) {
      this.mostrarMensaje('Ingrese una descripción y un valor válido mayor a 0.', 'error');
      return;
    }

    const nombreAjustado = `Extra: ${this.descAdicional}`;

    this.itemsSeleccionados.push({
      id_servicio: this.servicioComodin.id_servicio,
      nombre: nombreAjustado,
      cantidad: 1,
      precio: Number(this.valorAdicional),
      isAdicional: true 
    });

    this.total += Number(this.valorAdicional);

    const notaExtra = `\n[${nombreAjustado} - $${this.valorAdicional}]`;
    this.datosOrden.notas = (this.datosOrden.notas || '') + notaExtra;

    this.cerrarModalAdicional();
  }

  getAdicionales() {
    return this.itemsSeleccionados.filter(item => item.isAdicional);
  }

  eliminarAdicional(item: any) {
    const index = this.itemsSeleccionados.indexOf(item);
    if (index > -1) {
      this.total -= item.precio;
      this.itemsSeleccionados.splice(index, 1);
      
      const notaExtra = `\n[${item.nombre} - $${item.precio}]`;
      this.datosOrden.notas = (this.datosOrden.notas || '').replace(notaExtra, '');
    }
  }

  validarSoloNumeros(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  guardarOrden() {
    if (this.datosOrden.telefono_cliente) {
      this.datosOrden.telefono_cliente = this.datosOrden.telefono_cliente.replace(/\D/g, '');
    }
    this.normalizarPlaca();

    if (this.total === 0 || this.itemsSeleccionados.length === 0) {
      this.mostrarMensaje('Selecciona al menos un servicio.', 'error');
      return;
    }

    if (!this.datosOrden.nombre_cliente || !this.datosOrden.telefono_cliente) {
      this.mostrarMensaje('Por favor ingresa el nombre y celular del cliente.', 'error');
      return;
    }

    if (!this.datosOrden.marca || !this.datosOrden.modelo || !this.datosOrden.placa || !this.datosOrden.tipoVehiculo) {
      this.mostrarMensaje('Por favor completa todos los datos del vehículo.', 'error');
      return;
    }

    const operarioEncontrado = this.tecnicos.find(
      t => (t.nombre || '').toLowerCase() === this.nombreTecnicoSeleccionado.toLowerCase()
    );

    if (!operarioEncontrado) {
      this.mostrarMensaje('Por favor selecciona un técnico válido de la lista.', 'error');
      return;
    }

    this.datosOrden.tecnico_asignado = operarioEncontrado.id_user || operarioEncontrado.id;

    // Solo enviar deja_casco y cantidad_cascos si es moto
    const payload: any = {
      cedula_cliente: this.datosOrden.cedula_cliente || '', 
      nombre_cliente: this.datosOrden.nombre_cliente,
      correo_cliente: this.datosOrden.correo_cliente || '',
      telefono_cliente: this.datosOrden.telefono_cliente,
      direccion_cliente: this.datosOrden.direccion_cliente || '',
      placa_vehiculo: this.datosOrden.placa,
      marca_vehiculo: this.datosOrden.marca,
      modelo_vehiculo: this.datosOrden.modelo,
      tipo_vehiculo: this.datosOrden.tipoVehiculo,
      metodo_pago: this.datosOrden.metodo_pago,
      caja: this.datosOrden.caja,
      id_user_encargado: this.datosOrden.tecnico_asignado,
      id_rifa: null,
      notas: this.datosOrden.notas,
      servicios: this.itemsSeleccionados.map(item => ({
        id_servicio: item.id_servicio,
        cantidad: item.cantidad,
        precio: item.precio
      }))
    };
    if (this.datosOrden.tipoVehiculo === 'moto') {
      payload.deja_casco = this.datosOrden.deja_casco;
      payload.cantidad_cascos = this.datosOrden.deja_casco ? Number(this.datosOrden.cantidad_cascos) : 0;
    }

    this.ordenService.createOrden(payload).subscribe({
      next: (resp) => {
        this.mostrarMensaje('Orden creada exitosamente', 'success');
      },
      error: (err) => {
        console.error(err);
        this.mostrarMensaje('Error al guardar la orden.', 'error');
      }
    });
  }

  mostrarMensaje(texto: string, tipo: 'success' | 'error') {
    this.mensajeAlerta = texto;
    this.tipoAlerta = tipo;
    this.mostrarAlerta = true;
  }

  cerrarAlerta() {
    this.mostrarAlerta = false;
    if (this.tipoAlerta === 'success') {
      this.router.navigate(['/consultar-orden']);
    }
  }
}