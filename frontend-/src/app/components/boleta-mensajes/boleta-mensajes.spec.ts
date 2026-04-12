import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoletaMensajes } from './boleta-mensajes';

describe('BoletaMensajes', () => {
  let component: BoletaMensajes;
  let fixture: ComponentFixture<BoletaMensajes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoletaMensajes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoletaMensajes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
