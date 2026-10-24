import { parseRichVector, type RichVector } from "./rich/vector";
import { parseTones, type Tone } from "./rich/audio";
import { parseRichScene, type RichScene } from "./rich/parseRichScene";
import { parseScene3D } from "./scene3d/parseScene3D";
import type { Scene3D } from "./scene3d/types";
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
  kind?: "range" | "toggle" | "select";
  options?: { value: number; label: string }[];
  min: number;
  max: number;
  step: number;
  value: number;
};
export type Scene = {
  description: string;
  scene3d?: Scene3D;
  rich3d?: RichScene;
  vector?: RichVector;
  fallbackVector?: RichVector;
  pointer?: boolean;
  pointerMode?: "drag" | "tap";
  audio?: Tone[];
  readoutColumns?: 1 | 2 | 3 | 4;
  readouts?: { label: string; value: string; detail?: string }[];
  animate?: boolean;
  shapes: Shape[];
  controls: Control[];
  buttons?: { id: string; label: string; pressed?: boolean }[];
  sections?: { heading: string; text: string; buttonIds?: string[] }[];
  footnote?: string;
};
const number = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 2000;
const color = (v: unknown) =>
  typeof v === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
export function parseScene(
  value: unknown,
  mode: "vector" | "3d" | "rich" = "vector",
  assets: ReadonlySet<string> = new Set(),
  previous?: Scene | null,
): Scene | null {
  try {
    if (mode === "rich" && value && typeof value === "object") {
      const raw = value as { scene3d?: Record<string, unknown> };
      if (
        raw.scene3d &&
        Object.prototype.hasOwnProperty.call(raw.scene3d, "reuseResources")
      ) {
        if (raw.scene3d.reuseResources !== true || !previous?.rich3d)
          return null;
        const rest = { ...raw.scene3d };
        delete rest.reuseResources;
        for (const key of ["geometries", "materials", "textures"])
          if (key in rest && !Array.isArray(rest[key])) return null;
        value = {
          ...value,
          scene3d: {
            ...rest,
            geometries: rest.geometries ?? previous.rich3d.geometries,
            materials: rest.materials ?? previous.rich3d.materials,
            textures: rest.textures ?? previous.rich3d.textures,
          },
        };
      }
    }
    if (
      JSON.stringify(value).length >
        (mode === "rich" ? 4194304 : mode === "3d" ? 524288 : 64000) ||
      !value ||
      typeof value !== "object"
    )
      return null;
    if (
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
      (mode === "rich" ? 4194304 : mode === "3d" ? 524288 : 64000)
    )
      return null;
    const s = value as Scene;
    const scene3d =
      s.scene3d === undefined || mode === "rich"
        ? undefined
        : parseScene3D(s.scene3d);
    const rich3d =
      mode === "rich" && s.scene3d !== undefined
        ? parseRichScene(s.scene3d, assets)
        : undefined;
    if (rich3d === null) return null;
    const vector =
      s.vector === undefined
        ? undefined
        : mode === "rich"
          ? parseRichVector(s.vector)
          : null;
    if (vector === null) return null;
    const fallbackVector =
      s.fallbackVector === undefined
        ? undefined
        : mode !== "vector"
          ? parseRichVector(s.fallbackVector)
          : null;
    if (fallbackVector === null) return null;
    if (
      s.pointer !== undefined &&
      (mode !== "rich" || typeof s.pointer !== "boolean")
    )
      return null;
    if (
      s.pointerMode !== undefined &&
      (mode !== "rich" || !["drag", "tap"].includes(s.pointerMode))
    )
      return null;
    if (scene3d === null) return null;
    if (mode === "3d" ? !scene3d || s.animate !== false : scene3d !== undefined)
      return null;
    if (mode !== "rich" && !scene3d && JSON.stringify(value).length > 64000)
      return null;
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
      if (
        c.kind !== undefined &&
        !["range", "toggle", "select"].includes(c.kind)
      )
        return null;
      if (
        c.kind === "toggle" &&
        (c.min !== 0 ||
          c.max !== 1 ||
          c.step !== 1 ||
          ![0, 1].includes(c.value))
      )
        return null;
      if (c.kind === "select") {
        if (
          !Array.isArray(c.options) ||
          c.options.length < 2 ||
          c.options.length > 12 ||
          new Set(c.options.map((o) => o.value)).size !== c.options.length
        )
          return null;
        for (const o of c.options)
          if (
            !o ||
            !number(o.value) ||
            o.value < c.min ||
            o.value > c.max ||
            typeof o.label !== "string" ||
            !o.label.trim() ||
            o.label.length > 120
          )
            return null;
        if (!c.options.some((o) => o.value === c.value)) return null;
      } else if (c.options !== undefined) return null;
      ids.add(c.id);
    }
    if (
      !Array.isArray(s.buttons ?? []) ||
      (s.buttons ?? []).length > (mode === "rich" ? 32 : 12)
    )
      return null;
    for (const b of s.buttons ?? []) {
      if (
        !b ||
        typeof b.id !== "string" ||
        !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(b.id) ||
        ids.has(b.id) ||
        typeof b.label !== "string" ||
        !b.label.trim() ||
        b.label.length > 120 ||
        (b.pressed !== undefined && typeof b.pressed !== "boolean")
      )
        return null;
      ids.add(b.id);
    }
    if (
      s.footnote !== undefined &&
      (typeof s.footnote !== "string" || s.footnote.length > 1000)
    )
      return null;
    if (!Array.isArray(s.sections ?? []) || (s.sections ?? []).length > 4)
      return null;
    const placed = new Set<string>();
    const buttonIds = new Set((s.buttons ?? []).map((b) => b.id));
    for (const section of s.sections ?? []) {
      if (
        !section ||
        typeof section.heading !== "string" ||
        !section.heading.trim() ||
        section.heading.length > 80 ||
        typeof section.text !== "string" ||
        !section.text.trim() ||
        section.text.length > 1200 ||
        !Array.isArray(section.buttonIds ?? []) ||
        (section.buttonIds ?? []).length > (mode === "rich" ? 32 : 12)
      )
        return null;
      for (const id of section.buttonIds ?? []) {
        if (!buttonIds.has(id) || placed.has(id)) return null;
        placed.add(id);
      }
    }
    if (
      s.readoutColumns !== undefined &&
      (mode !== "rich" || ![1, 2, 3, 4].includes(s.readoutColumns))
    )
      return null;
    if (
      s.readouts !== undefined &&
      (mode !== "rich" ||
        !Array.isArray(s.readouts) ||
        s.readouts.length > 8 ||
        s.readouts.some(
          (r) =>
            !r ||
            typeof r.label !== "string" ||
            !r.label.trim() ||
            r.label.length > 120 ||
            typeof r.value !== "string" ||
            !r.value.trim() ||
            r.value.length > 120 ||
            (r.detail !== undefined &&
              (typeof r.detail !== "string" || r.detail.length > 200)) ||
            Object.keys(r).some(
              (k) => !["label", "value", "detail"].includes(k),
            ),
        ))
    )
      return null;
    const audio =
      s.audio === undefined
        ? undefined
        : mode === "rich"
          ? parseTones(s.audio, buttonIds)
          : null;
    if (audio === null) return null;
    return {
      audio,
      readouts: s.readouts,
      readoutColumns: s.readoutColumns,
      sections: s.sections ?? [],
      footnote: s.footnote,
      scene3d: scene3d ?? undefined,
      rich3d: rich3d ?? undefined,
      vector: vector ?? undefined,
      fallbackVector: fallbackVector ?? undefined,
      pointer: s.pointer,
      pointerMode: s.pointerMode,
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
export async function sandboxDocument(
  capability: string,
  mode: "vector" | "3d" | "rich" = "vector",
): Promise<string> {
  const limit = mode === "rich" ? 4194304 : mode === "3d" ? 524288 : 64000;
  const guard = `{
    const post = self.postMessage.bind(self);
    const stop = Event.prototype.stopImmediatePropagation;
    self.addEventListener('message', event => {
      if (event.data && typeof event.data.__hostPing === 'string') {
        stop.call(event); post({__hostPong:event.data.__hostPing});
      }
    });
    for (const k of ['Worker','SharedWorker','importScripts','fetch','XMLHttpRequest','WebSocket','EventSource','BroadcastChannel'])
      Object.defineProperty(self,k,{value:undefined,writable:false,configurable:false});
  }\n`;
  const bootstrap = `"use strict";const cap=${JSON.stringify(capability)};
let worker=null,started=false,pending=false,deadline=null,heartbeat=null,pingDeadline=null,ping=null;
const send=(type,data)=>parent.postMessage({cap,type,data},'*');
const fail=()=>{if(worker)worker.terminate();worker=null;clearTimeout(deadline);clearTimeout(pingDeadline);clearInterval(heartbeat);send('error','Simulation stopped or exceeded its limits.');};
addEventListener('message',e=>{
  if(e.source!==parent||!e.data||e.data.cap!==cap)return;
  const m=e.data;
  if(m.type==='start'&&!started&&typeof m.code==='string'&&m.code.length<=${mode === "rich" ? 1048576 : 262144}){
    started=true;
    const url=URL.createObjectURL(new Blob([${JSON.stringify(guard)},m.code],{type:'text/javascript'}));
    worker=new Worker(url);URL.revokeObjectURL(url);
    worker.onmessage=e=>{
      if(e.data&&typeof e.data.__hostPong==='string'){
        if(ping!==null&&e.data.__hostPong===ping){ping=null;clearTimeout(pingDeadline);}return;
      }
      if(!pending)return;
      pending=false;clearTimeout(deadline);
      try{const json=JSON.stringify(e.data);if(json.length>${limit}||new TextEncoder().encode(json).byteLength>${limit})throw Error();send('scene',JSON.parse(json));}catch{fail();}
    };
    worker.onerror=fail;
    heartbeat=setInterval(()=>{
      if(!worker||ping!==null)return;
      ping=crypto.randomUUID();worker.postMessage({__hostPing:ping});pingDeadline=setTimeout(fail,1500);
    },750);
    send('ready',null);
  }else if(m.type==='input'&&worker&&!pending){
    pending=true;deadline=setTimeout(fail,1500);worker.postMessage(m.data);
  }
});send('boot',null);`;

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(bootstrap),
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const csp = `default-src 'none'; script-src 'sha256-${hash}'; worker-src blob:; connect-src 'none'; img-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; font-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><script>${bootstrap}</script>`;
}
