import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const requiredRoles = route.data['roles'] as Array<string>;
  
  if (requiredRoles) {
    const rawRole = authService.getRole() || '';
    const userRole = rawRole.toUpperCase();
    
    // Normalizar posibles roles antiguos o en minúscula ('admin', 'galan', 'centenario')
    const normalizedRole = userRole === 'ADMIN' ? 'SUPER_ADMIN' 
                         : (userRole === 'GALAN' || userRole === 'CENTENARIO') ? 'ADMIN_SEDE'
                         : userRole;

    if (requiredRoles.includes(userRole) || requiredRoles.includes(normalizedRole) || requiredRoles.includes(rawRole)) {
      return true;
    } else {
      alert('⛔ Acceso denegado: No tienes permisos suficientes.');
      router.navigate(['/home']);
      return false;
    }
  }

  return true;
};