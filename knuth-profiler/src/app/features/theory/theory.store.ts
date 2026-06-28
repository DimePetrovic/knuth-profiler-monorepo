import { Injectable, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TheoryContentService } from './theory-content.service';
import { TheoryCard } from '../../core/theory/theory.model';

@Injectable({ providedIn: 'root' })
export class TheoryStore {
  private readonly router = inject(Router);
  private readonly content = inject(TheoryContentService);

  readonly cards = signal<TheoryCard[]>(this.content.getCards());
  readonly index = signal<number>(0);

  readonly total = computed(() => this.cards().length);
  readonly current = computed(() => this.cards()[this.index()] ?? null);
  readonly canPrev = computed(() => this.index() > 0);
  readonly canNext = computed(() => this.index() < this.total() - 1);
  readonly isLast = computed(() => this.index() === this.total() - 1);

  prev(): void {
    if (!this.canPrev()) return;
    this.index.update(i => i - 1);
  }

  next(): void {
    if (!this.canNext()) return;
    this.index.update(i => i + 1);
  }

  goTo(i: number): void {
    if (i < 0 || i >= this.total()) return;
    this.index.set(i);
  }

  finish(): void {
    this.router.navigateByUrl('/');
  }
}
