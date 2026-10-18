import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Spinner de carga reutilizable (accesible: `role="status"` + aria-label).
 * Uso: <app-spinner label="Buscando en la Biblia…" />
 */
@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="animate-spin text-brand-700 dark:text-brand-400"
      [ngClass]="sizeClass"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Z"
      />
    </svg>
    <span class="sr-only">{{ label }}</span>
  `,
  host: { role: 'status', '[attr.aria-label]': 'label' },
})
export class SpinnerComponent {
  /** Tamaño visual del spinner. */
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  /** Texto para lectores de pantalla. */
  @Input() label = 'Cargando…';

  get sizeClass(): string {
    switch (this.size) {
      case 'sm':
        return 'h-4 w-4';
      case 'lg':
        return 'h-10 w-10';
      default:
        return 'h-6 w-6';
    }
  }
}
