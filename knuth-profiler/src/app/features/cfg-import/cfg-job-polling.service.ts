import { Injectable, OnDestroy } from '@angular/core';
import { Subscription, exhaustMap, from, of, timer } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class CfgJobPollingService implements OnDestroy {
  private subscription: Subscription | null = null;

  start(jobId: string, pollOnce: (jobId: string) => Promise<boolean>): void {
    this.stop();
    this.subscription = timer(0, 1000)
      .pipe(
        exhaustMap(() =>
          from(pollOnce(jobId)).pipe(
            catchError(() => {
              this.stop();
              return of(false);
            }),
          ),
        ),
      )
      .subscribe(shouldContinue => {
        if (!shouldContinue) {
          this.stop();
        }
      });
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
