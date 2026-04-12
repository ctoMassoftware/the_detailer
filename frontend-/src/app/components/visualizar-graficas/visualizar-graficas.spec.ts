import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisualizarGraficas } from './visualizar-graficas';

describe('VisualizarGraficas', () => {
  let component: VisualizarGraficas;
  let fixture: ComponentFixture<VisualizarGraficas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualizarGraficas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisualizarGraficas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
