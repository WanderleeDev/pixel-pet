# pixel-pet

Web component (**Lit + TypeScript**) que anima una mascota pixel art con **CSS `steps()`** a partir de **una hoja de sprites + un manifiesto JSON**. Pensado para dar vida a asistentes y chats (por ejemplo con RAG): traduce eventos del chat (`typing`, `send`, `retrieving`, `score`, `token`, `done`…) a estados de la mascota.

- Una sola hoja por mascota (1 petición, cacheable) y cualquier cantidad de frames por estado.
- **Agnóstico del idioma:** ni los sprites ni los ids de estado llevan texto en un idioma; las etiquetas accesibles son traducibles.
- Funciona en cualquier framework. Respeta `prefers-reduced-motion`.
- Incluye dos mascotas de ejemplo: `cat` y `elegant-cat` (con monóculo).

> **Arte de ejemplo:** `assets/cat.png` y `assets/elegant-cat.png` solo sirven para probar el motor; sus derechos de redistribución no están claros. Lee `assets/NOTICE.md` y reemplázalos antes de publicar.

## Instalación

```bash
bun add @wanderleedev/pixel-pet lit      # o: npm i @wanderleedev/pixel-pet lit
```

```js
import '@wanderleedev/pixel-pet/define';   // registra <pixel-pet>
```

```html
<pixel-pet src="/assets/cat.json" scale="2" sleep-after="30" lang="en"></pixel-pet>
```

Sin bundler: `<script src="pixel-pet.bundle.js"></script>`. Para otro nombre de tag: `definePixelPet('mi-mascota')`.

### TypeScript

```ts
import '@wanderleedev/pixel-pet/define';
import type {PetManifest} from '@wanderleedev/pixel-pet';

const pet = document.querySelector('pixel-pet')!;     // tipado como PixelPet
pet.addEventListener('statechange', e => console.log(e.detail.from, e.detail.to));
pet.feed('score', 0.92);
```

### Uso mínimo con un chat

```html
<input id="msg" placeholder="Escribe una pregunta">
<button id="send">Enviar</button>
<pixel-pet id="pet" src="/assets/cat.json" sleep-after="30"></pixel-pet>
<script type="module">
  import '@wanderleedev/pixel-pet/define';
  const pet = document.querySelector('#pet');
  const msg = document.querySelector('#msg');
  msg.addEventListener('input', () => pet.feed('typing'));
  document.querySelector('#send').addEventListener('click', () => {
    pet.feed('send');
    pet.feed('retrieving');
    pet.feed('score', 0.9);
    // Por cada fragmento de respuesta que llega del modelo:
    pet.feed('token');
    // Al terminar; cited:true si la respuesta cita una fuente:
    pet.feed('done', {cited: true});
  });
</script>
```

Para ver el resto de eventos y estados, ejecuta `bun run demo` en el repositorio.

## Estados incluidos

Cada mascota trae 20 estados de 12 frames. Los ids son neutros; el texto visible sale de `label`.

| Id | Cuándo usarlo en un chat |
|---|---|
| `idle` | Reposo entre mensajes |
| `listening` | El usuario está escribiendo |
| `thinking` | Mensaje enviado, esperando el primer token |
| `searching` | Retrieval en curso (la lupa pasa por los ojos) |
| `idea` | Retrieval con score alto |
| `confused` | Sin resultados o score bajo (no inventar) |
| `talking` | Respuesta llegando en streaming |
| `cite` | La respuesta cita una fuente |
| `nod` / `shake` | Sí / no cortos (✓ / ✗) |
| `greet` / `bye` | Inicio / cierre de la conversación |
| `happy` · `sad` · `angry` · `surprised` | Emociones |
| `error` | Fallo de red o del modelo |
| `eating` | Cargas largas, indexando documentos |
| `sleeping` / `waking` | Inactividad / vuelta de la inactividad |

## El manifiesto

```json
{
  "name": { "es": "Gato", "en": "Cat" },
  "sheet": "cat.png",
  "frame": { "w": 186, "h": 231 },
  "cols": 12,
  "states": {
    "idle":  { "row": 4,  "frames": 12, "dur": 3.6, "label": { "es": "En reposo", "en": "Idle" } },
    "greet": { "row": 17, "frames": 12, "dur": 2.4, "loop": false, "next": "idle", "label": "Hello" }
  }
}
```

| Campo | Qué es |
|---|---|
| `sheet` | Imagen, relativa al manifiesto (o data URI) |
| `frame` | Tamaño de un frame en px |
| `cols` | Frames de la fila más larga (ancho de la hoja = `cols × frame.w`) |
| `states.<id>.row` / `frames` / `dur` | Fila, frames dibujados (debe coincidir con la hoja) y duración del ciclo en segundos |
| `loop` / `next` | `loop:false` = una pasada; `next` = estado al terminar |
| `label`, `name` | Texto accesible: un string, o `{es, en, …}` |

**Idioma de las etiquetas:** se elige con el atributo `lang` del elemento, de un ancestro, de `<html lang>` o del navegador (con fallback a `en`).

## API

**Atributos / propiedades:** `src` · `state` · `scale` · `speed` · `paused` · `sleep-after` (s) · `force-motion` · `lang` · `manifest` (objeto, alternativa a `src`) · `map` · `thresholds` (`{hi, lo}`).

**Métodos:** `setState(id, {now})` · `queue([...])` · `feed(evento, datos)` · `pause()` · `play()`.

**Eventos:** `ready` · `statechange` (`{from, to}`) · `stateend` (`{state}`).

Los cambios de estado esperan a que termine el ciclo actual; usa `{now:true}` para forzarlos.

### `feed()` y el mapa de eventos

| Evento | Estado |
|---|---|
| `typing` · `send` · `retrieving` | `listening` · `thinking` · `searching` |
| `score` (número) | `idea` si ≥ `thresholds.hi`, `confused` si < `thresholds.lo` |
| `token` | `talking` (vuelve a `idle` si dejan de llegar) |
| `done` | `idle` (con `{cited:true}` → `cite`) |
| `error` · `deny` | `error` · `angry` (inmediatos) |
| `greet` `bye` `yes` `no` `surprise` `happy` `sad` `eat` | `greet` `bye` `nod` `shake` `surprised` `happy` `sad` `eating` |

Si duerme, `feed()` la despierta primero. Puedes cambiar el mapa: `pet.map = { token: 'talking', done: ['happy', {now: true}] }`. Si tu mascota usa otros ids, mapea los eventos a ellos.

## Frameworks

- **Vue:** `compilerOptions.isCustomElement = tag => tag === 'pixel-pet'` · **Angular:** `CUSTOM_ELEMENTS_SCHEMA` · **Svelte:** directo.
- **React 19:** directo. **React 18:** `@lit/react` (`createComponent`).
- **SSR (Next/Nuxt):** solo cliente; impórtalo dentro de un efecto o con carga dinámica.

## Desarrollo

Creado con `bun create vite@latest pixel-pet --template lit-ts` y adaptado a librería.

```bash
bun install
bun dev             # demo en http://localhost:5173/
bun run typecheck   # tsc --noEmit (modo estricto)
bun run build       # dist/: ESM + .d.ts + bundle sin dependencias
npm pack --dry-run  # qué se publicaría
```

`src/pixel-pet.ts` (componente) · `src/types.ts` · `src/define.ts` (registra el tag) · `src/index.ts` (exports) · `vite.config.ts` (ESM) · `vite.bundle.config.ts` (IIFE).

## Publicar

```bash
bun run release-it         # versión estable: valida, crea el tag vX.Y.Z y publica
bun run release-it-next    # prerelease: publica con el dist-tag `next`
```

El workflow de GitHub publica en npm al detectar el tag, después de pasar lint, formato, typecheck, tests y build. Necesita el secreto `NPM_TOKEN` en el repositorio.

## Licencia

Código: MIT. El arte de `assets/` no está cubierto (ver `assets/NOTICE.md`).
