/** Definición de un estado (una fila de la hoja de sprites). */
export interface PetStateDef {
  /** Fila de la hoja (0 = arriba). */
  row: number;
  /** Frames dibujados en esa fila. Debe coincidir con la hoja. */
  frames: number;
  /** Duración total del ciclo, en segundos. */
  dur: number;
  /** Texto accesible: un string o `{es:'…', en:'…'}` (se elige por idioma). */
  label?: string | Record<string, string>;
  /** `false` = una sola pasada (por defecto `true`). */
  loop?: boolean;
  /** Estado al que pasa al terminar un estado no loop. */
  next?: string;
}

export interface PetManifest {
  /** Nombre de la mascota (aria-label): string o `{es, en}`. */
  name?: string | Record<string, string>;
  /** Imagen de la hoja, relativa al manifiesto (o data URI). */
  sheet: string;
  /** Tamaño de un frame en px. */
  frame: {w: number; h: number};
  /** Frames de la fila más larga. */
  cols?: number;
  /** Número de filas (se deduce de los estados si falta). */
  rows?: number;
  states: Record<string, PetStateDef>;
  /** @internal URL del manifiesto, la rellena el componente. */
  _base?: string;
}

export type PetEventName =
  | 'typing'
  | 'send'
  | 'retrieving'
  | 'score'
  | 'token'
  | 'cite'
  | 'done'
  | 'error'
  | 'deny'
  | 'greet'
  | 'bye'
  | 'yes'
  | 'no'
  | 'surprise'
  | 'happy'
  | 'sad'
  | 'eat'
  | 'idle';

export interface SetStateOptions {
  /** Cambia ya, sin esperar a que termine el ciclo actual. */
  now?: boolean;
}

/** Evento → estado, o `[estado, opciones]`. */
export type PetEventMap = Partial<Record<PetEventName | (string & {}), string | [string, SetStateOptions]>>;

export interface PetStateChangeDetail {
  from: string | null;
  to: string;
}
export interface PetStateEndDetail {
  state: string;
}

export interface PixelPetEventMap {
  ready: CustomEvent<void>;
  statechange: CustomEvent<PetStateChangeDetail>;
  stateend: CustomEvent<PetStateEndDetail>;
}
