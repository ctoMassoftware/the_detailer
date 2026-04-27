import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Home } from './components/home/home';
import { CrearOrdenComponent } from './components/crear-orden/crear-orden';
import { ConsultarOrden } from './components/consultar-orden/consultar-orden';
import { Inventario } from './components/inventario/inventario';
import { InventarioProductos } from './components/inventario-productos/inventario-productos';
import { BoletaMensajes } from './components/boleta-mensajes/boleta-mensajes';
import { Graficas } from './components/visualizar-graficas/visualizar-graficas';
import { GestionOperarios } from './components/gestion-operarios/gestion-operarios';
import { CombosServicios } from './components/combos-servicios/combos-servicios';
import { VentaMostrador } from './components/venta-mostrador/venta-mostrador';
import { CuadernoRecibos } from './components/cuaderno-recibos/cuaderno-recibos'; // 👈 NUEVA IMPORTACIÓN
import { authGuard } from './guards/auth.guard';
import { Landing } from './components/landing/landing';

export const routes: Routes = [
  // ==========================================
  // RUTAS PÚBLICAS
  // ==========================================
  { path: '', component: Landing, pathMatch: 'full' },
  { path: 'login', component: Login },

  // ==========================================
  // RUTAS OPERATIVAS (Acceso para Operarios y Admins)
  // ==========================================
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: 'crear-orden', component: CrearOrdenComponent, canActivate: [authGuard] },
  { path: 'consultar-orden', component: ConsultarOrden, canActivate: [authGuard] },
  { path: 'inventario', component: Inventario, canActivate: [authGuard] },
  { path: 'inventario2', component: InventarioProductos, canActivate: [authGuard] },
  { path: 'venta-mostrador', component: VentaMostrador, canActivate: [authGuard] }, 
  { path: 'cuaderno-recibos', component: CuadernoRecibos, canActivate: [authGuard] }, // 👈 NUEVA RUTA

  // ==========================================
  // RUTAS ADMINISTRATIVAS (Estrictamente Jefatura)
  // ==========================================
  { 
    path: 'boleta-mensajes', 
    component: BoletaMensajes, 
    canActivate: [authGuard],
    data: { roles: ['SUPER_ADMIN', 'ADMIN', 'ADMIN_SEDE'] }
  },
  { 
    path: 'combos-servicios', 
    component: CombosServicios, 
    canActivate: [authGuard],
    data: { roles: ['SUPER_ADMIN', 'ADMIN', 'ADMIN_SEDE'] }
  },
  {
    path: 'visualizar-graficas',
    component: Graficas,
    canActivate: [authGuard],
    data: { roles: ['SUPER_ADMIN', 'ADMIN', 'ADMIN_SEDE'] }
  },
  {
    path: 'gestion-operarios',
    component: GestionOperarios,
    canActivate: [authGuard],
    data: { roles: ['SUPER_ADMIN', 'ADMIN', 'ADMIN_SEDE'] }
  },

  // ==========================================
  // FALLBACK (Si el usuario escribe una ruta que no existe)
  // ==========================================
  { path: '**', redirectTo: '' }
];