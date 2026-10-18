import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import type { ApiEnvelope, BibleVerse } from '../models/api.model';

/**
 * Acceso al lector bíblico.
 *
 * ⚠️ El frontend NUNCA llama a Midvash: siempre pasa por nuestro Worker de
 * Cloudflare. Así el tercero queda encapsulado (si cambia su API, se arregla
 * en el backend) y el control de CORS/caché/errores es nuestro.
 */
@Injectable({ providedIn: 'root' })
export class BibleService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiBaseUrl}/api/bible`;

  /**
   * Caché en memoria por referencia normalizada. Evita repetir peticiones
   * cuando el usuario busca dos veces lo mismo o navega de ida y vuelta.
   */
  private readonly memoryCache = new Map<string, Observable<BibleVerse>>();
  private static readonly MAX_CACHE_ENTRIES = 40;

  /**
   * Busca una referencia: `Juan 3:16`, `Salmos 23` (capítulo completo) o
   * `1 Corintios 13:4-7` (rango).
   */
  search(reference: string): Observable<BibleVerse> {
    const query = reference.trim();
    const key = normalize(query);

    const cached = this.memoryCache.get(key);
    if (cached) return cached;

    const params = new HttpParams().set('query', query);
    const request$ = this.http
      .get<ApiEnvelope<BibleVerse>>(this.endpoint, { params })
      .pipe(
        map((response) => response.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.remember(key, request$);
    return request$;
  }

  /** Limpia la caché en memoria (útil para un botón "refrescar"). */
  clearCache(): void {
    this.memoryCache.clear();
  }

  private remember(key: string, value: Observable<BibleVerse>): void {
    if (this.memoryCache.size >= BibleService.MAX_CACHE_ENTRIES) {
      const oldest = this.memoryCache.keys().next();
      if (!oldest.done) this.memoryCache.delete(oldest.value);
    }
    this.memoryCache.set(key, value);
  }
}

/** Normaliza para comparar: minúsculas, sin acentos ni espacios dobles. */
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
