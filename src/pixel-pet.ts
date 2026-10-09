import {LitElement, html, css, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import type {PetEventMap, PetEventName, PetManifest, PetStateDef, PixelPetEventMap, SetStateOptions} from './types';

const DEFAULT_MAP: Required<Pick<PetEventMap, PetEventName>> = {
  typing: 'listening',
  send: 'thinking',
  retrieving: 'searching',
  score: 'idea',
  token: 'talking',
  cite: 'cite',
  done: 'idle',
  error: ['error', {now: true}],
  deny: ['angry', {now: true}],
  greet: 'greet',
  bye: 'bye',
  yes: 'nod',
  no: 'shake',
  surprise: 'surprised',
  happy: 'happy',
  sad: 'sad',
  eat: 'eating',
  idle: 'idle',
};

/**
 * `<pixel-pet>` — mascota pixel art animada con CSS `steps()`.
 *
 * @attr src - URL del manifiesto JSON
 * @attr lang - idioma de las etiquetas accesibles (por defecto el de la página)
 * @attr state - estado actual (cambiarlo hace una transición "educada")
 * @attr scale - escala entera (1, 2, 3…)
 * @attr speed - multiplicador de velocidad
 * @attr paused - pausa la animación
 * @attr sleep-after - segundos de inactividad antes de pasar a `sleeping`
 * @attr force-motion - ignora `prefers-reduced-motion`
 * @fires ready - hoja cargada y estado inicial aplicado
 * @fires statechange - `detail: {from, to}`
 * @fires stateend - terminó un estado no loop, `detail: {state}`
 * @csspart sprite - el elemento que dibuja la mascota
 */
export class PixelPet extends LitElement {
  static properties = {
    // `state` tiene accesores propios, por eso se declara aquí y no con @property
    state: {type: String, reflect: true, noAccessor: true},
  };

  static styles = css`
    :host {
      display: inline-block;
      line-height: 0;
    }
    .sprite {
      background-repeat: no-repeat;
      image-rendering: pixelated;
    }
    @keyframes pet-a {
      from {
        background-position-x: 0;
      }
      to {
        background-position-x: var(--end, 0);
      }
    }
    @keyframes pet-b {
      from {
        background-position-x: 0;
      }
      to {
        background-position-x: var(--end, 0);
      }
    }
  `;

  @property({type: String}) src?: string;
  @property({type: Number}) scale = 1;
  @property({type: Number}) speed = 1;
  @property({type: Boolean, reflect: true}) paused = false;
  @property({type: Number, attribute: 'sleep-after'}) sleepAfter = 0;
  @property({type: Boolean, attribute: 'force-motion'}) forceMotion = false;
  @property({attribute: false}) manifest: PetManifest | null = null;

  /** Sobrescribe el mapa evento → estado de `feed()`. */
  map: PetEventMap = {};
  /** Umbrales del evento `score`: ≥ hi → idea, < lo → confused. */
  thresholds = {hi: 0.7, lo: 0.4};

  @state() private _ready = false;
  @state() private _gen = 0;
  @state() private _held = false;

  private _m: PetManifest | null = null;
  private _url = '';
  private _state: string | null = null;
  private _initState: string | null = null;
  private _pending: string | null = null;
  private _queue: string[] = [];
  private _timers: {pend?: number; sleep?: number; talk?: number} = {};

  /** Estado actual. Asignarlo equivale a `setState(v)`. */
  get state(): string | null {
    return this._state;
  }
  set state(v: string | null) {
    if (!v) return;
    if (!this._ready) {
      this._initState = v;
      return;
    }
    this.setState(v);
  }

  /** Elige el texto según el idioma: `lang` del elemento, de un ancestro, de la página o del navegador. */
  private _text(v: string | Record<string, string> | undefined, fallback: string): string {
    if (!v) return fallback;
    if (typeof v === 'string') return v;
    const lang = (
      this.lang ||
      this.closest('[lang]')?.getAttribute('lang') ||
      document.documentElement.lang ||
      navigator.language ||
      'en'
    ).toLowerCase();
    return v[lang] ?? v[lang.split('-')[0]!] ?? v['en'] ?? Object.values(v)[0] ?? fallback;
  }

  private get _still(): boolean {
    return (
      !this.forceMotion &&
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    Object.values(this._timers).forEach((t) => clearTimeout(t));
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('src') && this.src) void this._load(this.src);
    if (changed.has('manifest') && this.manifest && this.manifest !== this._m) this._setManifest(this.manifest);
    if (changed.has('sleepAfter')) this._touch();
    if (this._ready && (changed.has('scale') || changed.has('speed'))) this._gen++;
  }

  /* ---------- carga ---------- */
  private async _load(url: string): Promise<void> {
    try {
      const m = (await (await fetch(url)).json()) as PetManifest;
      m._base = new URL(url, document.baseURI).href;
      this.manifest = m;
    } catch (e) {
      console.error('[pixel-pet] no se pudo cargar el manifiesto', e);
    }
  }

  private _setManifest(m: PetManifest): void {
    this._m = m;
    this._ready = false;
    const img = new Image();
    img.onload = () => {
      this._ready = true;
      this._enter(this._initState ?? (m.states['idle'] ? 'idle' : Object.keys(m.states)[0]!));
      this.dispatchEvent(new CustomEvent('ready'));
    };
    img.onerror = () => console.error('[pixel-pet] no se pudo cargar la hoja', m.sheet);
    img.src = this._url = new URL(m.sheet, m._base ?? document.baseURI).href;
  }

  /* ---------- render ---------- */
  protected override render(): TemplateResult {
    const m = this._m;
    const st: PetStateDef | undefined = m && this._state ? m.states[this._state] : undefined;
    if (!m || !this._ready || !st) {
      return html`<div class="sprite" part="sprite" role="img" aria-label="Cargando"></div>`;
    }
    const {w, h} = m.frame,
      s = this.scale;
    const rows = m.rows ?? Math.max(...Object.values(m.states).map((x) => x.row)) + 1;
    const style = {
      width: `${w * s}px`,
      height: `${h * s}px`,
      'background-image': `url("${this._url}")`,
      'background-size': `${(m.cols ?? 8) * w * s}px ${rows * h * s}px`,
      'background-position-y': `${-st.row * h * s}px`,
      'background-position-x': this._held ? `${-(st.frames - 1) * w * s}px` : '0px',
      '--end': `${-st.frames * w * s}px`,
      animation:
        this._still || this._held
          ? 'none'
          : `pet-${this._gen % 2 ? 'a' : 'b'} ${st.dur / this.speed}s steps(${st.frames}) ` +
            `${st.loop === false ? '1' : 'infinite'} ${this.paused ? 'paused' : 'running'}`,
    };
    return html`<div
      class="sprite"
      part="sprite"
      role="img"
      aria-label=${this._text(m.name, 'Pet') + ': ' + this._text(st.label, this._state ?? '')}
      style=${styleMap(style)}
      @animationiteration=${this._onIteration}
      @animationend=${this._onEnd}
    ></div>`;
  }

  /* ---------- transiciones ---------- */
  private _enter(name: string): void {
    const from = this._state;
    this._state = name;
    this._pending = null;
    this._held = false;
    this._gen++;
    clearTimeout(this._timers.pend);
    this.requestUpdate('state', from);
    if (from !== name) this.dispatchEvent(new CustomEvent('statechange', {detail: {from, to: name}}));
  }

  private _onIteration = (): void => {
    if (this._pending) this._enter(this._pending);
    else if (this._queue.length) this._enter(this._queue.shift()!);
  };

  private _onEnd = (): void => {
    if (!this._m || !this._state) return;
    const st = this._m.states[this._state];
    this.dispatchEvent(new CustomEvent('stateend', {detail: {state: this._state}}));
    const next = this._pending ?? this._queue.shift() ?? st?.next;
    if (next && this._m.states[next]) this._enter(next);
    else this._held = true;
  };

  /* ---------- API ---------- */
  /** Cambia de estado. Por defecto espera a que termine el ciclo actual. */
  setState(name: string, {now = false}: SetStateOptions = {}): void {
    if (!this._ready || !this._m || !this._m.states[name]) {
      if (this._ready) console.warn('[pixel-pet] estado desconocido:', name);
      return;
    }
    this._touch();
    if (name === this._state) {
      this._pending = null;
      return;
    }
    if (now || !this._state || this._still) {
      this._enter(name);
      return;
    }
    this._pending = name;
    clearTimeout(this._timers.pend);
    const cur = this._m.states[this._state]!;
    this._timers.pend = window.setTimeout(
      () => {
        if (this._pending === name) this._enter(name);
      },
      ((cur.dur * 1000) / this.speed) * 1.3 + 80
    );
  }

  /** Encola estados que se reproducen uno tras otro. */
  queue(list: string[]): void {
    this._queue = list.filter((n) => !!this._m?.states[n]);
  }
  pause(): void {
    this.paused = true;
  }
  play(): void {
    this.paused = false;
  }

  /**
   * Traduce un evento del chat a un estado.
   * `feed('score', 0.9)` → idea · `feed('done', {cited: true})` → cita.
   * Si la mascota duerme, primero despierta.
   */
  feed(evt: PetEventName | (string & {}), data?: unknown): void {
    if (!this._ready) return;
    let target: string | undefined;
    let opts: SetStateOptions = {};
    if (evt === 'score') {
      const v = Number(data);
      target = v >= this.thresholds.hi ? 'idea' : v < this.thresholds.lo ? 'confused' : 'thinking';
    } else {
      const entry = ({...DEFAULT_MAP, ...this.map} as PetEventMap)[evt];
      if (Array.isArray(entry)) [target, opts] = entry;
      else target = entry;
    }
    if (!target) return;
    clearTimeout(this._timers.talk);
    if (evt === 'token') this._timers.talk = window.setTimeout(() => this.setState('idle'), 1200);
    if (evt === 'done' && (data as {cited?: boolean} | undefined)?.cited) target = 'cite';
    if (this._state === 'sleeping' && target !== 'sleeping') {
      this._enter('waking');
      this._queue = [target];
      this._touch();
    } else this.setState(target, opts);
  }

  private _touch(): void {
    clearTimeout(this._timers.sleep);
    if (this.sleepAfter > 0 && this._ready && this._state !== 'sleeping') {
      this._timers.sleep = window.setTimeout(() => this.setState('sleeping'), this.sleepAfter * 1000);
    }
  }
}

/* addEventListener tipado para los eventos propios */
export interface PixelPet {
  addEventListener<K extends keyof PixelPetEventMap>(
    type: K,
    listener: (this: PixelPet, ev: PixelPetEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'pixel-pet': PixelPet;
  }
}

/** Registra el tag. Úsalo con otro nombre si choca: `definePixelPet('mi-mascota')`. */
export function definePixelPet(tag = 'pixel-pet'): void {
  if (!customElements.get(tag)) customElements.define(tag, PixelPet);
}
