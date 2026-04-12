import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InventarioProductos } from './inventario-productos';

describe('InventarioProductos', () => {
  let component: InventarioProductos;
  let fixture: ComponentFixture<InventarioProductos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventarioProductos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InventarioProductos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
