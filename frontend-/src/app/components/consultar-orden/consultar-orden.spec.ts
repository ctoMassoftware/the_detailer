import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsultarOrden } from './consultar-orden';

describe('ConsultarOrden', () => {
  let component: ConsultarOrden;
  let fixture: ComponentFixture<ConsultarOrden>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultarOrden]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsultarOrden);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
