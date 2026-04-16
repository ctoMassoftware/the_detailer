import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Nav } from "../../shared/nav/nav";
import { MensajeService } from '../../services/mensaje.service';
import { RifaService } from '../../services/rifa.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-boleta-mensajes',
  standalone: true,
  imports: [Nav, CommonModule, FormsModule],
  templateUrl: './boleta-mensajes.html',
  styleUrls: ['./boleta-mensajes.css']
})
export class BoletaMensajes implements OnInit {
    ganadorRifaActual: any = null;
  historialGanadores: any[] = [];
  mostrarModalGanadores: boolean = false;


  verHistorialGanadores() {
    this.rifaService.historialGanadores().subscribe({
      next: (data: any[]) => {
        this.historialGanadores = data;
        this.mostrarModalGanadores = true;
      },
      error: (err: any) => {
        console.error(err);
        Swal.fire('Error', 'No se pudo cargar el historial de ganadores', 'error');
      }
    });
  }

  cerrarModalGanadores() {
    this.mostrarModalGanadores = false;
    this.historialGanadores = [];
  }
  private mensajeService: MensajeService = inject(MensajeService);
  private rifaService = inject(RifaService);

  mensajeBienvenida: string = 'Cargando mensaje...';
  mensajeDespedida: string = 'Cargando mensaje...';

  idBienvenida: number | null = null;
  idDespedida: number | null = null;

  datosBoleta = {
    numero: '',
    fecha: '',
    premio: '',
    encargado: '',
    estado: 'Activa'
  };

  busquedaBoleta: string = '';



  rifasRegistradas: any[] = [];
  boletasDeRifaSeleccionada: any[] = [];
  rifaSeleccionadaTitulo: string = '';

  mostrarModalBoleta: boolean = false;
  mostrarModalMensaje: boolean = false;
  mostrarModalDespedida: boolean = false;
  mostrarModalVisualizar: boolean = false;
  cargandoBoletas: boolean = false;

  mostrarAlerta: boolean = false;
  mensajeAlerta: string = '';

  ngOnInit() {
    this.cargarMensajes();
    this.cargarHistorialRifas();
  }

  cargarMensajes() {
    this.mensajeService.getMensajes().subscribe({
      next: (data: any[]) => {
        if (Array.isArray(data)) {
          const msjB = data.find((m: any) => m.tipo_mensaje?.toLowerCase() === 'bienvenida');
          if (msjB) {
            this.mensajeBienvenida = msjB.contenido;
            this.idBienvenida = msjB.id_mensaje;
          } else {
            this.mensajeBienvenida = 'Sin mensaje configurado.';
          }

          const msjD = data.find((m: any) => m.tipo_mensaje?.toLowerCase() === 'despedida');
          if (msjD) {
            this.mensajeDespedida = msjD.contenido;
            this.idDespedida = msjD.id_mensaje;
          } else {
            this.mensajeDespedida = 'Sin mensaje configurado.';
          }
        }
      },
      error: (err) => console.error('Error cargando mensajes', err)
    });
  }

  cargarHistorialRifas() {
    this.rifaService.getTodasRifas().subscribe({
      next: (data: any[]) => {
        if (Array.isArray(data)) {
          this.rifasRegistradas = data.map((r: any) => ({
            id_evento: r.id_evento,
            fecha: new Date(r.fecha_sorteo).toISOString().split('T')[0],
            premio: r.descripcion_premios,
            encargado: r.encargado,
            estado: r.estado ? 'Activa' : 'inactiva'
          }));
        }
      },
      error: (err: any) => console.error('Error cargando rifas', err)
    });
  }

  get rifasFiltradas() {
    if (!this.busquedaBoleta) return this.rifasRegistradas;
    const busqueda = this.busquedaBoleta.toLowerCase();

    return this.rifasRegistradas.filter(r =>
      (r.encargado && r.encargado.toLowerCase().includes(busqueda)) ||
      (r.premio && r.premio.toLowerCase().includes(busqueda)) ||
      (r.fecha && r.fecha.toLowerCase().includes(busqueda))
    );
  }

  filtroBoleta: string = '';
  filtroBoletaNombre: string = '';


  get boletasFiltradas() {
    const fNum = (this.filtroBoleta || '').trim();
    const fNom = (this.filtroBoletaNombre || '').trim().toLowerCase();

    if (!fNum && !fNom) return this.boletasDeRifaSeleccionada;

    return this.boletasDeRifaSeleccionada.filter(b => {
      let matches = true;
      if (fNum) matches = matches && String(b.numero_boleta).includes(fNum);
      if (fNom) matches = matches && (b.nombre || '').toLowerCase().includes(fNom);
      return matches;
    });
  }

  abrirModalCrear() {
    this.datosBoleta = { numero: '', fecha: '', premio: '', encargado: '', estado: 'Activa' };
    this.mostrarModalBoleta = true;
  }
  cerrarModalBoleta() { this.mostrarModalBoleta = false; }

  fechaMinima: string = new Date().toISOString().split('T')[0];

  guardarNuevaRifa() {
    const fechaHoy = new Date();
    fechaHoy.setHours(0, 0, 0, 0);

    const fechaSeleccionada = new Date(this.datosBoleta.fecha);
    fechaSeleccionada.setHours(0, 0, 0, 0);

    if (fechaSeleccionada < fechaHoy) {
      this.mostrarExito('No se pueden crear rifas con fechas anteriores a hoy');
      return;
    }

    if (!this.datosBoleta.fecha || !this.datosBoleta.premio || !this.datosBoleta.encargado) {
      this.mostrarExito('Por favor completa todos los campos');
      return;
    }

    const payload = {
      fecha: this.datosBoleta.fecha,
      descripcion_premios: this.datosBoleta.premio,
      encargado: this.datosBoleta.encargado
    };

    this.rifaService.crearRifa(payload).subscribe({
      next: () => {
        this.mostrarExito('Nueva rifa creada correctamente');
        this.cerrarModalBoleta();
        this.cargarHistorialRifas();
      },
      error: (err: any) => {
        console.error(err);
        this.mostrarExito('Error al crear la rifa');
      }
    });
  }

  eliminarRifa(rifa: any) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: `Se eliminará la rifa "${rifa.premio}" y TODAS las boletas asociadas. No podrás revertir esto.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ea2a33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar todo',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.rifaService.eliminarRifa(rifa.id_evento).subscribe({
          next: () => {
            Swal.fire(
              '¡Eliminado!',
              'La rifa y sus boletas han sido eliminadas.',
              'success'
            );
            this.cargarHistorialRifas();
          },
          error: (err: any) => {
            console.error(err);
            Swal.fire('Error', 'No se pudo eliminar la rifa.', 'error');
          }
        });
      }
    });
  }

  abrirModalMensaje() {
    if (this.mensajeBienvenida === 'Sin mensaje configurado.') this.mensajeBienvenida = '';
    this.mostrarModalMensaje = true;
  }
  cerrarModalMensaje() { this.mostrarModalMensaje = false; }

  guardarMensaje() {
    this.mensajeService.updateMensaje(this.idBienvenida, 'bienvenida', this.mensajeBienvenida).subscribe({
      next: () => {
        this.mostrarExito('Mensaje de bienvenida actualizado');
        this.cerrarModalMensaje();
        this.cargarMensajes();
      },
      error: () => this.mostrarExito('Error al actualizar')
    });
  }

  abrirModalDespedida() {
    if (this.mensajeDespedida === 'Sin mensaje configurado.') this.mensajeDespedida = '';
    this.mostrarModalDespedida = true;
  }
  cerrarModalDespedida() { this.mostrarModalDespedida = false; }

  guardarDespedida() {
    this.mensajeService.updateMensaje(this.idDespedida, 'despedida', this.mensajeDespedida).subscribe({
      next: () => {
        this.mostrarExito('Mensaje de despedida actualizado');
        this.cerrarModalDespedida();
        this.cargarMensajes();
      },
      error: () => this.mostrarExito('Error al actualizar')
    });
  }

  visualizarRifa(rifa: any) {
    this.rifaSeleccionadaTitulo = `Rifa del ${rifa.fecha} - ${rifa.premio}`;
    this.mostrarModalVisualizar = true;
    this.cargandoBoletas = true;
    this.boletasDeRifaSeleccionada = [];
    this.filtroBoleta = '';
    this.filtroBoletaNombre = '';
    this.ganadorRifaActual = null;

    // Consultar si ya hay ganador para esta rifa
    this.rifaService.historialGanadores().subscribe({
      next: (historial: any[]) => {
        const ganador = historial.find(g => g.id_evento_rifa === rifa.id_evento);
        if (ganador) {
          this.ganadorRifaActual = ganador;
        }
      },
      complete: () => {
        this.rifaService.getBoletasPorEvento(rifa.id_evento).subscribe({
          next: (data: any[]) => {
            this.boletasDeRifaSeleccionada = data;
            this.cargandoBoletas = false;
          },
          error: (err: any) => {
            console.error('Error cargando boletas', err);
            this.cargandoBoletas = false;
          }
        });
      }
    });
  }
  elegirGanadorManual(boleta: any, rifa: any) {
    if (this.ganadorRifaActual) {
      this.mostrarExito('Ya existe un ganador para esta rifa.');
      return;
    }
    this.rifaService.elegirGanador(rifa.id_evento, boleta.id_boleta).subscribe({
      next: (resp: any) => {
        this.mostrarExito('¡Ganador registrado!');
        this.ganadorRifaActual = resp.ganador;
      },
      error: (err: any) => {
        console.error(err);
        this.mostrarExito(err.error?.error || 'No se pudo registrar el ganador');
      }
    });
  }

  cerrarModalVisualizar() {
    this.mostrarModalVisualizar = false;
    this.boletasDeRifaSeleccionada = [];
    this.filtroBoleta = '';
    this.filtroBoletaNombre = '';

  }

  mostrarExito(texto: string) {
    this.mensajeAlerta = texto;
    this.mostrarAlerta = true;
    setTimeout(() => {
      this.mostrarAlerta = false;
    }, 3000);
  }

}