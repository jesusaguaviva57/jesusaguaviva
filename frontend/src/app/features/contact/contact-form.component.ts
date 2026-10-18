import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { extractFieldIssues, toApiError, type ContactPayload } from '../../core/models/api.model';
import { ContactService } from '../../core/services/contact.service';
import { AlertComponent } from '../../shared/components/alert.component';
import { SpinnerComponent } from '../../shared/components/spinner.component';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Formulario de contacto.
 *
 * - Validación en cliente (UX) y en servidor (seguridad). El Worker revalida
 *   todo: nunca confiamos solo en el navegador.
 * - Estados explícitos: idle / submitting / success / error.
 * - Los errores por campo que devuelve el backend se pintan en su input.
 */
@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SpinnerComponent, AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Éxito -->
    <div *ngIf="status() === 'success'" class="card p-8 text-center animate-fade-in-up">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.7-5.4 5.4a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 1 1 1.4-1.4l1.9 1.9 4.7-4.7a1 1 0 0 1 1.4 1.4Z"
          />
        </svg>
      </div>
      <h3 class="mt-4 text-lg font-bold text-slate-900">¡Mensaje enviado!</h3>
      <p class="mt-2 text-sm text-slate-600">
        Gracias por escribirnos. Te responderemos muy pronto.
      </p>
      <p *ngIf="dryRun()" class="mt-2 text-xs text-amber-700">
        Modo demostración: el correo no se envió realmente (RESEND_DRY_RUN está activo).
      </p>
      <button type="button" class="btn-secondary mt-6" (click)="reset()">Enviar otro mensaje</button>
    </div>

    <!-- Formulario -->
    <form *ngIf="status() !== 'success'" [formGroup]="form" (ngSubmit)="submit()" class="card p-6 sm:p-8" novalidate>
      <div *ngIf="errorMessage() as message" class="mb-6">
        <app-alert
          variant="error"
          [message]="message"
          [details]="errorDetails()"
          [dismissible]="true"
          (dismissed)="clearError()"
        />
      </div>

      <div class="grid gap-5 sm:grid-cols-2">
        <div>
          <label class="field-label" for="nombre">Nombre <span class="text-red-500">*</span></label>
          <input
            id="nombre"
            type="text"
            formControlName="name"
            class="field-input"
            [class.field-input-invalid]="isInvalid('name')"
            placeholder="Tu nombre"
            autocomplete="name"
          />
          <p *ngIf="isInvalid('name')" class="field-error">{{ fieldError('name', 'Ingresa tu nombre (mínimo 2 caracteres).') }}</p>
        </div>

        <div>
          <label class="field-label" for="email">Email <span class="text-red-500">*</span></label>
          <input
            id="email"
            type="email"
            formControlName="email"
            class="field-input"
            [class.field-input-invalid]="isInvalid('email')"
            placeholder="tucorreo@ejemplo.com"
            autocomplete="email"
          />
          <p *ngIf="isInvalid('email')" class="field-error">{{ fieldError('email', 'Ingresa un email válido.') }}</p>
        </div>

        <div class="sm:col-span-2">
          <label class="field-label" for="asunto">Título <span class="text-red-500">*</span></label>
          <input
            id="asunto"
            type="text"
            formControlName="subject"
            class="field-input"
            [class.field-input-invalid]="isInvalid('subject')"
            placeholder="Ej. Consulta sobre las reuniones de jóvenes"
            autocomplete="off"
            maxlength="120"
          />
          <p *ngIf="isInvalid('subject')" class="field-error">{{ fieldError('subject', 'Escribe un título (mínimo 3 caracteres).') }}</p>
        </div>

        <div class="sm:col-span-2">
          <label class="field-label" for="mensaje">Mensaje <span class="text-red-500">*</span></label>
          <textarea
            id="mensaje"
            rows="6"
            formControlName="message"
            class="field-input resize-y"
            [class.field-input-invalid]="isInvalid('message')"
            placeholder="Cuéntanos en qué podemos ayudarte o comparte tu petición de oración…"
          ></textarea>
          <div class="mt-1.5 flex items-start justify-between gap-3">
            <p *ngIf="isInvalid('message')" class="field-error mt-0">
              {{ fieldError('message', 'El mensaje debe tener al menos 10 caracteres.') }}
            </p>
            <span class="ml-auto shrink-0 text-xs text-slate-400">{{ remainingChars }} / 4000</span>
          </div>
        </div>
      </div>

      <!-- Honeypot anti-bots: invisible para humanos, no debe rellenarse nunca. -->
      <div class="hidden" aria-hidden="true">
        <label for="website">No rellenar este campo</label>
        <input id="website" type="text" formControlName="website" tabindex="-1" autocomplete="off" />
      </div>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-slate-500">
          Tus datos solo se usan para responderte.
        </p>
        <button type="submit" class="btn-primary px-6 py-3" [disabled]="status() === 'submitting'">
          <app-spinner *ngIf="status() === 'submitting'" size="sm" label="Enviando" />
          <span>{{ status() === 'submitting' ? 'Enviando…' : 'Enviar mensaje' }}</span>
        </button>
      </div>
    </form>
  `,
})
export class ContactFormComponent {
  private readonly contact = inject(ContactService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
    website: [''],
  });

  readonly status = signal<FormStatus>('idle');
  readonly errorMessage = signal<string | null>(null);
  readonly errorDetails = signal<string | null>(null);
  readonly dryRun = signal(false);

  get remainingChars(): number {
    return 4000 - this.form.controls.message.value.length;
  }

  isInvalid(field: 'name' | 'email' | 'subject' | 'message'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  /** Mensaje del servidor para ese campo (si lo hay) o el de cliente. */
  fieldError(field: 'name' | 'email' | 'subject' | 'message', fallback: string): string {
    const serverError = this.form.controls[field].errors?.['server'];
    return typeof serverError === 'string' ? serverError : fallback;
  }

  clearError(): void {
    this.errorMessage.set(null);
    this.errorDetails.set(null);
    this.status.set('idle');
  }

  reset(): void {
    this.form.reset({
      name: '',
      email: '',
      subject: '',
      message: '',
      website: '',
    });
    this.dryRun.set(false);
    this.clearError();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.clearServerErrors();

    const raw = this.form.getRawValue();
    const payload: ContactPayload = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      subject: raw.subject.trim(),
      message: raw.message.trim(),
      website: raw.website,
    };

    this.status.set('submitting');
    this.errorMessage.set(null);
    this.errorDetails.set(null);

    this.contact
      .send(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.dryRun.set(result.dryRun);
          this.status.set('success');
        },
        error: (error: unknown) => {
          const apiError = toApiError(error);
          this.applyServerErrors(apiError);
          this.errorMessage.set(apiError.message);
          this.errorDetails.set(apiError.requestId ? `Referencia del error: ${apiError.requestId}` : null);
          this.status.set('error');
        },
      });
  }

  /** Pinta los errores por campo que devuelve el backend en su input. */
  private applyServerErrors(error: unknown): void {
    for (const issue of extractFieldIssues(error)) {
      const control = this.form.get(issue.field);
      if (!control) continue;
      control.setErrors({ ...(control.errors ?? {}), server: issue.message });
      control.markAsTouched();
    }
  }

  /** Limpia los errores de servidor previos antes de un nuevo envío. */
  private clearServerErrors(): void {
    for (const control of Object.values(this.form.controls)) {
      const errors = control.errors;
      if (!errors || !('server' in errors)) continue;

      const remaining: Record<string, unknown> = { ...errors };
      delete remaining['server'];
      control.setErrors(Object.keys(remaining).length > 0 ? remaining : null);
    }
  }
}
