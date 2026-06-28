import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TheoryCard } from '../../../core/theory/theory.model';
@Component({
  selector: 'app-theory-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theory-card.component.html'
})
export class TheoryCardComponent {
  @Input() card: TheoryCard | null = null;
  @Input() canPrev = false;
  @Input() canNext = false;
  @Input() isLast = false;

  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() finish = new EventEmitter<void>();
}
