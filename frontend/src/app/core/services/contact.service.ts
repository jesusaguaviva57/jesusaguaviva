import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import type { ApiEnvelope, ContactPayload, ContactResult } from '../models/api.model';

/**
 * Envío del formulario de contacto.
 * El correo se entrega desde el Worker con Resend: aquí no hay credenciales
 * ni lógica de email (seguridad por diseño).
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiBaseUrl}/api/contact`;

  send(payload: ContactPayload): Observable<ContactResult> {
    return this.http
      .post<ApiEnvelope<ContactResult>>(this.endpoint, payload)
      .pipe(map((response) => response.data));
  }
}
