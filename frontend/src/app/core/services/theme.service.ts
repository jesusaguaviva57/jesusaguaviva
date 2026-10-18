import { Injectable, NgZone, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

/** Clave de localStorage donde se guarda la elección manual del usuario. */
const STORAGE_KEY = 'jagv-theme';

/**
 * Modo claro / oscuro.
 *
 * Reglas:
 *  1. Si el usuario ha pulsado el botón alguna vez, manda su elección (se guarda
 *     en localStorage y se recuerda en las siguientes visitas).
 *  2. Si nunca lo ha pulsado, se respeta lo que diga el navegador
 *     (`prefers-color-scheme`) y se reacciona EN VIVO si el sistema cambia
 *     (por ejemplo, si el móvil entra solo en modo oscuro de noche).
 *
 * El primer pintado lo hace un pequeño script inline en `index.html`: así no se
 * ve el destello blanco mientras carga Angular. Este servicio solo se
 * sincroniza con ese estado y se encarga de los cambios posteriores.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  /**
   * El cambio de preferencia del sistema llega desde fuera de Angular: hay que
   * volver a entrar en la zona para que la vista repinte el icono (luna/sol).
   */
  private readonly zone = inject(NgZone);

  /** Tema que está aplicado ahora mismo. */
  readonly mode = signal<ThemeMode>('light');

  /** `true` si el usuario lo eligió a mano; `false` si seguimos al navegador. */
  readonly isManual = signal(false);

  constructor() {
    const stored = this.readStored();

    this.isManual.set(stored !== null);
    this.apply(stored ?? this.systemMode());

    // Solo seguimos los cambios del sistema mientras el usuario no haya elegido.
    this.media.addEventListener('change', (event) => {
      if (this.isManual()) return;
      const next: ThemeMode = event.matches ? 'dark' : 'light';
      this.zone.run(() => this.apply(next));
    });
  }

  /** Interruptor del botón: claro <-> oscuro. */
  toggle(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  /** Fija un tema concreto y lo recuerda. */
  setMode(mode: ThemeMode): void {
    this.isManual.set(true);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* navegación privada: funcionamos igual, solo que sin recordarlo */
    }
    this.apply(mode);
  }

  /** Vuelve a seguir la preferencia del navegador. */
  followSystem(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignorar */
    }
    this.isManual.set(false);
    this.apply(this.systemMode());
  }

  private systemMode(): ThemeMode {
    return this.media.matches ? 'dark' : 'light';
  }

  private readStored(): ThemeMode | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null;
    }
  }

  /** Aplica el tema al documento (clase en <html> + color-scheme + meta). */
  private apply(mode: ThemeMode): void {
    this.mode.set(mode);

    const root = document.documentElement;
    root.classList.toggle('dark', mode === 'dark');
    // Pinta también los controles nativos (scrollbars, inputs, autofill).
    root.style.colorScheme = mode;

    // Barra del navegador en móvil.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#0b1220' : '#1d3bcf');
  }
}
