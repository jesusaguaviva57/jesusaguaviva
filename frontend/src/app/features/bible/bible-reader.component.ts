import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError, toApiError, type BibleVerse } from '../../core/models/api.model';
import { BibleService } from '../../core/services/bible.service';
import { AlertComponent } from '../../shared/components/alert.component';
import { SpinnerComponent } from '../../shared/components/spinner.component';

/**
 * Lector de la Biblia.
 *
 * El usuario escribe una referencia ("Juan 3:16", "Salmos 23", "1 Corintios 13:4-7")
 * y se consulta NUESTRO Worker, que a su vez consulta Midvash. El navegador
 * nunca habla con el tercero.
 */
@Component({
  selector: 'app-bible-reader',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SpinnerComponent, AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card p-6 sm:p-8">
      <!-- Buscador -->
      <form [formGroup]="form" (ngSubmit)="search()" class="flex flex-col gap-3 sm:flex-row">
        <div class="flex-1">
          <label class="sr-only" for="referencia">Referencia bíblica</label>
          <input
            id="referencia"
            type="search"
            formControlName="reference"
            class="field-input"
            [class.field-input-invalid]="showError()"
            placeholder="Ej. Juan 3:16"
            autocomplete="off"
            spellcheck="false"
            aria-describedby="referencia-ayuda"
          />
          <p id="referencia-ayuda" class="mt-1.5 text-xs text-slate-500">
            Escribe un versículo (<em>Juan 3:16</em>), un rango (<em>Romanos 8:28-30</em>) o un capítulo
            completo (<em>Salmos 23</em>).
          </p>
          <p *ngIf="showError()" class="field-error">{{ validationMessage() }}</p>
        </div>

        <button type="submit" class="btn-primary sm:mt-0.5 sm:self-start" [disabled]="loading()">
          <app-spinner *ngIf="loading()" size="sm" label="Buscando" />
          <span>{{ loading() ? 'Buscando…' : 'Buscar' }}</span>
        </button>
      </form>

      <!-- Sugerencias rápidas -->
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Sugerencias</span>
        <button
          *ngFor="let suggestion of suggestions"
          type="button"
          class="chip"
          (click)="useSuggestion(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>

      <!-- Estado: cargando -->
      <div *ngIf="loading()" class="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <app-spinner size="sm" label="Consultando la Biblia" />
        <span>Consultando la Biblia…</span>
      </div>

      <!-- Estado: error -->
      <div *ngIf="error() as err" class="mt-6">
        <app-alert
          variant="error"
          [message]="err.message"
          [details]="errorHint()"
          [dismissible]="true"
          (dismissed)="error.set(null)"
        />
      </div>

      <!-- Estado: resultado -->
      <article *ngIf="verse() as passage" class="mt-6 animate-fade-in-up">
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 class="font-serif text-xl font-bold text-slate-900">{{ lastQuery() }}</h3>
            <p class="mt-0.5 text-xs text-slate-500">
              {{ passage.bookName }} {{ passage.chapter }}:{{ passage.verse }}<ng-container
                *ngIf="passage.verseEnd > passage.verse">-{{ passage.verseEnd }}</ng-container>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge bg-brand-50 text-brand-800">{{ passage.versionName }}</span>
            <span *ngIf="passage.cached" class="badge" title="Servido desde la caché">⚡ caché</span>
          </div>
        </header>

        <!-- Aviso si Midvash devolvió otra versión distinta a la solicitada -->
        <div *ngIf="passage.versionMismatch" class="mt-4">
          <app-alert variant="warning" message="Versión distinta a la configurada" [details]="passage.notice ?? null" />
        </div>

        <!-- Versículo único -->
        <blockquote *ngIf="!isChapter()" class="mt-5">
          <p class="font-serif text-lg leading-relaxed text-slate-800 sm:text-xl">{{ passage.text }}</p>
        </blockquote>

        <!-- Capítulo completo: un versículo por línea con su número -->
        <ol *ngIf="isChapter()" class="mt-5 space-y-3">
          <li *ngFor="let item of numberedVerses()" class="font-serif text-base leading-relaxed text-slate-800 sm:text-lg">
            <sup class="mr-1.5 select-none align-super text-xs font-sans font-bold text-brand-700">{{ item.number }}</sup>
            {{ item.text }}
          </li>
        </ol>

        <p *ngIf="passage.copyright" class="mt-6 whitespace-pre-line border-t border-slate-200 pt-4 text-xs text-slate-500">
          {{ passage.copyright }}
        </p>
      </article>
    </div>
  `,
})
export class BibleReaderComponent {
  private readonly bible = inject(BibleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = inject(FormBuilder).nonNullable.group({
    reference: ['Juan 3:16', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
  });

  readonly suggestions = ['Juan 3:16', 'Salmos 23', 'Romanos 8:28', 'Filipenses 4:13', 'Génesis 1', 'Proverbios 3:5-6'];

  /** Estado local (signals). */
  readonly loading = signal(false);
  readonly verse = signal<BibleVerse | null>(null);
  readonly error = signal<ApiError | null>(null);
  readonly lastQuery = signal('');

  readonly isChapter = computed(() => (this.verse()?.verses.length ?? 0) > 1);

  readonly numberedVerses = computed(() => {
    const passage = this.verse();
    if (!passage || passage.verses.length <= 1) return [];
    return passage.verses.map((text, index) => ({ number: passage.verse + index, text }));
  });

  /** Pista contextual que envía el backend (ej. versiones disponibles). */
  readonly errorHint = computed<string | null>(() => {
    const err = this.error();
    const details = err?.details;
    if (typeof details !== 'object' || details === null) return null;

    const hint = (details as { hint?: unknown }).hint;
    if (typeof hint === 'string') return hint;

    const spanish = (details as { availableSpanish?: unknown }).availableSpanish;
    if (Array.isArray(spanish)) {
      const names = spanish
        .map((item) =>
          typeof item === 'object' && item !== null && typeof (item as { name?: unknown }).name === 'string'
            ? ((item as { name: string }).name)
            : null,
        )
        .filter((name): name is string => name !== null);
      return names.length > 0 ? `Versiones disponibles en español: ${names.join(', ')}.` : null;
    }
    return null;
  });

  showError(): boolean {
    const control = this.form.controls.reference;
    return control.invalid && (control.dirty || control.touched);
  }

  validationMessage(): string {
    const control = this.form.controls.reference;
    if (control.hasError('required')) return 'Escribe una referencia bíblica.';
    if (control.hasError('minlength')) return 'La referencia es demasiado corta.';
    return 'Máximo 120 caracteres.';
  }

  useSuggestion(reference: string): void {
    this.form.controls.reference.setValue(reference);
    this.search();
  }

  /** Nº de secuencia de la última búsqueda: descarta las respuestas que llegan tarde. */
  private requestSeq = 0;

  search(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const reference = this.form.controls.reference.value.trim();
    const seq = ++this.requestSeq;

    this.loading.set(true);
    this.error.set(null);
    this.verse.set(null);

    this.bible
      .search(reference)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (passage) => {
          // Si el usuario ya lanzó otra búsqueda, esta respuesta está obsoleta:
          // descartarla evita que un resultado antiguo pise al más reciente.
          if (seq !== this.requestSeq) return;
          this.verse.set(passage);
          this.lastQuery.set(reference);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          if (seq !== this.requestSeq) return;
          this.error.set(toApiError(error));
          this.loading.set(false);
        },
      });
  }
}
