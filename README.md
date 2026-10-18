# Iglesia Jesús Agua Viva — Web + API serverless

Sitio web completo (landing + lector de Biblia + formulario de contacto) con una arquitectura
serverless de dos despliegues independientes:

| Capa | Tecnología | Hosting |
| --- | --- | --- |
| Frontend (SPA) | Angular 16 · Standalone Components · Tailwind CSS · TypeScript estricto | **Vercel** |
| Backend (API) | Node.js · **Hono** · TypeScript estricto · Cloudflare Workers | **Cloudflare Workers** |
| Caché / rate-limit | Cloudflare KV (opcional) | Cloudflare |
| Correo del formulario | **Resend API** (llamada desde el Worker) | Resend |
| Texto bíblico | **Midvash API** (`api.midvash.com`) | Midvash |

> El navegador **nunca** llama a Midvash ni a Resend: todo pasa por el Worker, que centraliza
> CORS, caché, validación, secretos y manejo de errores.

---

## ⚠️ Lee esto primero: sobre la Biblia Reina-Valera 1960 (RVR1960)

La API pública de Midvash **no ofrece la RVR1960**. Su copyright pertenece a las Sociedades
Bíblicas Unidas, por lo que ninguna API gratuita puede distribuirla legalmente. Las versiones en
español disponibles hoy (comprobado el 2026-10-18 contra `GET /v1/versions`) son:

| Slug | Versión | Nota legal |
| --- | --- | --- |
| `rvr1909` | Reina-Valera 1909 | **Dominio público** — uso libre, incluso audio. **Recomendada.** |
| `rvg` | Reina-Valera Gómez 2010 | © 2004, 2010, 2023 Dr. Humberto Gómez Caballero. |
| `sev` | Sagradas Escrituras 1569 (Biblia del Oso) | Dominio público (Casiodoro de Reina, Basilea 1569). |
| `onbv-es` | Open Nueva Biblia Viva | © 2006, 2008 Biblica, Inc. |
| `pdt` | Palabra de Dios para ti | © 2020 Asociación Bíblica Latinoamericana. |

No necesitas memorizar esta tabla: si configuras un slug que no existe, el Worker responde `400`
**y te enumera las versiones en español disponibles** consultando la API en vivo.

Además hay un comportamiento peligroso de Midvash que el Worker neutraliza: si pides una versión
inexistente (`/v1/rvr1960/...`) **responde `200 OK` con el texto de RVR1909**, sin avisar. Este
proyecto:

1. Valida el slug contra `GET /v1/versions` antes de pedir el texto → devuelve **400** con un
   mensaje claro y la lista de versiones en español disponibles, en vez de mostrar texto incorrecto.
2. Compara la versión devuelta con la solicitada y, si no coincide, marca
   `versionMismatch: true` + `notice` en la respuesta (la UI muestra un aviso ámbar).

**Conclusión:** deja `BIBLE_VERSION = "rvr1909"` en `wrangler.toml`. Si necesitas la RVR1960 sí o sí,
solo puedes usar una fuente con licencia (por ejemplo, un proyecto bíblico propio con los textos
licenciados) e implementarlo como un segundo proveedor en `backend/src/services/`.

Para cambiar de versión no hace falta tocar código:

```toml
# backend/wrangler.toml
[vars]
BIBLE_VERSION = "rvg"   # o "rvr1909"
```

---

## 1. Estructura de carpetas

```
jesusaguaviva/
├── package.json                 # scripts de conveniencia del monorepo
├── .gitignore
├── README.md                    # este archivo (guía de despliegue)
│
├── backend/                     # ── API serverless (Cloudflare Workers) ──
│   ├── package.json
│   ├── tsconfig.json            # strict + noUncheckedIndexedAccess
│   ├── wrangler.toml            # configuración del Worker (vars, KV, observabilidad)
│   ├── .dev.vars.example        # secretos y overrides para desarrollo local
│   ├── api.http                 # colección de peticiones de prueba (REST Client)
│   └── src/
│       ├── index.ts             # app Hono: middlewares, /api/health, 404 y onError
│       ├── types.ts             # Env, DTOs del contrato y códigos de error
│       ├── lib/
│       │   ├── cors.ts          # CORS explícito + preflight OPTIONS
│       │   ├── errors.ts        # ApiError tipado
│       │   ├── middleware.ts    # requestId, logger JSON, waitUntil
│       │   ├── response.ts      # envelopes de éxito y respuesta de error
│       │   ├── text.ts          # escapeHtml, normalización de referencias
│       │   └── validation.ts    # validación del formulario + honeypot
│       ├── routes/
│       │   ├── bible.ts         # GET /api/bible, /api/bible/versions
│       │   └── contact.ts       # POST /api/contact
│       └── services/
│           ├── midvash.client.ts  # cliente HTTP de Midvash (timeout, retry, mapeo de errores)
│           ├── bible.service.ts   # caché KV + guardarraíl de versión
│           ├── email.service.ts   # Resend (HTML escapado + texto plano + idempotencia)
│           └── rate-limit.ts      # rate limit best-effort sobre KV
│
└── frontend/                    # ── SPA (Angular 16 + Tailwind) ──
    ├── package.json
    ├── angular.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── vercel.json              # rewrites del SPA + cabeceras de caché/seguridad
    ├── public/favicon.svg
    └── src/
        ├── index.html
        ├── main.ts              # bootstrapApplication (sin NgModule)
        ├── styles.css           # Tailwind + clases de componente (@apply)
        ├── environments/
        │   ├── environment.ts              # desarrollo -> http://localhost:8787
        │   └── environment.production.ts   # producción  -> tu Worker
        └── app/
            ├── app.component.ts        # header sticky + outlet + footer
            ├── app.config.ts           # providers globales
            ├── app.routes.ts           # rutas lazy
            ├── core/
            │   ├── config/site.config.ts   # ✏️ datos de la iglesia (¡edita aquí!)
            │   ├── models/api.model.ts     # contrato de la API + ApiError
            │   ├── interceptors/api-error.interceptor.ts
            │   └── services/{bible,contact}.service.ts
            ├── shared/components/{spinner,alert,logo}.component.ts
            └── features/
                ├── home/home.component.ts
                ├── bible/bible-reader.component.ts
                ├── contact/{contact-form,contact-page}.component.ts
                ├── location/location-map.component.ts
                └── not-found/not-found.component.ts
```

---

## 2. Requisitos previos

- **Node.js 18.17+** y npm. (Angular 16 soporta oficialmente Node 18 y 20; este proyecto se ha
  instalado y compilado sin errores en **Node 26.12** con npm 11, que es lo que hay en este equipo.)
- Cuenta en **Cloudflare** (gratuita) → permite Workers y KV.
- Cuenta en **Vercel** (gratuita).
- Cuenta en **Resend** (gratuita: 100 correos/día, 3.000/mes) para el formulario.
- Opcional: un dominio propio (para el correo de Resend y para el Worker).

> **PowerShell y npm:** si al ejecutar `npm` ves *"la ejecución de scripts está deshabilitada en
> este sistema"*, es la política de ejecución de Windows bloqueando `npm.ps1`. Usa `npm.cmd` en su
> lugar (`npm.cmd install`) o ejecuta
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Instalación de dependencias (raíz del proyecto):

```bash
npm run install:all
# equivale a:  npm --prefix backend install && npm --prefix frontend install
```

> Si npm avisa de `install-scripts ... not yet covered by allowScripts` (esbuild, workerd, sharp)
> puedes ignorarlo: aquí se han probado `wrangler dev`, el typecheck y el build sin problema. Si
> quieres aprobarlos: `npm install-scripts approve workerd --prefix backend`.

---

## 3. Puesta en marcha en local

### 3.1 Backend (Cloudflare Worker)

```bash
cd backend
cp .dev.vars.example .dev.vars     # en Windows:  copy .dev.vars.example .dev.vars
npm install
npm run dev                        # -> http://localhost:8787
```

`.dev.vars` viene con `RESEND_DRY_RUN = "true"`: el formulario funciona de punta a punta pero el
correo **no se envía**, se imprime en la consola del Worker. Así puedes trabajar sin credenciales.

Comprueba que responde:

```bash
curl "http://localhost:8787/api/health"
curl "http://localhost:8787/api/bible?query=Juan%203:16"
```

> En PowerShell, `curl` es un alias de `Invoke-WebRequest`. Usa `curl.exe` o
> `Invoke-RestMethod "http://localhost:8787/api/bible?query=Juan 3:16"`.

### 3.2 Frontend (Angular)

```bash
cd frontend
npm install
npm run start                      # -> http://localhost:4200
```

`environment.ts` (desarrollo) apunta a `http://localhost:8787`, que debe estar en
`ALLOWED_ORIGINS` del Worker (ya viene configurado). Abre <http://localhost:4200>, busca
`Juan 3:16` y envía el formulario.

### 3.3 Probar la API de la Biblia localmente (paso a paso)

Ver también `backend/api.http` (extensión REST Client de VS Code: botón ▶ en cada petición).

| Prueba | Comando | Resultado esperado |
| --- | --- | --- |
| Versículo | `curl "http://localhost:8787/api/bible?query=Juan 3:16"` | `data.text` con el versículo, `data.version: "rvr1909"` |
| Rango | `curl "http://localhost:8787/api/bible?query=Romanos 8:28-30"` | `verse: 28, verseEnd: 30` |
| Capítulo | `curl "http://localhost:8787/api/bible?query=Salmos 23"` | `verses[]` con 6 elementos |
| Libro numerado | `curl "http://localhost:8787/api/bible?query=1 Corintios 13:4-7"` | 4 versículos |
| Caché | Repite la primera llamada | `meta.cached: true` y `data.cached: true` (si KV está activo) |
| Error 400 | `curl "http://localhost:8787/api/bible"` | `{"error":"Falta el parámetro `query`..."}` |
| Error 404 | `curl "http://localhost:8787/api/bible?query=Juan 3:99"` | `{"error":"Ese capítulo o versículo no existe...","code":"NOT_FOUND"}` |
| Error 400 | `curl "http://localhost:8787/api/bible?query=xyzzy"` | `code: "BAD_REQUEST"` con pista de formato |
| Versiones | `curl "http://localhost:8787/api/bible/versions"` | Lista con las de español primero |

Prueba del guardarraíl de versión (la razón por la que existe el proyecto tal como está):

```bash
# En backend/wrangler.toml pon temporalmente:  BIBLE_VERSION = "rvr1960"
curl "http://localhost:8787/api/bible?query=Juan 3:16"
# -> 400 { "error": "La versión \"rvr1960\" no existe en la API de la Biblia.",
#          "details": { "availableSpanish": [...], "hint": "La Reina-Valera 1960 no está disponible..." } }
```

Registros en vivo del Worker (también en local):

```bash
npm run tail        # wrangler tail
```

---

## 4. Obtener la API Key de Resend y configurarla en Cloudflare

### 4.1 Crear la API Key

1. Entra en <https://resend.com> y crea una cuenta.
2. **Domains → Add Domain**: añade tu dominio (ej. `jesusaguaviva.org`) y crea los registros DNS
   (SPF `TXT`, `DKIM`) que te indique Resend. Espera a que el estado sea **Verified**.
   - Atajo para probar: sin dominio verificado solo puedes enviar **a tu propio correo** usando
     `onboarding@resend.dev` como remitente.
3. **API Keys → Create API Key**: permisos *Sending access*, dominio seleccionado. Copia la clave
   (`re_...`). **Solo se muestra una vez.**

### 4.2 Guardar la clave como secreto del Worker

El secreto se cifra y **no** queda en el repositorio ni en `wrangler.toml`:

```bash
cd backend
npx wrangler login
npx wrangler secret put RESEND_API_KEY
# Pega la clave cuando la pida y pulsa Enter
```

Otras variables (no secretas, se editan en `wrangler.toml`):

```toml
[vars]
CONTACT_TO = "jesusaguaviva57@gmail.com"                        # buzón que recibe los mensajes
CONTACT_FROM = "Web Jesús Agua Viva <onboarding@resend.dev>"    # ver nota de abajo
```

> **Nunca** pongas la API Key en el frontend ni en `wrangler.toml`. El formato
> `<Nombre> <correo@dominio>` en `CONTACT_FROM` es obligatorio para Resend.
> **Sin dominio propio** (lo más rápido): deja `onboarding@resend.dev` como remitente.
> Con ese remitente Resend solo entrega en el correo con el que te registraste, así que
> funciona perfectamente mientras `CONTACT_TO` sea tu propia cuenta de Resend.
> Cuando tengas dominio propio: verifícalo en Resend y cambia el remitente, por ejemplo
> `CONTACT_FROM = "Web Jesús Agua Viva <no-reply@tudominio.org>"`.

Verifica la configuración (sin exponer secretos):

```bash
curl "https://TU-WORKER.workers.dev/api/health"
# email: { configured: true, dryRun: false, to: "je*******@gmail.com" }
```

---

## 5. Configurar el CORS del Worker (dominio de Vercel)

Todo el CORS vive en **una sola variable**: `ALLOWED_ORIGINS` en `backend/wrangler.toml`.
Admite varios orígenes separados por coma y comodines para los *preview deployments*.

```toml
[vars]
ALLOWED_ORIGINS = "http://localhost:4200,http://127.0.0.1:4200,https://jesusaguaviva.vercel.app,https://jesusaguaviva-*.vercel.app"
```

Puntos clave de la implementación (`backend/src/lib/cors.ts`):

- El Worker **refleja el `Origin` exacto** que coincide con la lista blanca; nunca responde `*`
  en producción (salvo que tú escribas `ALLOWED_ORIGINS="*"`, que no recomendamos).
- Responde el **preflight `OPTIONS`** con `204` y las cabeceras `Access-Control-Allow-*` antes de
  tocar Midvash, Resend o KV.
- Si el `Origin` no está permitido, responde `204` **sin** `Access-Control-Allow-Origin` → el
  navegador bloquea la petición (comportamiento correcto y seguro).
- Añade `Vary: Origin` para no envenenar cachés intermedias.
- Las **respuestas de error también llevan CORS**. Sin esto, un 400/500 llegaría al navegador como
  "network error" y el usuario no vería el mensaje.

Pasos:

1. Despliega el Worker (§6) y anota su URL.
2. Añade el dominio real de Vercel a `ALLOWED_ORIGINS` y vuelve a desplegar: `npx wrangler deploy`.
3. Prueba el preflight:

```bash
curl.exe -i -X OPTIONS "https://TU-WORKER.workers.dev/api/bible" ^
  -H "Origin: https://jesusaguaviva.vercel.app" ^
  -H "Access-Control-Request-Method: GET"
# Debe responder 204 con Access-Control-Allow-Origin: https://jesusaguaviva.vercel.app
```

> Tras cambiar `ALLOWED_ORIGINS` no hace falta purgar nada: se lee en cada petición.

---

## 6. Desplegar el backend en Cloudflare Workers

```bash
cd backend
npx wrangler login          # abre el navegador (una sola vez)

# 1) Secreto de Resend
npx wrangler secret put RESEND_API_KEY

# 2) Revisa wrangler.toml: BIBLE_VERSION, ALLOWED_ORIGINS, CONTACT_TO, CONTACT_FROM

# 3) Despliegue
npx wrangler deploy
```

La salida imprime la URL pública, por ejemplo
`https://jesusaguaviva-api.TU-SUBDOMINIO.workers.dev`. Cópiala: la necesitas en el frontend.

### 6.1 KV (opcional pero recomendado)

Activa la caché de versículos y el rate-limit del formulario:

```bash
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create CACHE --preview
```

Copia los `id` en `wrangler.toml` y descomenta el bloque:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "ID_DE_PRODUCCION"
preview_id = "ID_DE_PREVIEW"
```

Vuelve a desplegar. Si no lo configuras, la API funciona igual (sin caché ni rate-limit), el código
lo detecta con `if (!env.CACHE) return ...`.

### 6.2 Dominio propio (opcional)

```toml
[[routes]]
pattern = "api.jesusaguaviva.org"
custom_domain = true
```

### 6.3 Comandos de operación

```bash
npx wrangler deploy            # desplegar
npx wrangler dev               # local
npx wrangler tail              # logs en vivo de producción
npx wrangler secret list       # secretos configurados (solo nombres)
npx wrangler deployments list  # historial (permite rollback)
npm run typecheck              # tsc --noEmit (tipado estricto)
```

---

## 7. Desplegar el frontend en Vercel

### 7.1 Preparar la URL del Worker

Edita `frontend/src/environments/environment.production.ts`:

```ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://jesusaguaviva-api.TU-SUBDOMINIO.workers.dev',
  bibleVersionLabel: 'Reina-Valera 1909',
} as const;
```

Y el `preconnect` de `frontend/src/index.html` si usas dominio propio.

### 7.2 Compilar y verificar en local

```bash
cd frontend
npm run build            # usa la configuración "production" por defecto
# Salida: frontend/dist/frontend  (browser bundle + assets con hash)
npx http-server dist/frontend -p 4300   # opcional: comprobar el build real
```

El `outputPath` es `dist/frontend` (definido en `angular.json`) y `vercel.json` lo declara con
`"outputDirectory": "dist/frontend"`.

### 7.3 Desplegar en Vercel

**Opción A — Dashboard (recomendada la primera vez)**

1. <https://vercel.com/new> → *Import Git Repository* → selecciona el repo.
2. **Root Directory**: `frontend` (importante: es un monorepo).
3. *Framework Preset*: **Other** (no hace falta preset; lo dirige `vercel.json`).
4. *Build Command*: `npm run build` · *Output Directory*: `dist/frontend` (se leen de `vercel.json`).
5. *Environment Variables*: no hace falta ninguna (la URL del API va en `environment.production.ts`,
   que es información pública, no un secreto).
6. **Deploy**. Obtendrás `https://jesusaguaviva.vercel.app`.

**Opción B — CLI**

```bash
cd frontend
npx vercel login
npx vercel --prod
```

`vercel.json` ya incluye:

- `rewrites` de `/(.*)` → `/index.html`, para que las rutas del SPA (`/contacto`) funcionen al
  recargar la página.
- `Cache-Control: public, max-age=31536000, immutable` para los bundles con hash.
- Cabeceras de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`).

### 7.4 Cerrar el círculo (CORS)

1. Copia la URL de producción de Vercel.
2. Añádela a `ALLOWED_ORIGINS` en `backend/wrangler.toml`.
3. `cd backend && npx wrangler deploy`.
4. Abre la web desplegada y prueba el lector de Biblia y el formulario.

---

## 8. Contrato de la API

Base: `https://TU-WORKER.workers.dev`

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/` | Índice con los endpoints disponibles |
| GET | `/api/health` | Estado + configuración activa (sin secretos) |
| GET | `/api/bible?query=Juan 3:16` | Versículo, rango o capítulo completo |
| GET | `/api/bible/versions` | Versiones disponibles (español primero) |
| POST | `/api/contact` | Formulario de contacto → Resend |
| OPTIONS | `*` | Preflight CORS |

### Éxito

```json
{
  "data": {
    "reference": "John 3:16",
    "version": "rvr1909",
    "versionName": "Reina-Valera 1909",
    "book": "john",
    "bookName": "John",
    "chapter": 3,
    "verse": 16,
    "verseEnd": 16,
    "text": "Porque de tal manera amó Dios al mundo...",
    "verses": ["Porque de tal manera amó Dios al mundo..."],
    "copyright": "Reina-Valera 1909 (RVR1909)\nDominio público...",
    "cached": false,
    "versionMismatch": false
  },
  "meta": { "cached": false, "requestId": "4f2c9a1b" }
}
```

### Error (siempre el mismo formato)

```json
{
  "error": "Ese capítulo o versículo no existe. Verifica el número.",
  "code": "NOT_FOUND",
  "details": { "upstream": "Verse(s) out of range. John 3 has 36 verses.", "maxVerses": 36 },
  "requestId": "4f2c9a1b"
}
```

| Código HTTP | `code` | Cuándo |
| --- | --- | --- |
| 400 | `BAD_REQUEST` / `VALIDATION_ERROR` | Falta `query`, referencia inválida, campos del formulario mal, versión inexistente |
| 404 | `NOT_FOUND` | Libro, capítulo, versículo o ruta inexistente |
| 429 | `RATE_LIMITED` | Más de 5 envíos del formulario en 10 minutos (con KV o, sin KV, en memoria) |
| 502 | `UPSTREAM_ERROR` | Midvash o Resend no responden bien |
| 500 | `NOT_CONFIGURED` | Falta un secreto o una variable (`RESEND_API_KEY`, `CONTACT_FROM`...) |
| 500 | `INTERNAL_ERROR` | Bug inesperado (se registra con stack en los logs) |

### Formulario de contacto

`POST /api/contact` espera exactamente estos campos:

```json
{
  "name": "María Fernanda",
  "email": "maria@ejemplo.com",
  "subject": "Consulta sobre las reuniones de jóvenes",
  "message": "Hola, quiero saber más sobre las reuniones de jóvenes y pedir oración por mi familia.",
  "website": ""
}
```

- `subject` (título) se usa como **asunto** del correo y `message` como **cuerpo**.
- El correo se envía a `CONTACT_TO` con `reply_to` = el email de quien escribe, así que
  puedes responder directamente desde tu bandeja de entrada.
- `website` es un *honeypot*: debe ir **siempre vacío**. Si un bot lo rellena, el Worker
  responde un falso éxito (202) y no envía nada.
- No hay teléfono, WhatsApp ni SMS: **todo el contacto es por correo**.

---

## 9. Personalizar la web

**Un solo archivo:** `frontend/src/app/core/config/site.config.ts`.

```ts
export const SITE: SiteConfig = {
  name: 'Iglesia Jesús Agua Viva',
  tagline: 'Un lugar para encontrarte con Dios',
  contact: { address: 'C. José Palanca, Carretera de Cádiz', city: 'Málaga', country: 'España', email: 'jesusaguaviva57@gmail.com' },
  schedule: [ { title: 'Domingo', detail: 'Culto de adoración · 10:00 a.m.' } ],
  social: [ { label: 'Facebook', href: 'https://facebook.com/tu-pagina' } ],
};
```

- **Dirección y mapa**: cambia `MAPS_QUERY` (arriba del archivo). El mapa usa
  `google.com/maps?q=...&output=embed`, que **no requiere API Key de Google Maps** ni tarjeta.
- **Logo**: sustituye el SVG en `shared/components/logo.component.ts` y `public/favicon.svg`.
- **Colores**: `frontend/tailwind.config.js` → `theme.extend.colors.brand` (azules sobrios).
- **Legal de la Biblia**: el aviso de copyright que envía Midvash se muestra bajo cada pasaje.
  Manténlo visible: es una condición de uso de sus versiones con licencia.

---

## 10. Seguridad y buenas prácticas aplicadas

- **Secretos**: `RESEND_API_KEY` solo como *secret* de Cloudflare. `.dev.vars` está en `.gitignore`.
  El frontend jamás ve la clave.
- **CORS**: lista blanca explícita, sin `*` en producción, `Vary: Origin`, preflight correcto y
  CORS también en respuestas de error.
- **Validación doble**: cliente (UX) y servidor (`lib/validation.ts`). Topes de longitud, tipo
  `unknown` verificado, email por forma.
- **Anti-spam**: honeypot invisible (`website`) + rate-limit por IP en **dos capas**: KV (distribuido,
  si está configurado) y memoria del isolate (siempre activa, frena el abuso repetido aunque no
  tengas KV). Límite por defecto: 5 envíos cada 10 minutos.
- **Inyección HTML en el correo**: todo el contenido del usuario pasa por `escapeHtml()` antes de
  entrar en la plantilla HTML.
- **Idempotencia**: `Idempotency-Key` con el `requestId` al llamar a Resend → sin correos
  duplicados por doble clic o reintento.
- **Resiliencia**: timeout de 8 s + un reintento en Midvash, timeout de 10 s en Resend, mensajes de
  error en español listos para mostrar.
- **Tipado**: `strict` y `noUncheckedIndexedAccess` en el backend, `strict` + `strictTemplates` en
  el frontend.
- **Observabilidad**: log JSON por petición con `requestId` (cabecera `X-Request-Id`),
  `wrangler tail` y `[observability]` activado.
- **Integridad del dato bíblico**: validación de versión + `versionMismatch`, para no mostrar nunca
  un texto con la etiqueta equivocada.

---

## 11. Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| `Failed to fetch` / error de red en el frontend | El `Origin` no está en `ALLOWED_ORIGINS`, o el Worker no está desplegado. Comprueba `GET /api/health` y el preflight (§5). |
| `La versión "rvr1960" no existe` | Funcionamiento correcto: Midvash no tiene RVR1960. Usa `rvr1909` o `rvg` (§0). |
| El formulario devuelve 500 `NOT_CONFIGURED` | Falta `RESEND_API_KEY` (`wrangler secret put`) o `CONTACT_FROM`/`CONTACT_TO`. |
| Resend responde 403 | El dominio de `CONTACT_FROM` no está verificado en Resend. |
| El correo llega a spam | Verifica SPF/DKIM en Resend y usa un `CONTACT_FROM` del dominio verificado. |
| `cached` siempre `false` | KV no está configurado (bloque `[[kv_namespaces]]` comentado). El lector funciona igual, solo se repite la consulta a Midvash. |
| 429 al probar el formulario | Rate-limit: 5 envíos / 10 min (funciona también sin KV, en memoria). Espera, reinicia el Worker (`Ctrl+C` y `npm run dev`) o vacía la clave `rl:contact:*` en KV. |
| 404 al recargar `/contacto` en Vercel | Revisa que `vercel.json` esté en la raíz del proyecto (`frontend/`) y el *Root Directory* sea `frontend`. |
| Vercel rechaza `vercel.json` al desplegar | Alguna regla de `headers` no le gusta. Elimina la regla de caché por extensión (`"/(.*)\\.(js|css|...)"`) y deja solo las de seguridad; el SPA funcionará igual (perderás caché inmutable en los bundles). |
| `ng build` falla con `Node.js version` | Angular 16 necesita Node 18.10+ (y < 21). `node -v` debe dar 18.x o 20.x. |
| El Worker compila pero `tsc` se queja | Ejecuta `npm run typecheck` en `backend/` (necesita `@cloudflare/workers-types`). |

---

## 12. Comandos útiles (resumen)

```bash
# Monorepo
npm run install:all          # instalar dependencias de backend y frontend

# Backend (Cloudflare Workers)
cd backend
npm run dev                  # http://localhost:8787
npm run deploy               # wrangler deploy
npm run tail                 # logs en vivo
npm run typecheck            # tipado estricto
npx wrangler secret put RESEND_API_KEY

# Frontend (Angular)
cd frontend
npm run start                # http://localhost:4200
npm run build                # dist/frontend (producción, para Vercel)
npm run build:dev            # build sin optimizar (depuración)
npx vercel --prod            # despliegue por CLI
```

---

## 13. Siguientes pasos sugeridos

- Versículo del día en el hero usando `GET /api/bible?query=...` o añadiendo un endpoint que
  consuma `/v1/votd`.
- Acuse de recibo automático al usuario: segundo envío a `value.email` en `email.service.ts`.
- Suscripción a boletín con **Resend Audiences**.
- Analítica sin cookies (Plausible/Umami) y `sitemap.xml` para SEO.
- `GET /api/bible/passages` para pintar una lectura diaria de varios pasajes en una sola llamada
  (Midvash `/v1/passages` acepta hasta 50 referencias).
