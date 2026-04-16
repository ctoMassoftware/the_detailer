import { Component, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { NgForm } from '@angular/forms';

interface BaseColor {
  r: number;
  g: number;
  b: number;
}

class Wave {
  constructor(
    public y: number,
    public wavelength: number,
    public amplitude: number,
    public speed: number,
    public opacity: number,
    public phase: number,
    private baseColor: BaseColor
  ) {}

  update() {
    this.phase += this.speed;
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number, mouse: { x: number | null, y: number | null }) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(${this.baseColor.r}, ${this.baseColor.g}, ${this.baseColor.b}, ${this.opacity})`;
    
    ctx.moveTo(0, height); 
    ctx.lineTo(0, this.y); 

    for (let x = 0; x <= width; x += 10) { 
      let dy = Math.sin(x / this.wavelength + this.phase) * this.amplitude;

      if (mouse.x !== null) {
        const dist = Math.abs(x - mouse.x); 
        const interactionRadius = 280; 

        if (dist < interactionRadius) {
          const force = (interactionRadius - dist) / interactionRadius;
          const lift = Math.sin(force * Math.PI / 2) * 45;
          dy -= lift; 
        }
      }
      ctx.lineTo(x, this.y + dy);
    }

    ctx.lineTo(width, height); 
    ctx.lineTo(0, height); 
    ctx.closePath();
    ctx.fill();
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements AfterViewInit, OnDestroy {
  @ViewChild('liquidCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  username: string = '';
  password: string = '';
  errorMessage: string = '';
  showPassword: boolean = false;
  
  private authService = inject(AuthService);
  private router = inject(Router);
  
  private ctx!: CanvasRenderingContext2D;
  private waves: Wave[] = [];
  private mouse = { x: null as number | null, y: null as number | null };
  private animationId: number = 0;
  private baseColor: BaseColor = { r: 253, g: 1, b: 0 };

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.animate();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationId);
  }

  @HostListener('window:resize')
  resize() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.createWaves();
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.mouse.x = null;
    this.mouse.y = null;
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(e: TouchEvent) {
    this.mouse.x = e.touches[0].clientX;
    this.mouse.y = e.touches[0].clientY;
  }

  @HostListener('touchend')
  onTouchEnd() {
    this.mouse.x = null;
    this.mouse.y = null;
  }

  private createWaves() {
    const height = this.canvasRef.nativeElement.height;
    this.waves = [
      new Wave(height * 0.55, 220, 20, 0.03, 0.25, 0, this.baseColor),
      new Wave(height * 0.60, 160, 18, 0.05, 0.45, 2.5, this.baseColor),
      new Wave(height * 0.65, 110, 12, 0.075, 0.75, 5, this.baseColor)
    ];
  }

  private animate() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo degradado
    let gradient = this.ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#220000'); 
    gradient.addColorStop(1, '#440000'); 
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.waves.forEach(wave => {
      wave.update();
      wave.draw(this.ctx, canvas.width, canvas.height, this.mouse);
    });

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  login(form: NgForm, event?: Event) {
    if (event) {
      event.preventDefault();
    }
    if (form.invalid) return;

    this.errorMessage = '';

    this.authService.login(this.username, this.password).subscribe({
      next: (res) => {
        this.router.navigate(['/home']);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Usuario o contraseña incorrectos. Inténtalo de nuevo.';
      }
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }

}