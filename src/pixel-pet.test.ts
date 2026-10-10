import {describe, it, expect, beforeAll, afterEach, vi} from 'vitest';
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
    happy: {row: 10, frames: 4, dur: 1, loop: false, next: 'idle'},
    greet: {row: 11, frames: 4, dur: 1, loop: false, next: 'idle'},
    sleeping: {row: 12, frames: 4, dur: 1},
    waking: {row: 13, frames: 4, dur: 1, loop: false, next: 'idle'},
  },
};

beforeAll(() => {
  definePixelPet();
});

afterEach(() => {
  vi.useRealTimers();
});

function createReadyPet(): PixelPet {
  const el = document.createElement('pixel-pet') as PixelPet;
  const internal = el as unknown as {_m: unknown; _ready: boolean; _enter(name: string): void};
  internal._m = manifest;
  internal._ready = true;
  internal._enter('idle');
  return el;
}

function endCycle(pet: PixelPet): void {
  (pet as unknown as {_onEnd(): void})._onEnd();
}

function iterateCycle(pet: PixelPet): void {
  (pet as unknown as {_onIteration(): void})._onIteration();
}

function touch(pet: PixelPet): void {
  (pet as unknown as {_touch(): void})._touch();
}

describe('definePixelPet', () => {
  it('registers the custom element', () => {
    expect(customElements.get('pixel-pet')).toBeDefined();
  });

  it('does not throw when called again', () => {
    expect(() => definePixelPet()).not.toThrow();
  });
});

describe('setState()', () => {
  it('changes immediately with now:true', () => {
    const pet = createReadyPet();
    pet.setState('happy', {now: true});
    expect(pet.state).toBe('happy');
  });

  it('defers the change until the cycle iterates', () => {
    const pet = createReadyPet();
    pet.setState('listening');
    expect(pet.state).toBe('idle');
    iterateCycle(pet);
    expect(pet.state).toBe('listening');
  });

  it('applies the pending state after the fallback timer', () => {
    vi.useFakeTimers();
    const pet = createReadyPet();
    pet.setState('listening');
    vi.advanceTimersByTime(2000);
    expect(pet.state).toBe('listening');
  });

  it('ignores unknown states', () => {
    const pet = createReadyPet();
    pet.setState('does-not-exist', {now: true});
    expect(pet.state).toBe('idle');
  });

  it('emits statechange with from and to', () => {
    const pet = createReadyPet();
    const handler = vi.fn();
    pet.addEventListener('statechange', handler);
    pet.setState('happy', {now: true});
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].detail).toEqual({from: 'idle', to: 'happy'});
  });

  it('does not emit statechange when the state does not change', () => {
    const pet = createReadyPet();
    const handler = vi.fn();
    pet.addEventListener('statechange', handler);
    pet.setState('idle', {now: true});
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('queue()', () => {
  it('plays queued states one after another on each cycle', () => {
    const pet = createReadyPet();
    pet.queue(['listening', 'thinking']);
    iterateCycle(pet);
    expect(pet.state).toBe('listening');
    iterateCycle(pet);
    expect(pet.state).toBe('thinking');
  });

  it('drops unknown states from the queue', () => {
    const pet = createReadyPet();
    pet.queue(['nope', 'happy']);
    iterateCycle(pet);
    expect(pet.state).toBe('happy');
  });
});

describe('stateend and non-loop states', () => {
  it('emits stateend when a non-loop state finishes', () => {
    const pet = createReadyPet();
    const handler = vi.fn();
    pet.addEventListener('stateend', handler);
    pet.setState('happy', {now: true});
    endCycle(pet);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].detail).toEqual({state: 'happy'});
  });

  it('returns to next state when a non-loop state finishes', () => {
    const pet = createReadyPet();
    pet.setState('happy', {now: true});
    endCycle(pet);
    expect(pet.state).toBe('idle');
  });
});

describe('feed() mapping', () => {
  it('maps score to idea or confused by thresholds', () => {
    vi.useFakeTimers();
    const pet = createReadyPet();
    pet.feed('score', 0.9);
    vi.advanceTimersByTime(2000);
    expect(pet.state).toBe('idea');
    pet.feed('score', 0.1);
    vi.advanceTimersByTime(2000);
    expect(pet.state).toBe('confused');
  });

  it('maps score between thresholds to thinking', () => {
    vi.useFakeTimers();
    const pet = createReadyPet();
    pet.feed('score', 0.5);
    vi.advanceTimersByTime(2000);
    expect(pet.state).toBe('thinking');
  });

  it('ignores events that are not mapped', () => {
    const pet = createReadyPet();
    pet.feed('unknown-event');
    expect(pet.state).toBe('idle');
  });

  it('uses the custom map when provided', () => {
    const pet = createReadyPet();
    pet.map = {happy: ['angry', {now: true}]};
    pet.feed('happy');
    expect(pet.state).toBe('angry');
  });

  it('switches to cite when done has cited:true', () => {
    vi.useFakeTimers();
    const pet = createReadyPet();
    pet.feed('done', {cited: true});
    vi.advanceTimersByTime(2000);
    expect(pet.state).toBe('cite');
  });

  it('applies error immediately', () => {
    const pet = createReadyPet();
    pet.feed('error');
    expect(pet.state).toBe('error');
  });

  it('shows talking immediately on token and returns to idle when tokens stop', () => {
    vi.useFakeTimers();
    const pet = createReadyPet();
    pet.feed('token');
    expect(pet.state).toBe('talking');
    vi.advanceTimersByTime(1200 + 1380);
    expect(pet.state).toBe('idle');
  });

  it('wakes a sleeping pet and plays the event after the waking cycle', () => {
    const pet = createReadyPet();
    pet.setState('sleeping', {now: true});
    pet.feed('greet');
    expect(pet.state).toBe('waking');
    endCycle(pet);
    expect(pet.state).toBe('greet');
    endCycle(pet);
    expect(pet.state).toBe('idle');
  });
});

describe('sleep-after', () => {
  it('goes to sleeping after the configured inactivity', () => {
    vi.useFakeTimers();
    const pet = createReadyPet();
    pet.sleepAfter = 30;
    touch(pet);
    vi.advanceTimersByTime(29_000);
    expect(pet.state).toBe('idle');
    vi.advanceTimersByTime(3_000);
    expect(pet.state).toBe('sleeping');
  });

  it('does not sleep when sleep-after is 0', () => {
    vi.useFakeTimers();
    const pet = createReadyPet();
    touch(pet);
    vi.advanceTimersByTime(60_000);
    expect(pet.state).toBe('idle');
  });
});

describe('pause() and play()', () => {
  it('toggles the paused property', () => {
    const pet = createReadyPet();
    pet.pause();
    expect(pet.paused).toBe(true);
    pet.play();
    expect(pet.paused).toBe(false);
  });
});
