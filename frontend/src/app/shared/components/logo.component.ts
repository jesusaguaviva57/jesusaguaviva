import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Logo de la iglesia (SVG en línea: sin peticiones extra ni parpadeos).
 * Sustituye el `<path>` por el logo real cuando lo tengáis.
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-2.5">
      <svg [ngClass]="boxClass" viewBox="0 0 64 64" role="img" [attr.aria-label]="alt" class="shrink-0 rounded-xl bg-brand-700">
        <path
          d="M32 12c5.2 7.2 10.4 12.9 10.4 20.4A10.4 10.4 0 0 1 32 42.8a10.4 10.4 0 0 1-10.4-10.4C21.6 24.9 26.8 19.2 32 12Z"
          fill="#ffffff"
        />
        <path d="M24 46h16v3H24z" fill="#bfd3fe" />
        <path d="M30.5 43h3v9h-3z" fill="#bfd3fe" />
      </svg>
      <span *ngIf="showName" class="flex flex-col leading-tight">
        <span class="text-base font-bold tracking-tight text-slate-900">{{ name }}</span>
        <span class="text-xs font-medium text-brand-800">{{ tagline }}</span>
      </span>
    </span>
  `,
})
export class LogoComponent {
  @Input() name = 'Iglesia Jesús Agua Viva';
  @Input() tagline = 'Un lugar para encontrarte con Dios';
  @Input() alt = 'Logo Iglesia Jesús Agua Viva';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() showName = true;

  get boxClass(): string {
    switch (this.size) {
      case 'sm':
        return 'h-8 w-8';
      case 'lg':
        return 'h-16 w-16';
      default:
        return 'h-10 w-10';
    }
  }
}
