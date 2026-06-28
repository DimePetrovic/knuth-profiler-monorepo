import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphCanvasComponent } from './graph-canvas.component';

describe('GraphCanvasComponent', () => {
  let component: GraphCanvasComponent;
  let fixture: ComponentFixture<GraphCanvasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphCanvasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraphCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
