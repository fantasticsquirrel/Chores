export type Vec3 = [number, number, number];
export type Geometry3D =
  | {
      kind: "box" | "cylinder" | "torus" | "circle" | "icosahedron";
      args: number[];
    }
  | {
      kind: "extrude";
      commands: {
        op: "moveTo" | "lineTo" | "absarc" | "closePath";
        args: number[];
      }[];
      depth: number;
    }
  | { kind: "line"; points: Vec3[] };
export type Node3D = {
  kind: "group" | "mesh" | "line";
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  material?: string;
  geometry?: Geometry3D;
  children?: Node3D[];
};
export type Material3D = {
  id: string;
  kind: "standard" | "basic" | "line" | "dashed";
  color: number;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  transparent?: boolean;
  bumpScale?: number;
  map?: string;
  bumpMap?: string;
  dashSize?: number;
  gapSize?: number;
};
export type Texture3D = {
  id: string;
  width: number;
  height: number;
  rects: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }[];
  repeat: [number, number];
  anisotropy: number;
};
export type CameraPreset3D = {
  id: string;
  label: string;
  yaw: number;
  elevation: number;
  zoom: number;
};
export type Scene3D = {
  materials: Material3D[];
  textures: Texture3D[];
  nodes: Node3D[];
  camera: {
    target: Vec3;
    radius: number;
    yaw: number;
    elevation: number;
    zoom: number;
    halfHeight: number;
    narrowHalfWidth: number;
    narrowAspect: number;
    presets: CameraPreset3D[];
  };
  lighting: {
    hemisphere: { sky: number; ground: number; intensity: number };
    directional: {
      color: number;
      intensity: number;
      position: Vec3;
      shadow?: {
        size: number;
        extent: number;
        near: number;
        far: number;
        bias: number;
        normalBias: number;
        radius: number;
      };
    }[];
  };
  labels: { text: string; position: Vec3 }[];
  presentation: {
    title: string;
    subtitle?: string;
    route?: string;
    background: [string, string, string];
  };
};
