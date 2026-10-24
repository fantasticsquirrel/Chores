/** The only output accepted from package code. No URLs, HTML, SVG paths or props. */
export type Shape = {
  kind: "circle" | "rect" | "line" | "text";
  x: number;
  y: number;
  r?: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  fill?: string;
  stroke?: string;
  text?: string;
  size?: number;
};
export type Control = {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
};
export type Scene = {
  description: string;
  animate?: boolean;
  shapes: Shape[];
  controls: Control[];
  buttons?: { id: string; label: string }[];
};
const number = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 2000;
const color = (v: unknown) =>
  typeof v === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
export function parseScene(value: unknown): Scene | null {
  try {
    if (
      JSON.stringify(value).length > 64000 ||
      !value ||
      typeof value !== "object"
    )
      return null;
    const s = value as Scene;
    if (s.animate !== undefined && typeof s.animate !== "boolean") return null;
    if (
      typeof s.description !== "string" ||
      !s.description.trim() ||
      s.description.length > 2000 ||
      !Array.isArray(s.shapes) ||
      s.shapes.length > 256 ||
      !Array.isArray(s.controls ?? []) ||
      (s.controls ?? []).length > 12
    )
      return null;
    for (const p of s.shapes) {
      if (
        !p ||
        !number(p.x) ||
        !number(p.y) ||
        !["circle", "rect", "line", "text"].includes(p.kind)
      )
        return null;
      if (
        (p.fill !== undefined && !color(p.fill)) ||
        (p.stroke !== undefined && !color(p.stroke))
      )
        return null;
      if (p.kind === "circle" && (!number(p.r) || p.r < 0)) return null;
      if (
        p.kind === "rect" &&
        (!number(p.width) || !number(p.height) || p.width < 0 || p.height < 0)
      )
        return null;
      if (
        p.kind === "line" &&
        (!number(p.x2) ||
          !number(p.y2) ||
          (p.width !== undefined &&
            (!number(p.width) || p.width < 0 || p.width > 40)))
      )
        return null;
      if (
        p.kind === "text" &&
        (typeof p.text !== "string" ||
          p.text.length > 200 ||
          (p.size !== undefined &&
            (!number(p.size) || p.size < 6 || p.size > 80)))
      )
        return null;
    }
    const ids = new Set<string>();
    for (const c of s.controls ?? []) {
      if (
        !c ||
        typeof c.id !== "string" ||
        !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(c.id) ||
        ids.has(c.id) ||
        ["constructor", "toString", "__proto__", "prototype"].includes(c.id) ||
        typeof c.label !== "string" ||
        !c.label.trim() ||
        c.label.length > 120 ||
        ![c.min, c.max, c.step, c.value].every(number) ||
        c.max <= c.min ||
        c.step <= 0 ||
        c.value < c.min ||
        c.value > c.max
      )
        return null;
      ids.add(c.id);
    }
    if (!Array.isArray(s.buttons ?? []) || (s.buttons ?? []).length > 12)
      return null;
    for (const b of s.buttons ?? []) {
      if (
        !b ||
        typeof b.id !== "string" ||
        !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(b.id) ||
        ids.has(b.id) ||
        typeof b.label !== "string" ||
        !b.label.trim() ||
        b.label.length > 120
      )
        return null;
      ids.add(b.id);
    }
    return {
      buttons: s.buttons ?? [],
      animate: s.animate ?? true,
      description: s.description,
      shapes: s.shapes,
      controls: s.controls ?? [],
    };
  } catch {
    return null;
  }
}
/** CSP applies to the opaque document AND inherited blob worker. No user code in DOM. */
export async function sandboxDocument(capability: string): Promise<string> {
  const bootstrap = `"use strict";const cap=${JSON.stringify(capability)};let worker=null;let started=false;let pending=false;let deadline=null;const send=(type,data)=>parent.postMessage({cap,type,data},'*');addEventListener('message',e=>{if(e.source!==parent||!e.data||e.data.cap!==cap)return;const m=e.data;if(m.type==='start'&&!started&&typeof m.code==='string'&&m.code.length<=262144){started=true;const guard="for(const k of ['Worker','SharedWorker','importScripts','fetch','XMLHttpRequest','WebSocket','EventSource','BroadcastChannel'])Object.defineProperty(self,k,{value:undefined,writable:false,configurable:false});\\n";const url=URL.createObjectURL(new Blob([guard,m.code],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);worker.onmessage=e=>{if(!pending)return;pending=false;clearTimeout(deadline);try{const json=JSON.stringify(e.data);if(json.length>64000)throw Error();send('scene',JSON.parse(json));}catch{worker.terminate();send('error','Invalid simulation output.');}};worker.onerror=()=>{worker.terminate();send('error','Simulation stopped.');};send('ready',null);}else if(m.type==='input'&&worker&&!pending){pending=true;deadline=setTimeout(()=>{worker.terminate();send('error','Simulation exceeded its response limit.');},1500);worker.postMessage(m.data);}});send('boot',null);`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(bootstrap),
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const csp = `default-src 'none'; script-src 'sha256-${hash}'; worker-src blob:; connect-src 'none'; img-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; font-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><script>${bootstrap}</script>`;
}
