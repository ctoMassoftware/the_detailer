import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CombosServicios } from './combos-servicios';

describe('CombosServicios', () => {
  let component: CombosServicios;
  let fixture: ComponentFixture<CombosServicios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombosServicios]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CombosServicios);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
