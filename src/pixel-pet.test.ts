import {describe, it, expect, beforeAll, vi} from 'vitest';
import {definePixelPet} from './pixel-pet';
import type {PixelPet} from './pixel-pet';

const manifest = {
  sheet: 'data:image/png;base64,iVBORw0KGgo=',
  frame: {w: 10, h: 10},
  cols: 4,
  states: {
    idle: {row: 0, frames: 4, dur: 1},
    listening: {row: 1, frames: 4, dur: 1},
    thinking: {row: 2, frames: 4, dur: 1},
    searching: {row: 3, frames: 4, dur: 1},
    idea: {row: 4, frames: 4, dur: 1},
    confused: {row: 5, frames: 4, dur: 1},
    talking: {row: 6, frames: 4, dur: 1},
    cite: {row: 7, frames: 4, dur: 1},
    error: {row: 8, frames: 4, dur: 1, loop: false, next: 'idle'},
    angry: {row: 9, frames: 4, dur: 1, loop: false, next: 'idle'},
  },
};

beforeAll(() => {
  definePixelPet();
});

function createReadyPet(): PixelPet {
  const el = document.createElement('pixel-pet') as PixelPet;
  const internal = el as unknown as {_m: unknown; _ready: boolean; _enter(name: string): void};
  internal._m = manifest;
  internal._ready = true;
  internal._enter('idle');
  return el;
}

describe('definePixelPet', () => {
  it('registers the custom element once', () => {
    expect(customElements.get('pixel-pet')).toBeDefined();
    expect(() => definePixelPet()).not.toThrow();
  });
});

describe('feed() mapping', () => {
  it('maps score to idea or confused by thresholds', () => {
    vi.useFakeTimers();
    try {
      const pet = createReadyPet();
      pet.feed('score', 0.9);
      vi.advanceTimersByTime(2000);
      expect(pet.state).toBe('idea');
      pet.feed('score', 0.1);
      vi.advanceTimersByTime(2000);
      expect(pet.state).toBe('confused');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores events that are not mapped', () => {
    const pet = createReadyPet();
    pet.feed('unknown-event');
    expect(pet.state).toBe('idle');
  });
});
