import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionOperarios } from './gestion-operarios';

describe('GestionOperarios', () => {
  let component: GestionOperarios;
  let fixture: ComponentFixture<GestionOperarios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionOperarios]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionOperarios);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
