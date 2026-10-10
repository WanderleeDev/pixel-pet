import {definePixelPet} from '../src/pixel-pet.ts';

definePixelPet();

/* resaltado ligero sin dependencias: una sola pasada para no romper spans anidados */
const TOKEN =
  /(?<com>\/\/[^\n]*|<!--[\s\S]*?-->)|(?<str>'[^'\n]*'|"[^"\n]*"|`[^`]*`)|(?<lt><\/?)(?<tag>[a-zA-Z][\w-]*)|(?<attr>[a-zA-Z@:#][\w:-]*)(?==)|(?<kw>\b(?:import|from|export|const|let|function|return|new|class|extends|default|await|async|null|true|false|type|interface)\b)|(?<fn>\b(?:feed|setState|querySelector|addEventListener|useRef|useTemplateRef|viewChild)\b)/g;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (cls: string, s: string): string => `<span class="${cls}">${esc(s)}</span>`;
const highlight = (src: string): string => {
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src))) {
    const g = m.groups ?? {};
    out += esc(src.slice(last, m.index));
    last = m.index + m[0].length;
    if (g['com']) out += span('tok-com', g['com'] as string);
    else if (g['str']) out += span('tok-str', g['str'] as string);
    else if (g['tag']) out += esc(g['lt'] as string) + span('tok-tag', g['tag'] as string);
    else if (g['attr']) out += span('tok-attr', g['attr'] as string);
    else if (g['kw']) out += span('tok-kw', g['kw'] as string);
    else if (g['fn']) out += span('tok-fn', g['fn'] as string);
  }
  return out + esc(src.slice(last));
};
document.querySelectorAll('.panel').forEach((p) => {
  const code = p.querySelector('code');
  const area = p.querySelector('textarea');
  if (code && area instanceof HTMLTextAreaElement) code.innerHTML = highlight(area.value);
});

const $ = (s: string): HTMLElement => document.querySelector(s) as HTMLElement;
type Pet = import('../src/pixel-pet.ts').PixelPet;
const pet = $('#pet') as unknown as Pet;
const log = $('#log');
const lines: string[] = [];
const showLabel = async (): Promise<void> => {
  await pet.updateComplete;
  $('#lbl').textContent = pet.shadowRoot?.querySelector('.sprite')?.getAttribute('aria-label') ?? '';
};
pet.addEventListener('statechange', (e) => {
  lines.push(`${e.detail.from ?? '·'} → ${e.detail.to}`);
  if (lines.length > 6) lines.shift();
  log.textContent = lines.join('\n');
  void showLabel();
});
pet.addEventListener('ready', () => {
  pet.setState('greet', {now: true});
  $('#states').replaceChildren(
    ...Object.keys(pet.manifest?.states ?? {}).map((n) => {
      const b = document.createElement('button');
      b.textContent = n;
      b.onclick = () => pet.setState(n, {now: true});
      return b;
    })
  );
});

/* selectores accesibles */
const dropdown = (root: HTMLElement, onChange: (v: string) => void): void => {
  const btn = root.querySelector('.dd-btn') as HTMLButtonElement;
  const list = root.querySelector('.dd-list') as HTMLElement;
  const opts = [...list.querySelectorAll('[role=option]')] as HTMLElement[];
  const close = (): void => {
    root.dataset['open'] = 'false';
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.onclick = () => {
    const open = root.dataset['open'] !== 'true';
    root.dataset['open'] = String(open);
    btn.setAttribute('aria-expanded', String(open));
  };
  opts.forEach((o) => {
    o.onclick = () => {
      opts.forEach((x) => x.setAttribute('aria-selected', String(x === o)));
      const label = root.querySelector('.dd-label');
      if (label) label.textContent = o.textContent;
      close();
      if (o.dataset['value']) onChange(o.dataset['value']);
    };
  });
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target as Node)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
};
dropdown($('#dd-pack'), (v) => {
  pet.src = `./${v}.json`;
});
dropdown($('#dd-lang'), (v) => {
  pet.lang = v;
  pet.requestUpdate();
  void showLabel();
});

const at = (ms: number, fn: () => void): void => {
  window.setTimeout(fn, ms);
};
const tokens = (n: number, done: () => void): void => {
  let i = 0;
  const t = window.setInterval(() => {
    pet.feed('token');
    if (++i >= n) {
      window.clearInterval(t);
      done();
    }
  }, 150);
};
document.querySelectorAll('[data-flow]').forEach((b) => {
  (b as HTMLElement).onclick = () => {
    const f = (b as HTMLElement).dataset['flow'];
    pet.feed('send');
    at(1000, () => pet.feed('retrieving'));
    if (f === 'error') {
      at(2600, () => pet.feed('error'));
      at(4600, () => pet.feed('done'));
      return;
    }
    at(2800, () => pet.feed('score', f === 'docs' ? 0.92 : 0.2));
    at(4400, () => tokens(12, () => pet.feed('done', {cited: f === 'docs'})));
  };
});

const tabs = document.querySelectorAll('.tab');
tabs.forEach((t) => {
  (t as HTMLElement).onclick = () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    document.querySelectorAll('.panel').forEach((p) => {
      (p as HTMLElement).hidden = p.id !== t.getAttribute('aria-controls');
    });
  };
});
