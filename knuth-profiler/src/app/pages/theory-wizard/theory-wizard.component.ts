import { Component, computed, inject } from '@angular/core';
import { TheoryStore } from '../../features/theory/theory.store';
import { CommonModule } from '@angular/common';
import { TheoryCardComponent } from '../../features/theory/theory-card/theory-card.component';

@Component({
  selector: 'app-theory-wizard',
  imports: [CommonModule, TheoryCardComponent],
  templateUrl: './theory-wizard.component.html',
  styleUrl: './theory-wizard.component.scss'
})
export class TheoryWizardComponent {
  private readonly store = inject(TheoryStore);

  current = this.store.current;
  index = this.store.index;
  total = this.store.total;
  canPrev = this.store.canPrev;
  canNext = this.store.canNext;
  isLast = this.store.isLast;

  progress = computed(() => {
    const t = this.total();
    if (t === 0) return 0;
    return Math.round(((this.index() + 1) / t) * 100);
  });

  prev = () => this.store.prev();
  next = () => this.store.next();
  finish = () => this.store.finish();
}
