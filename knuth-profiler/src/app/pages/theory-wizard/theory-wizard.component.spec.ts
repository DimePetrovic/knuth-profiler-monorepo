import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TheoryWizardComponent } from './theory-wizard.component';

describe('TheoryWizardComponent', () => {
  let component: TheoryWizardComponent;
  let fixture: ComponentFixture<TheoryWizardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TheoryWizardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TheoryWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
