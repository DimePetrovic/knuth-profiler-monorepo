import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TheoryCardComponent } from './theory-card.component';

describe('TheoryCardComponent', () => {
  let component: TheoryCardComponent;
  let fixture: ComponentFixture<TheoryCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TheoryCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TheoryCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
