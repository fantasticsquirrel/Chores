/** Author-side scene recorder. No DOM, network, renderer or third-party dependency. */
type Vector = [number, number, number];
type Options = Record<string, number | boolean | CanvasTexture>;
let materials: Material[] = [];
let textures: CanvasTexture[] = [];
export function resetResources() { materials = []; textures = []; }
class Triple {
  constructor(public x = 0, public y = 0, public z = 0) {}
  set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  array(): Vector { return [this.x, this.y, this.z]; }
}
export class Vector3 extends Triple {}
export class Object3D {
  position = new Triple(); rotation = new Triple(); scale = new Triple(1, 1, 1);
  visible = true; castShadow = false; receiveShadow = false;
  children: Object3D[] = [];
  kind = 'group';
  add(...nodes: Object3D[]) { this.children.push(...nodes); }
  clear() { this.children = []; }
  traverse(fn: (node: Object3D) => void) { fn(this); this.children.forEach(n => n.traverse(fn)); }
  record(): unknown {
    return { kind: this.kind, position: this.position.array(), rotation: this.rotation.array(), scale: this.scale.array(), visible: this.visible,
      ...(this instanceof Mesh || this instanceof Line ? { castShadow: this.castShadow, receiveShadow: this.receiveShadow, geometry: this.geometry.record(), material: this.material.id } : {}),
      ...(this.children.length ? { children: this.children.map(n => n.record()) } : {}) };
  }
}
export class Group extends Object3D {}
class Geometry {
  constructor(public kind: string, public args: number[] = []) {}
  record(): unknown { return { kind: this.kind, args: this.args }; }
  dispose() {}
}
export class BoxGeometry extends Geometry { constructor(...args: number[]) { super('box', args); } }
export class CylinderGeometry extends Geometry { constructor(...args: number[]) { super('cylinder', args); } }
export class TorusGeometry extends Geometry { constructor(...args: number[]) { super('torus', args); } }
export class CircleGeometry extends Geometry { constructor(...args: number[]) { super('circle', args); } }
export class IcosahedronGeometry extends Geometry { constructor(...args: number[]) { super('icosahedron', args); } }
export class Shape {
  commands: {op: string; args: number[]}[] = [];
  moveTo(...args: number[]) { this.commands.push({op:'moveTo', args}); }
  lineTo(...args: number[]) { this.commands.push({op:'lineTo', args}); }
  absarc(x: number, y: number, r: number, start: number, end: number, counterclockwise: boolean) { this.commands.push({op:'absarc', args:[x,y,r,start,end, counterclockwise ? 1 : 0]}); }
  closePath() { this.commands.push({op:'closePath', args:[]}); }
}
export class ExtrudeGeometry extends Geometry {
  constructor(public shape: Shape, public options: {depth: number; bevelEnabled: boolean}) { super('extrude'); }
  record() { return { kind: this.kind, commands: this.shape.commands, depth: this.options.depth }; }
}
export class BufferGeometry extends Geometry {
  points: Vector[] = [];
  constructor() { super('line'); }
  setFromPoints(points: Vector3[]) { this.points = points.map(p => p.array()); return this; }
  record() { return {kind:'line',points:this.points}; }
}
export class Material {
  id: string;
  constructor(public kind: string, public options: Options) { this.id = `m${materials.length}`; materials.push(this); }
  dispose() {}
  record() { return {id:this.id,kind:this.kind,...Object.fromEntries(Object.entries(this.options).map(([key,value]) => [key, value instanceof CanvasTexture ? value.id : value]))}; }
}
export class MeshStandardMaterial extends Material { constructor(options: Options) { super('standard',options); } }
export class MeshBasicMaterial extends Material { constructor(options: Options) { super('basic',options); } }
export class LineBasicMaterial extends Material { constructor(options: Options) { super('line',options); } }
export class LineDashedMaterial extends LineBasicMaterial { constructor(options: Options) { super(options); this.kind = 'dashed'; } }
export class Mesh extends Object3D { kind = 'mesh'; constructor(public geometry: Geometry, public material: Material) { super(); } }
export class Line extends Object3D { kind = 'line'; constructor(public geometry: Geometry, public material: Material) { super(); } computeLineDistances() { return this; } }
export const RepeatWrapping = 1000, SRGBColorSpace = 'srgb';
export class TextureCanvas {
  width = 512; height = 512;
  rects: {x:number;y:number;width:number;height:number;color:string}[] = [];
  getContext(_kind: string) {
    const rects = this.rects;
    return {fillStyle:'#000000',fillRect(x:number,y:number,width:number,height:number) {
      const matches = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(this.fillStyle);
      const color = matches ? '#' + matches.slice(1).map(v => Number(v).toString(16).padStart(2,'0')).join('') : this.fillStyle;
      rects.push({x,y,width,height,color});
    }};
  }
}
export class CanvasTexture {
  id: string; wrapS = 1000; wrapT = 1000; colorSpace = 'srgb'; anisotropy = 4;
  repeat = {x:1,y:1,set(x:number,y:number) {this.x=x;this.y=y;}};
  constructor(public canvas: TextureCanvas) { this.id = `t${textures.length}`; textures.push(this); }
  dispose() {}
  record() { return {id:this.id,width:this.canvas.width,height:this.canvas.height,rects:this.canvas.rects,repeat:[this.repeat.x,this.repeat.y],anisotropy:this.anisotropy}; }
}
export function resources() { return {materials:materials.map(m=>m.record()),textures:textures.map(t=>t.record())}; }
