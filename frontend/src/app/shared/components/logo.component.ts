import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Logo de la iglesia.
 *
 * La imagen vive en `public/logo.png` (versión recortada y con fondo
 * transparente de `logoIglesia.png`), por lo que se sirve tal cual desde la
 * raíz del sitio. El favicon sigue siendo `public/favicon.svg`, que es
 * independiente de este componente.
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-2.5">
      <img
        [src]="src"
        [ngClass]="boxClass"
        [alt]="alt"
        class="shrink-0 object-contain"
        decoding="async"
      />
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
  @Input() src = '/logo.png';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() showName = true;

  get boxClass(): string {
    switch (this.size) {
      case 'sm':
        return 'h-9 w-9';
      case 'lg':
        return 'h-16 w-16';
      default:
        return 'h-11 w-11';
    }
  }
}
