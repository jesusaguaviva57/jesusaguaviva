import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

/**
 * Mensaje de estado (éxito / error / aviso / info) con estilo consistente.
 * Uso:
 *   <app-alert variant="error" [message]="error()" />
 *   <app-alert variant="success" message="¡Mensaje enviado!" [dismissible]="true" (dismissed)="clear()" />
 */
@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-start gap-3 rounded-xl border p-4 text-sm animate-fade-in-up"
      [ngClass]="containerClass"
      role="alert"
      aria-live="polite"
    >
      <svg class="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path [attr.d]="iconPath" />
      </svg>

      <div class="flex-1">
        <p class="font-semibold">{{ message }}</p>
        <p *ngIf="details" class="mt-1 opacity-90">{{ details }}</p>
      </div>

      <button
        *ngIf="dismissible"
        type="button"
        class="shrink-0 rounded-md p-1 opacity-70 transition hover:opacity-100"
        aria-label="Cerrar mensaje"
        (click)="dismissed.emit()"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
          />
        </svg>
      </button>
    </div>
  `,
})
export class AlertComponent {
  @Input({ required: true }) message!: string;

  /** Detalle secundario (ej. pista del backend). */
  @Input() details: string | null = null;

  @Input() variant: AlertVariant = 'info';

  @Input() dismissible = false;

  @Output() dismissed = new EventEmitter<void>();

  get containerClass(): string {
    switch (this.variant) {
      case 'success':
        return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200';
      case 'warning':
        return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200';
      default:
        return 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200';
    }
  }

  get iconPath(): string {
    switch (this.variant) {
      case 'success':
        return 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.7-5.4 5.4a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 1 1 1.4-1.4l1.9 1.9 4.7-4.7a1 1 0 0 1 1.4 1.4Z';
      case 'error':
        return 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v7h-2V7Zm0 9h2v2h-2v-2Z';
      case 'warning':
        return 'M12 2 1.5 21h21L12 2Zm-1 6h2v7h-2V8Zm0 9h2v2h-2v-2Z';
      default:
        return 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm1.1-5.6-.9.7c-.6.5-.9.9-.9 2.4h-2c0-1.8.4-2.6 1.4-3.4l.9-.7c.5-.4.8-.8.8-1.4 0-1.1-.9-2-2-2s-2 .9-2 2h-2a4 4 0 1 1 8 0c0 1.1-.5 1.9-1.3 2.4Z';
    }
  }
}
