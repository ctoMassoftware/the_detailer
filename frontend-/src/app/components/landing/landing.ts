import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Footer } from '../../shared/footer/footer';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, Footer],
  templateUrl: './landing.html',
  styleUrls: ['./landing.css']
})
export class Landing {
  isMenuOpen = false;
  
  private authService = inject(AuthService);

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  logout() {
    this.authService.logout();
  }

  slides = [
    {
      image: 'assets/img3.jpeg',
      subtitle: 'Estética Automotriz Premium',
      title: 'Precisión en',
      highlight: 'cada detalle'
    },
    {
      image: 'assets/img1.jpeg',
      subtitle: 'Pasión por la Excelencia',
      title: 'Maestría',
      highlight: 'Artesanal'
    },
    {
      image: 'assets/img7.jpeg',
      subtitle: 'Protección de Vanguardia',
      title: 'Acabado de',
      highlight: 'Nivel Exposición'
    },
    {
      image: 'assets/img2.jpeg',
      subtitle: 'Cuidado Profesional Garantizado',
      title: 'Tu vehículo en',
      highlight: 'Manos Expertas'
    }
  ];

  currentSlide = 0;
  private intervalId: any;

  ngOnInit() {
    this.startAutoPlay();
  }

  ngOnDestroy() {
    this.stopAutoPlay();
  }

  startAutoPlay() {
    this.intervalId = setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  stopAutoPlay() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
  }

  prevSlide() {
    this.currentSlide = (this.currentSlide - 1 + this.slides.length) % this.slides.length;
  }

  goToSlide(index: number) {
    this.currentSlide = index;
    this.stopAutoPlay();
    this.startAutoPlay();
  }

}