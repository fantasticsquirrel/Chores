(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // scripts/exploration-packages/space-life-support/vector-author.ts
  var Fragment = "fragment";
  var nextId = 0;
  var resetVectorIds = () => {
    nextId = 0;
  };
  var useId = () => `illustration${nextId++}`;
  function h(tag, props, ...children) {
    if (typeof tag === "function") return tag({ ...props, children });
    const nodes = children.flat(Infinity).filter((v) => v !== null && v !== void 0 && v !== false && v !== true).map((v) => typeof v === "number" ? String(v) : v);
    if (tag === Fragment) return nodes;
    const attrs = {};
    for (const [k, v] of Object.entries(props ?? {})) {
      if (["key", "className", "role", "style", "viewBox"].includes(k) || k.startsWith("on") || k.startsWith("aria-") || k.startsWith("data-"))
        continue;
      if (v !== void 0) attrs[k] = v;
    }
    return { tag, attrs, children: nodes };
  }

  // scripts/castle-package/fallbackMaterials.tsx
  function CastleMaterials({ id }) {
    return /* @__PURE__ */ h("defs", null, /* @__PURE__ */ h(
      "pattern",
      {
        id: `${id}-stone`,
        width: "20",
        height: "12",
        patternUnits: "userSpaceOnUse"
      },
      /* @__PURE__ */ h("rect", { width: "20", height: "12", fill: "#bcb9a6" }),
      /* @__PURE__ */ h(
        "path",
        {
          d: "M0 0h20M0 6h20M10 0v6M0 6v6M20 6v6",
          fill: "none",
          stroke: "#807f73",
          strokeWidth: ".6"
        }
      ),
      /* @__PURE__ */ h("path", { d: "M1 1h8M11 7h8", stroke: "#eee5cc", strokeWidth: ".6" })
    ), /* @__PURE__ */ h(
      "pattern",
      {
        id: `${id}-pave`,
        width: "17",
        height: "13",
        patternUnits: "userSpaceOnUse"
      },
      /* @__PURE__ */ h("rect", { width: "17", height: "13", fill: "#79816c" }),
      /* @__PURE__ */ h(
        "path",
        {
          d: "M0 0h17M0 0v13M8 0v6M0 6h17",
          fill: "none",
          stroke: "#525f50",
          strokeWidth: ".7"
        }
      )
    ), /* @__PURE__ */ h(
      "pattern",
      {
        id: `${id}-roof`,
        width: "13",
        height: "8",
        patternUnits: "userSpaceOnUse"
      },
      /* @__PURE__ */ h("rect", { width: "13", height: "8", fill: "#9c6252" }),
      /* @__PURE__ */ h(
        "path",
        {
          d: "M0 0h13M0 4h13M6 0v4M0 4v4",
          stroke: "#c48b6b",
          strokeWidth: ".6",
          fill: "none"
        }
      )
    ), /* @__PURE__ */ h("linearGradient", { id: `${id}-water`, x2: "1", y2: "1" }, /* @__PURE__ */ h("stop", { stopColor: "#335f60" }), /* @__PURE__ */ h("stop", { offset: ".5", stopColor: "#68a2a0" }), /* @__PURE__ */ h("stop", { offset: "1", stopColor: "#254c52" })), /* @__PURE__ */ h("radialGradient", { id: `${id}-tree`, cx: "30%", cy: "25%" }, /* @__PURE__ */ h("stop", { stopColor: "#7d9c63" }), /* @__PURE__ */ h("stop", { offset: "1", stopColor: "#2d4b36" })), /* @__PURE__ */ h("linearGradient", { id: `${id}-tower`, x2: "1", y2: "1" }, /* @__PURE__ */ h("stop", { stopColor: "#eee2bd" }), /* @__PURE__ */ h("stop", { offset: ".5", stopColor: "#bab79c" }), /* @__PURE__ */ h("stop", { offset: "1", stopColor: "#626c60" })));
  }

  // scripts/castle-package/CastleDrawing.tsx
  function CastleDrawing({
    moat,
    towers,
    gate,
    inner,
    approach,
    sight
  }) {
    const id = useId();
    return /* @__PURE__ */ h("g", null, /* @__PURE__ */ h(CastleMaterials, { id }), /* @__PURE__ */ h(
      "path",
      {
        d: "M30 330Q90 280 98 210T150 60M580 65q62 50 48 150t60 130",
        fill: "none",
        stroke: "#728060",
        strokeWidth: "1",
        opacity: ".5"
      }
    ), /* @__PURE__ */ h(
      "path",
      {
        d: "M360 420V350M360 85V55",
        stroke: "#9c9673",
        strokeWidth: "32",
        opacity: ".35"
      }
    ), Array.from({ length: 20 }, (_, i) => {
      const x = i < 10 ? 55 + i % 3 * 35 : 590 + i % 3 * 35, y = 75 + i % 10 * 29;
      return /* @__PURE__ */ h("g", { key: i }, /* @__PURE__ */ h(
        "ellipse",
        {
          cx: x + 7,
          cy: y + 7,
          rx: "13",
          ry: "9",
          fill: "#102b23",
          opacity: ".35"
        }
      ), /* @__PURE__ */ h("circle", { cx: x, cy: y, r: 8 + i % 4, fill: `url(#${id}-tree)` }), /* @__PURE__ */ h("circle", { cx: x - 3, cy: y - 3, r: "3", fill: "#8ca46f", opacity: ".3" }));
    }), /* @__PURE__ */ h(
      "rect",
      {
        x: "202",
        y: "112",
        width: "322",
        height: "225",
        rx: "8",
        fill: "#0a1d19",
        opacity: ".5",
        transform: "translate(9 9)"
      }
    ), moat > 0 && /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(
      "rect",
      {
        x: 210 - moat,
        y: 105 - moat * 0.6,
        width: 300 + moat * 2,
        height: 220 + moat * 1.2,
        rx: "25",
        fill: "none",
        stroke: "#172f2c",
        strokeWidth: moat + 5
      }
    ), /* @__PURE__ */ h(
      "rect",
      {
        x: 210 - moat,
        y: 105 - moat * 0.6,
        width: 300 + moat * 2,
        height: 220 + moat * 1.2,
        rx: "25",
        fill: "none",
        stroke: `url(#${id}-water)`,
        strokeWidth: moat
      }
    ), /* @__PURE__ */ h(
      "path",
      {
        d: `M240 ${105 - moat * 0.6}h70m80 0h80M${210 - moat} 155v28m0 40v22M${510 + moat} 160v34m0 45v30`,
        stroke: "#b8d5bd",
        strokeWidth: "1",
        opacity: ".35",
        fill: "none"
      }
    )), /* @__PURE__ */ h(
      "rect",
      {
        x: "210",
        y: "105",
        width: "300",
        height: "220",
        fill: `url(#${id}-pave)`,
        stroke: `url(#${id}-stone)`,
        strokeWidth: "16"
      }
    ), /* @__PURE__ */ h(
      "path",
      {
        d: "M222 118H498V313",
        fill: "none",
        stroke: "#20372e",
        strokeWidth: "7",
        opacity: ".5"
      }
    ), Array.from({ length: 15 }, (_, i) => /* @__PURE__ */ h("g", { key: i }, /* @__PURE__ */ h(
      "rect",
      {
        x: 210 + i * 20 + 2,
        y: "96",
        width: "9",
        height: "22",
        fill: "#5a6355",
        opacity: ".5"
      }
    ), /* @__PURE__ */ h(
      "rect",
      {
        x: 210 + i * 20,
        y: "94",
        width: "9",
        height: "20",
        fill: `url(#${id}-tower)`
      }
    ), /* @__PURE__ */ h(
      "rect",
      {
        x: 210 + i * 20,
        y: "314",
        width: "9",
        height: "22",
        fill: `url(#${id}-tower)`
      }
    ))), Array.from({ length: 10 }, (_, i) => /* @__PURE__ */ h("g", { key: i }, /* @__PURE__ */ h(
      "rect",
      {
        x: "199",
        y: 115 + i * 20,
        width: "22",
        height: "9",
        fill: `url(#${id}-tower)`
      }
    ), /* @__PURE__ */ h(
      "rect",
      {
        x: "499",
        y: 115 + i * 20,
        width: "22",
        height: "9",
        fill: `url(#${id}-tower)`
      }
    ))), towers && [
      [210, 105],
      [510, 105],
      [210, 325],
      [510, 325]
    ].map(([x, y]) => /* @__PURE__ */ h("g", { key: `${x}-${y}` }, sight && /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(
      "path",
      {
        d: `M${x} ${y}l${x < 300 ? 80 : -80} 0 0 ${y < 200 ? -45 : 45}Z`,
        fill: "#f2d78b",
        opacity: ".2"
      }
    ), /* @__PURE__ */ h(
      "path",
      {
        d: `M${x} ${y}l0 ${y < 200 ? 80 : -80} ${x < 300 ? -45 : 45} 0Z`,
        fill: "#f2d78b",
        opacity: ".2"
      }
    )), /* @__PURE__ */ h("circle", { cx: x + 5, cy: y + 6, r: "24", fill: "#10261f", opacity: ".5" }), /* @__PURE__ */ h(
      "circle",
      {
        cx: x,
        cy: y,
        r: "23",
        fill: `url(#${id}-tower)`,
        stroke: "#dcd7ba",
        strokeWidth: "2"
      }
    ), /* @__PURE__ */ h(
      "circle",
      {
        cx: x,
        cy: y,
        r: "14",
        fill: `url(#${id}-stone)`,
        stroke: "#687260",
        strokeWidth: "2"
      }
    ), Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4;
      return /* @__PURE__ */ h(
        "rect",
        {
          key: i,
          x: x + Math.cos(a) * 20 - 3,
          y: y + Math.sin(a) * 20 - 3,
          width: "6",
          height: "6",
          fill: "#e0d8b9",
          transform: `rotate(${i * 45} ${x + Math.cos(a) * 20} ${y + Math.sin(a) * 20})`
        }
      );
    }), /* @__PURE__ */ h("circle", { cx: x, cy: y, r: "5", fill: "#526251" }))), inner && /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(
      "rect",
      {
        x: "270",
        y: "145",
        width: "180",
        height: "120",
        rx: "3",
        fill: "none",
        stroke: "#243b2e",
        strokeWidth: "11",
        transform: "translate(3 4)"
      }
    ), /* @__PURE__ */ h(
      "rect",
      {
        x: "270",
        y: "145",
        width: "180",
        height: "120",
        rx: "3",
        fill: "none",
        stroke: `url(#${id}-stone)`,
        strokeWidth: "7"
      }
    )), /* @__PURE__ */ h(
      "path",
      {
        d: "M327 324v-70h-3",
        fill: "none",
        stroke: "#b6ab87",
        strokeWidth: "12",
        opacity: ".45"
      }
    ), /* @__PURE__ */ h(
      "rect",
      {
        x: "290",
        y: "162",
        width: "73",
        height: "59",
        fill: "#293c2d",
        opacity: ".6",
        transform: "translate(5 7)"
      }
    ), /* @__PURE__ */ h("rect", { x: "286", y: "156", width: "76", height: "60", fill: `url(#${id}-roof)` }), /* @__PURE__ */ h(
      "path",
      {
        d: "M286 156l38 30 38-30M324 186v30",
        fill: "none",
        stroke: "#dca883",
        strokeWidth: "2"
      }
    ), /* @__PURE__ */ h("path", { d: "M324 186l38-30v60h-38Z", fill: "#2b1e1a", opacity: ".22" }), /* @__PURE__ */ h(
      "rect",
      {
        x: "300",
        y: "165",
        width: "9",
        height: "12",
        fill: "#716c5d",
        stroke: "#c0b69a"
      }
    ), /* @__PURE__ */ h("text", { x: "324", y: "238", textAnchor: "middle", className: "dl-svg-small" }, "great hall \xB7 home"), /* @__PURE__ */ h(
      "rect",
      {
        x: "380",
        y: "178",
        width: "50",
        height: "42",
        fill: "#293c2d",
        transform: "translate(4 6)"
      }
    ), /* @__PURE__ */ h("rect", { x: "376", y: "174", width: "50", height: "42", fill: `url(#${id}-roof)` }), /* @__PURE__ */ h("path", { d: "M401 174v42", stroke: "#dcc29b", strokeWidth: "2" }), /* @__PURE__ */ h("text", { x: "401", y: "238", textAnchor: "middle", className: "dl-svg-small" }, "stores"), /* @__PURE__ */ h(
      "rect",
      {
        x: "337",
        y: "313",
        width: "46",
        height: "64",
        fill: "#382f24",
        transform: "translate(3 4)"
      }
    ), /* @__PURE__ */ h("rect", { x: "337", y: "313", width: "46", height: "63", fill: "#a5895d" }), Array.from({ length: 10 }, (_, i) => /* @__PURE__ */ h(
      "path",
      {
        key: i,
        d: `M338 ${315 + i * 6}h44`,
        stroke: "#584b35",
        strokeWidth: "1"
      }
    )), /* @__PURE__ */ h("path", { d: "M339 315v61M381 315v61", stroke: "#d6be8b", strokeWidth: "3" }), /* @__PURE__ */ h("rect", { x: "328", y: "300", width: "20", height: "40", fill: `url(#${id}-stone)` }), /* @__PURE__ */ h("rect", { x: "372", y: "300", width: "20", height: "40", fill: `url(#${id}-stone)` }), /* @__PURE__ */ h("rect", { x: "348", y: "310", width: "24", height: "18", fill: "#182b23" }), gate ? /* @__PURE__ */ h("g", null, /* @__PURE__ */ h("rect", { x: "348", y: "317", width: "24", height: "9", fill: "#654b30" }), [350, 357, 364, 371].map((x) => /* @__PURE__ */ h(
      "line",
      {
        key: x,
        x1: x,
        y1: "313",
        x2: x,
        y2: "331",
        stroke: "#d2b380",
        strokeWidth: "2"
      }
    )), /* @__PURE__ */ h("path", { d: "M348 318h24M348 324h24", stroke: "#2d231a", strokeWidth: "2" })) : /* @__PURE__ */ h("path", { d: "M348 310v19M372 310v19", stroke: "#c3b28d", strokeWidth: "2" }), approach === "bridge" ? /* @__PURE__ */ h(
      "path",
      {
        d: `M360 402V${gate ? 340 : 246}`,
        stroke: "#ffe7a1",
        strokeWidth: "3",
        fill: "none",
        strokeDasharray: "7 5"
      }
    ) : /* @__PURE__ */ h(
      "path",
      {
        d: `M360 50V${moat > 0 ? 75 : 115}`,
        stroke: "#ffe7a1",
        strokeWidth: "3",
        fill: "none",
        strokeDasharray: "7 5"
      }
    ), /* @__PURE__ */ h("text", { x: "30", y: "395", className: "dl-svg-small" }, "PLAN VIEW \xB7 light from upper left \xB7 schematic terrain"));
  }

  // scripts/castle-package/scene-builder.ts
  var materials = [];
  var textures = [];
  function resetResources() {
    materials = [];
    textures = [];
  }
  var Triple = class {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    array() {
      return [this.x, this.y, this.z];
    }
  };
  var Vector3 = class extends Triple {
  };
  var Object3D = class {
    constructor() {
      __publicField(this, "position", new Triple());
      __publicField(this, "rotation", new Triple());
      __publicField(this, "scale", new Triple(1, 1, 1));
      __publicField(this, "visible", true);
      __publicField(this, "castShadow", false);
      __publicField(this, "receiveShadow", false);
      __publicField(this, "children", []);
      __publicField(this, "kind", "group");
    }
    add(...nodes) {
      this.children.push(...nodes);
    }
    clear() {
      this.children = [];
    }
    traverse(fn) {
      fn(this);
      this.children.forEach((n) => n.traverse(fn));
    }
    record() {
      return {
        kind: this.kind,
        position: this.position.array(),
        rotation: this.rotation.array(),
        scale: this.scale.array(),
        visible: this.visible,
        ...this instanceof Mesh || this instanceof Line ? { castShadow: this.castShadow, receiveShadow: this.receiveShadow, geometry: this.geometry.record(), material: this.material.id } : {},
        ...this.children.length ? { children: this.children.map((n) => n.record()) } : {}
      };
    }
  };
  var Group = class extends Object3D {
  };
  var Geometry = class {
    constructor(kind, args = []) {
      this.kind = kind;
      this.args = args;
    }
    record() {
      return { kind: this.kind, args: this.args };
    }
    dispose() {
    }
  };
  var BoxGeometry = class extends Geometry {
    constructor(...args) {
      super("box", args);
    }
  };
  var CylinderGeometry = class extends Geometry {
    constructor(...args) {
      super("cylinder", args);
    }
  };
  var TorusGeometry = class extends Geometry {
    constructor(...args) {
      super("torus", args);
    }
  };
  var CircleGeometry = class extends Geometry {
    constructor(...args) {
      super("circle", args);
    }
  };
  var IcosahedronGeometry = class extends Geometry {
    constructor(...args) {
      super("icosahedron", args);
    }
  };
  var Shape = class {
    constructor() {
      __publicField(this, "commands", []);
    }
    moveTo(...args) {
      this.commands.push({ op: "moveTo", args });
    }
    lineTo(...args) {
      this.commands.push({ op: "lineTo", args });
    }
    absarc(x, y, r, start, end, counterclockwise) {
      this.commands.push({ op: "absarc", args: [x, y, r, start, end, counterclockwise ? 1 : 0] });
    }
    closePath() {
      this.commands.push({ op: "closePath", args: [] });
    }
  };
  var ExtrudeGeometry = class extends Geometry {
    constructor(shape, options) {
      super("extrude");
      this.shape = shape;
      this.options = options;
    }
    record() {
      return { kind: this.kind, commands: this.shape.commands, depth: this.options.depth };
    }
  };
  var BufferGeometry = class extends Geometry {
    constructor() {
      super("line");
      __publicField(this, "points", []);
    }
    setFromPoints(points) {
      this.points = points.map((p) => p.array());
      return this;
    }
    record() {
      return { kind: "line", points: this.points };
    }
  };
  var Material = class {
    constructor(kind, options) {
      this.kind = kind;
      this.options = options;
      __publicField(this, "id");
      this.id = `m${materials.length}`;
      materials.push(this);
    }
    dispose() {
    }
    record() {
      return { id: this.id, kind: this.kind, ...Object.fromEntries(Object.entries(this.options).map(([key, value]) => [key, value instanceof CanvasTexture ? value.id : value])) };
    }
  };
  var MeshStandardMaterial = class extends Material {
    constructor(options) {
      super("standard", options);
    }
  };
  var MeshBasicMaterial = class extends Material {
    constructor(options) {
      super("basic", options);
    }
  };
  var LineBasicMaterial = class extends Material {
    constructor(options) {
      super("line", options);
    }
  };
  var LineDashedMaterial = class extends LineBasicMaterial {
    constructor(options) {
      super(options);
      this.kind = "dashed";
    }
  };
  var Mesh = class extends Object3D {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
      __publicField(this, "kind", "mesh");
    }
  };
  var Line = class extends Object3D {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
      __publicField(this, "kind", "line");
    }
    computeLineDistances() {
      return this;
    }
  };
  var RepeatWrapping = 1e3;
  var SRGBColorSpace = "srgb";
  var TextureCanvas = class {
    constructor() {
      __publicField(this, "width", 512);
      __publicField(this, "height", 512);
      __publicField(this, "rects", []);
    }
    getContext(_kind) {
      const rects = this.rects;
      return { fillStyle: "#000000", fillRect(x, y, width, height) {
        const matches = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(this.fillStyle);
        const color = matches ? "#" + matches.slice(1).map((v) => Number(v).toString(16).padStart(2, "0")).join("") : this.fillStyle;
        rects.push({ x, y, width, height, color });
      } };
    }
  };
  var CanvasTexture = class {
    constructor(canvas) {
      this.canvas = canvas;
      __publicField(this, "id");
      __publicField(this, "wrapS", 1e3);
      __publicField(this, "wrapT", 1e3);
      __publicField(this, "colorSpace", "srgb");
      __publicField(this, "anisotropy", 4);
      __publicField(this, "repeat", { x: 1, y: 1, set(x, y) {
        this.x = x;
        this.y = y;
      } });
      this.id = `t${textures.length}`;
      textures.push(this);
    }
    dispose() {
    }
    record() {
      return { id: this.id, width: this.canvas.width, height: this.canvas.height, rects: this.canvas.rects, repeat: [this.repeat.x, this.repeat.y], anisotropy: this.anisotropy };
    }
  };
  function resources() {
    return { materials: materials.map((m) => m.record()), textures: textures.map((t) => t.record()) };
  }

  // scripts/castle-package/castleGeometry.ts
  function box(group, width, height, depth, x, y, z, material) {
    const mesh = new Mesh(
      new BoxGeometry(width, height, depth),
      material
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function cylinder(group, radius, height, x, y, z, material, topRadius = radius) {
    const mesh = new Mesh(
      new CylinderGeometry(topRadius, radius, height, 32),
      material
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function line(group, points, material) {
    const geometry = new BufferGeometry().setFromPoints(
      points.map((point) => new Vector3(...point))
    );
    const mesh = new Line(geometry, material);
    group.add(mesh);
    return mesh;
  }
  function roof(group, width, depth, height, x, y, z, material) {
    const triangle = new Shape();
    triangle.moveTo(-width / 2, 0);
    triangle.lineTo(0, height);
    triangle.lineTo(width / 2, 0);
    triangle.closePath();
    const mesh = new Mesh(
      new ExtrudeGeometry(triangle, { depth, bevelEnabled: false }),
      material
    );
    mesh.position.set(x, y, z - depth / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // scripts/castle-package/castleStructure.ts
  function curtain(group, length, x, z, rotation, m, height = 7) {
    const wall = new Group();
    wall.position.set(x, 0, z);
    wall.rotation.y = rotation;
    box(wall, length, height, 1.65, 0, height / 2 + 0.55, 0, m.stone);
    box(wall, length, 0.4, 2.15, 0, height + 0.55, 0, m.trim);
    box(wall, length, 0.7, 0.45, 0, height + 1, 0.8, m.stone);
    for (let i = 0.5; i < length; i += 1.55)
      box(wall, 0.8, 1.2, 0.6, i - length / 2, height + 1.65, 0.8, m.trim);
    for (let i = 3; i < length - 1; i += 4.8) {
      box(wall, 0.12, 1.3, 0.02, i - length / 2, height - 1.2, 0.84, m.dark);
      box(wall, 0.5, 0.12, 0.03, i - length / 2, height - 1.1, 0.85, m.dark);
    }
    group.add(wall);
  }
  function tower(group, x, z, m, height = 10.4, radius = 2.9) {
    cylinder(group, radius + 0.5, 1.8, x, 1.25, z, m.darkStone, radius);
    cylinder(group, radius, height, x, height / 2 + 0.55, z, m.stone);
    cylinder(group, radius + 0.16, 0.3, x, height + 0.5, z, m.trim);
    cylinder(group, radius - 0.34, 0.08, x, height + 0.69, z, m.darkStone);
    const ring = new Mesh(
      new TorusGeometry(radius - 0.15, 0.31, 4, 40),
      m.trim
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, height + 0.9, z);
    ring.castShadow = true;
    group.add(ring);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const merlon = box(
        group,
        0.9,
        1.15,
        0.65,
        x + Math.sin(a) * (radius - 0.2),
        height + 1.38,
        z + Math.cos(a) * (radius - 0.2),
        m.trim
      );
      merlon.rotation.y = a;
      if (i % 2 === 0) {
        const slot = box(
          group,
          0.14,
          1.55,
          0.03,
          x + Math.sin(a) * (radius + 0.015),
          height - 2.2,
          z + Math.cos(a) * (radius + 0.015),
          m.dark
        );
        slot.rotation.y = a;
      }
    }
  }
  function gatehouse(group, m) {
    tower(group, -4.5, 13, m, 11.1, 2.65);
    tower(group, 4.5, 13, m, 11.1, 2.65);
    const arch = new Shape();
    arch.moveTo(-2.8, 3.3);
    arch.lineTo(-2.8, 9.1);
    arch.lineTo(2.8, 9.1);
    arch.lineTo(2.8, 3.3);
    arch.lineTo(1.8, 3.3);
    arch.absarc(0, 3.3, 1.8, 0, Math.PI, false);
    arch.lineTo(-2.8, 3.3);
    const archMesh = new Mesh(
      new ExtrudeGeometry(arch, { depth: 3.2, bevelEnabled: false }),
      m.stone
    );
    archMesh.position.set(0, 0.55, 11.3);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    group.add(archMesh);
    box(group, 1.05, 3.3, 3.2, -2.32, 2.2, 12.9, m.stone);
    box(group, 1.05, 3.3, 3.2, 2.32, 2.2, 12.9, m.stone);
    box(group, 5.8, 0.35, 3.5, 0, 9.85, 12.9, m.trim);
    for (let x = -2.4; x <= 2.4; x += 1.2)
      box(group, 0.65, 1.1, 0.6, x, 10.55, 14.3, m.trim);
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * i / 10;
      const voussoir = box(
        group,
        0.45,
        0.58,
        0.18,
        Math.cos(a) * 2.05,
        3.85 + Math.sin(a) * 2.05,
        14.59,
        m.trim
      );
      voussoir.rotation.z = a - Math.PI / 2;
    }
    const gate = new Group();
    for (let x = -1.55; x <= 1.6; x += 0.39)
      box(gate, 0.1, 4.5, 0.12, x, 2.9, 14.5, m.iron);
    [1.1, 2.1, 3.1, 4.1].forEach(
      (y) => box(gate, 3.35, 0.12, 0.12, 0, y, 14.52, m.iron)
    );
    group.add(gate);
    return gate;
  }
  function buildings(group, m) {
    box(group, 8, 10.2, 7, -3.4, 5.65, -3.3, m.stone);
    box(group, 8.45, 0.4, 7.45, -3.4, 10.95, -3.3, m.trim);
    roof(group, 9.1, 8.2, 4.4, -3.4, 11.2, -3.3, m.roof);
    box(group, 0.25, 0.2, 8.5, -3.4, 15.65, -3.3, m.ridge);
    for (let j = 0; j < 8; j++) {
      const level = j / 8;
      const left = box(
        group,
        0.06,
        0.06,
        8.3,
        -7.95 + level * 4.55,
        11.28 + level * 4.4,
        -3.3,
        m.ridge
      );
      left.rotation.z = Math.PI / 4;
      box(
        group,
        0.06,
        0.06,
        8.3,
        1.15 - level * 4.55,
        11.28 + level * 4.4,
        -3.3,
        m.ridge
      );
    }
    [-5.8, -3.3, -0.8].forEach((x) => {
      [5.3, 8.4].forEach((y) => {
        box(group, 0.8, 1.65, 0.08, x, y, 0.24, m.trim);
        box(group, 0.48, 1.3, 0.1, x, y, 0.3, m.dark);
      });
    });
    box(group, 1.5, 2.8, 0.1, -3.4, 1.95, 0.29, m.timber);
    box(group, 5.5, 4.1, 9.5, 7.7, 2.6, -1.6, m.stone);
    roof(group, 6.4, 10.3, 2.7, 7.7, 4.7, -1.6, m.roof);
    box(group, 1.1, 3.5, 1, 8.5, 7, -4.4, m.stone);
    box(group, 1.2, 0.3, 1.2, 8.5, 8.85, -4.4, m.trim);
    for (let z = -5; z <= 2; z += 2.2)
      box(group, 0.08, 0.85, 0.45, 10.49, 3.1, z, m.dark);
    box(group, 4.4, 2.6, 6, -10.3, 1.9, 5.1, m.stone);
    roof(group, 5.1, 6.8, 1.8, -10.3, 3.3, 5.1, m.roof);
    cylinder(group, 1, 0.7, 3, 0.9, 4.7, m.stone);
    cylinder(group, 0.65, 0.02, 3, 1.26, 4.7, m.dark);
    [-0.9, 0.9].forEach(
      (x) => box(group, 0.15, 1.5, 0.15, 3 + x, 1.8, 4.7, m.timber)
    );
    roof(group, 2.5, 1.8, 0.8, 3, 2.6, 4.7, m.roof);
    [
      [-1, 7],
      [5.6, 6.9],
      [-8, -8],
      [1.2, 10]
    ].forEach(([x, z], i) => {
      cylinder(group, 0.18, 0.6, x, 1, z, i % 2 ? m.roof : m.timber, 0.13);
      cylinder(group, 0.12, 0.23, x, 1.43, z, m.trim);
    });
  }
  function createFortress(m) {
    const group = new Group(), curtains = new Group(), towers = new Group(), inner = new Group();
    curtain(curtains, 30, 0, -12, Math.PI, m);
    curtain(curtains, 24, -15, 0, -Math.PI / 2, m);
    curtain(curtains, 24, 15, 0, Math.PI / 2, m);
    curtain(curtains, 11, -9.5, 12, 0, m);
    curtain(curtains, 11, 9.5, 12, 0, m);
    [
      [-15, -12],
      [15, -12],
      [-15, 12],
      [15, 12]
    ].forEach(([x, z]) => tower(towers, x, z, m));
    curtain(inner, 22, 0, -9, Math.PI, m, 4.2);
    curtain(inner, 14, -11, -2, -Math.PI / 2, m, 4.2);
    curtain(inner, 14, 11, -2, Math.PI / 2, m, 4.2);
    curtain(inner, 8.5, -6.75, 5, 0, m, 4.2);
    curtain(inner, 8.5, 6.75, 5, 0, m, 4.2);
    const gate = gatehouse(group, m);
    buildings(group, m);
    group.add(curtains, towers, inner);
    return { group, curtains, towers, inner, gate };
  }

  // scripts/castle-package/castleState.ts
  var defaultCastleState = {
    moat: 22,
    towers: true,
    gate: true,
    inner: false,
    approach: "bridge",
    sight: false
  };
  var ditchSpan = (width) => width * 0.22;
  function castleObservation(state) {
    return state.approach === "bridge" ? state.gate ? "blocked by closed gate" : "reaches outer entrance" : state.moat > 0 ? "obstructed by ditch" : "reaches solid outer wall";
  }
  function routeEnd(state) {
    if (state.approach === "bridge") return state.gate ? 15.2 : 10;
    return state.moat > 0 ? -16.5 - ditchSpan(state.moat) : -13.8;
  }
  var wallHeightScale = (state) => Math.max(3, Math.min(18, state.wallHeightMeters ?? 14)) / 14;

  // scripts/castle-package/castleLandscape.ts
  function createLandscape(m) {
    const group = new Group(), ditch = new Group(), bridge = new Group();
    const base = new Mesh(
      new CylinderGeometry(40, 39, 1.8, 80),
      m.earth
    );
    base.scale.z = 0.86;
    base.position.y = -1.2;
    base.receiveShadow = true;
    group.add(base);
    const top = new Mesh(new CircleGeometry(40, 80), m.grass);
    top.rotation.x = -Math.PI / 2;
    top.scale.y = 0.86;
    top.position.y = -0.27;
    top.receiveShadow = true;
    group.add(top);
    box(group, 34.8, 0.85, 28.8, 0, 0.03, 0, m.bank);
    box(group, 28, 0.08, 22, 0, 0.5, 0, m.paving);
    const joint = new LineBasicMaterial({
      color: 7827290,
      transparent: true,
      opacity: 0.24
    });
    for (let x = -13; x < 14; x += 2)
      line(
        group,
        [
          [x, 0.55, -10.7],
          [x, 0.55, 10.7]
        ],
        joint
      );
    for (let z = -10; z < 11; z += 2)
      line(
        group,
        [
          [-13.7, 0.55, z],
          [13.7, 0.55, z]
        ],
        joint
      );
    box(group, 3.8, 0.05, 20, 0, -0.19, 25, m.path);
    box(group, 2.9, 0.05, 20, 0, -0.19, -25, m.path);
    for (let i = 0; i < 37; i++) {
      const a = i * 2.3999, radius = 29 + i % 4 * 1.9;
      const x = Math.sin(a) * radius, z = Math.cos(a) * radius * 0.84;
      if (Math.abs(x) < 5 || Math.abs(x) < 25 && Math.abs(z) < 25) continue;
      const height = 2 + i % 5 * 0.45;
      cylinder(group, 0.17, height * 0.8, x, height * 0.3, z, m.timber);
      for (let j = 0; j < 3; j++) {
        const crown = new Mesh(
          new IcosahedronGeometry(height * 0.52, 1),
          m.leaves[(i + j) % 3]
        );
        crown.position.set(
          x + Math.sin(j * 2) * 0.65,
          height * 0.75 + j * 0.3,
          z + Math.cos(j * 2) * 0.5
        );
        crown.scale.y = 1.25;
        crown.castShadow = true;
        group.add(crown);
      }
    }
    box(bridge, 3.5, 0.32, 1, 0, 0.76, 0.5, m.timber);
    for (let i = 0; i < 22; i++)
      box(bridge, 3.6, 0.08, 0.018, 0, 0.97, (i + 0.5) / 22, m.path);
    [-1.7, 1.7].forEach((x) => {
      box(bridge, 0.12, 0.18, 1, x, 1.14, 0.5, m.timber);
      [0, 0.25, 0.5, 0.75, 1].forEach(
        (z) => box(bridge, 0.13, 0.75, 0.02, x, 1.23, z, m.timber)
      );
    });
    bridge.position.z = 14.7;
    group.add(ditch, bridge);
    return { group, ditch, bridge, joint };
  }
  function updateLandscape(ditch, bridge, state, m) {
    const span = ditchSpan(state.moat);
    if (span > 0) {
      const outerX = 17.4 + span, outerZ = 14.4 + span;
      box(ditch, outerX * 2, 0.1, span, 0, -0.12, -14.4 - span / 2, m.water);
      box(ditch, outerX * 2, 0.1, span, 0, -0.12, 14.4 + span / 2, m.water);
      box(ditch, span, 0.1, 28.8, -17.4 - span / 2, -0.12, 0, m.water);
      box(ditch, span, 0.1, 28.8, 17.4 + span / 2, -0.12, 0, m.water);
      [
        [outerX * 2 + 1, 0.55, 0, outerZ],
        [outerX * 2 + 1, 0.55, 0, -outerZ],
        [0.55, outerZ * 2, outerX, 0],
        [0.55, outerZ * 2, -outerX, 0]
      ].forEach(
        ([width, depth, x, z]) => box(ditch, width, 0.25, depth, x, -0.02, z, m.bank)
      );
      for (let i = 0; i < 26; i++) {
        const x = -outerX + 1 + i * 3.73 % (outerX * 2 - 2);
        const z = (i % 2 ? 1 : -1) * (14.8 + i % 4 * span / 5);
        box(ditch, 0.8 + i % 3, 0.015, 0.025, x, -0.05, z, m.ridge);
      }
    }
    bridge.scale.z = Math.max(4.2, span + 2);
    [-1.65, 1.65].forEach(
      (x) => line(
        ditch,
        [
          [x, 5.5, 14.5],
          [x, 1.12, 14.7 + bridge.scale.z * 0.65]
        ],
        m.ray
      )
    );
  }
  function createEvidence(state, m) {
    const group = new Group(), end = routeEnd(state), start = state.approach === "bridge" ? 32 : -31;
    const direction = Math.sign(end - start);
    for (let z = start; direction > 0 ? z < end : z > end; z += direction * 0.9) {
      box(
        group,
        0.1,
        0.05,
        0.45,
        0,
        state.approach === "bridge" ? 1.04 : 0.48,
        z,
        m.gold
      );
    }
    const marker = new Mesh(
      new TorusGeometry(0.42, 0.065, 8, 32),
      m.gold
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(0, state.approach === "bridge" ? 1.09 : 0.49, end);
    group.add(marker);
    if (state.sight) {
      const height = (y) => 0.55 + (y - 0.55) * wallHeightScale(state);
      const rays = state.towers ? [
        [
          [18, height(10.4), 12],
          [18, height(2.8), -6]
        ],
        [
          [15, height(10.4), 15],
          [7, height(2.8), 15]
        ]
      ] : [
        [
          [16, height(8.1), 10],
          [24, 1, 10]
        ]
      ];
      rays.forEach(
        (points) => line(group, points, m.sightOverlay).computeLineDistances()
      );
    }
    return group;
  }

  // scripts/castle-package/castleMaterials.ts
  function masonryTexture() {
    const canvas = new TextureCanvas();
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    context.fillStyle = "#746d5c";
    context.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 16; row++) {
      for (let col = -1; col < 9; col++) {
        const noise = (row * 73 + col * 43 + 517) % 29;
        const x = col * 64 + row % 2 * 32;
        context.fillStyle = `rgb(${153 + noise},${146 + noise},${126 + noise})`;
        context.fillRect(x + 1, row * 32 + 1, 61, 29);
        context.fillStyle = "#e0d6bd55";
        context.fillRect(x + 3, row * 32 + 2, 58, 1);
        for (let mark = 0; mark < 18; mark++) {
          context.fillStyle = mark % 2 ? "#453c2922" : "#f9ebd722";
          context.fillRect(
            x + (mark * 17 + row * 7) % 60,
            row * 32 + mark * 11 % 29,
            2,
            1
          );
        }
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.colorSpace = SRGBColorSpace;
    texture.repeat.set(2, 1.5);
    texture.anisotropy = 4;
    return texture;
  }
  function castleMaterials() {
    const texture = masonryTexture();
    const stone = new MeshStandardMaterial({
      map: texture,
      bumpMap: texture,
      bumpScale: 0.045,
      roughness: 0.93,
      color: 13946036
    });
    const plain = (color, roughness = 0.9) => new MeshStandardMaterial({ color, roughness });
    return {
      stone,
      trim: plain(12827297),
      darkStone: plain(9341302),
      roof: plain(5923426),
      ridge: plain(8751744),
      timber: plain(7557684),
      iron: plain(3423033, 0.65),
      dark: plain(2895911),
      grass: plain(6583116),
      bank: plain(7303763),
      earth: plain(5000764),
      water: new MeshStandardMaterial({
        color: 4226427,
        roughness: 0.32,
        metalness: 0.22
      }),
      paving: plain(10195576),
      path: plain(12692350),
      leaves: [plain(4216894), plain(5466182), plain(6847307)],
      sightOverlay: new LineDashedMaterial({
        color: 5826798,
        dashSize: 0.8,
        gapSize: 0.6,
        transparent: true,
        opacity: 0.9
      }),
      gold: new MeshBasicMaterial({ color: 16765818 }),
      ray: new LineBasicMaterial({
        color: 16306824,
        transparent: true,
        opacity: 0.65
      }),
      dispose() {
        texture.dispose();
        Object.values(this).forEach((value) => {
          if (value instanceof Material) value.dispose();
          if (Array.isArray(value))
            value.forEach((material) => material.dispose());
        });
      }
    };
  }

  // scripts/castle-package/castle-worker.ts
  var topic = "routes";
  var prediction = null;
  var tested = false;
  var modelNote = "13th-century English-inspired composite, not a reconstruction. Dimensions are schematic; ditch width is compressed in the view. Ditches could be wet or dry. Sight lines illustrate positions, not weapon ranges. Routes and visibility do not predict a siege result.";
  function run(input) {
    if (input.type === "reset") {
      topic = "routes";
      prediction = null;
      tested = false;
    }
    const values = input.type === "reset" ? {} : input.values;
    const state = {
      ...defaultCastleState,
      moat: values.moat ?? 22,
      towers: (values.towers ?? 1) === 1,
      gate: (values.gate ?? 1) === 1,
      inner: (values.inner ?? 0) === 1,
      approach: values.approach === 1 ? "north" : "bridge",
      sight: (values.sight ?? 0) === 1
    };
    if (input.control === "compareRoutes" || input.control === "compareViews") {
      topic = input.control === "compareRoutes" ? "routes" : "views";
      prediction = null;
      tested = false;
    } else if (input.control === "predictYes" || input.control === "predictNo") {
      prediction = input.control === "predictYes" ? "Yes" : "No";
      tested = false;
    } else if (input.control === "testPrediction") {
      if (topic === "routes") {
        state.moat = 22;
        state.gate = false;
        state.approach = tested && state.approach === "bridge" ? "north" : "bridge";
      } else {
        state.towers = tested ? !state.towers : false;
        state.sight = true;
      }
      tested = true;
    }
    resetResources();
    resetVectorIds();
    const material = castleMaterials(), fortress = createFortress(material), landscape = createLandscape(material);
    fortress.towers.visible = state.towers;
    fortress.inner.visible = state.inner;
    fortress.gate.position.y = state.gate ? 0 : 4.9;
    updateLandscape(landscape.ditch, landscape.bridge, state, material);
    const evidence = createEvidence(state, material);
    const observation = castleObservation(state);
    const question = topic === "routes" ? "Does opening the gate open both approaches?" : "Can a flat wall give the same view along its base as a projecting tower?";
    const action = topic === "routes" ? "Open the gate. Compare the bridge with the north route, keeping the ditch at 22 m." : "Keep the route and ditch fixed. Remove the corner towers, then add them back. Follow the dashed sight-line overlay at the front corner.";
    const explain = tested ? topic === "routes" ? "The bridge reaches the open entrance. On the north side, the ditch still interrupts the route. Even without a ditch, that route meets a solid wall, not a doorway. Why does an entrance need extra protection?" : "A tower projects beyond the wall, giving an observer a position to look along its outside face. The lines show possible views, not weapon range or a guaranteed defense. Why does standing farther out change what is visible?" : topic === "routes" ? "What still stops the north approach when the gate is open? Use the route endpoint as evidence." : "Which part of the wall can an observer on a projecting tower see? Compare the lines with and without towers.";
    const toggle = (id, label, checked) => ({ id, label, kind: "toggle", min: 0, max: 1, step: 1, value: checked ? 1 : 0 });
    return {
      animate: false,
      shapes: [],
      fallbackVector: { viewBox: [0, 0, 720, 420], description: `Castle plan: ${observation}`, nodes: [CastleDrawing(state)] },
      description: `${state.moat} m ditch; ${state.gate ? "closed" : "raised"} portcullis; ${state.towers ? "four projecting corner towers" : "no projecting corner towers"}; ${state.inner ? "an additional inner wall" : "one outer wall"}. The ${state.approach} route ${observation}. ${state.towers ? "Projecting towers give views along adjoining walls." : "Without projecting towers, wall-side visibility is reduced."} ${state.inner ? "The inner wall adds another barrier; it does not make the castle invincible." : ""}`,
      sections: [{ heading: "1. Predict", text: `${question}${prediction ? ` Your prediction: ${prediction}.` : ""}`, buttonIds: ["predictYes", "predictNo"] }, { heading: "2. Compare", text: action, buttonIds: ["testPrediction"] }, { heading: "3. Explain", text: explain }],
      footnote: modelNote,
      controls: [
        { id: "approach", label: "Approach route", kind: "select", min: 0, max: 1, step: 1, value: state.approach === "bridge" ? 0 : 1, options: [{ value: 0, label: "Bridge and gate" }, { value: 1, label: "Across the north ditch" }] },
        { id: "moat", label: "Ditch width (m)", min: 0, max: 36, step: 1, value: state.moat },
        toggle("gate", "Close gate", state.gate),
        toggle("towers", "Projecting towers", state.towers),
        toggle("inner", "Inner wall", state.inner),
        toggle("sight", "Sight-line overlay (not structures)", state.sight)
      ],
      buttons: [
        { id: "compareRoutes", label: "Compare routes" },
        { id: "compareViews", label: "Compare sight lines" },
        { id: "predictYes", label: "Predict yes" },
        { id: "predictNo", label: "Predict no" },
        { id: "testPrediction", label: topic === "routes" ? tested && state.approach === "bridge" ? "Compare north route" : "Test open gate" : tested && !state.towers ? "Restore towers" : "Remove corner towers" }
      ],
      scene3d: {
        ...resources(),
        nodes: [landscape.group.record(), fortress.group.record(), evidence.record()],
        camera: {
          target: [0, 3.2, 0],
          radius: 80,
          yaw: 0.62,
          elevation: 0.7,
          zoom: 1,
          halfHeight: 21.5,
          narrowHalfWidth: 28,
          narrowAspect: 1.25,
          presets: [{ id: "courtyard", label: "Courtyard", yaw: 0.62, elevation: 0.7, zoom: 1 }, { id: "entrance", label: "Entrance", yaw: 0.1, elevation: 0.3, zoom: 1.15 }, { id: "north", label: "North wall", yaw: Math.PI + 0.3, elevation: 0.7, zoom: 1 }, { id: "overhead", label: "Above", yaw: 0.62, elevation: 1.42, zoom: 1 }]
        },
        lighting: { hemisphere: { sky: 15200483, ground: 6578507, intensity: 2.2 }, directional: [{ color: 16770232, intensity: 3.1, position: [-32, 60, 35], shadow: { size: 2048, extent: 48, near: 1, far: 130, bias: -3e-4, normalBias: 0.06, radius: 3 } }, { color: 12112603, intensity: 0.5, position: [25, 16, -25] }] },
        labels: [{ text: "Keep", position: [-3.4, 16, -3.3] }, { text: "Gatehouse", position: [4.5, 12.8, 13] }, { text: state.towers ? "Projecting tower" : "Curtain wall", position: [-15, state.towers ? 12 : 8, 12] }],
        presentation: { title: "What blocks the approach?", subtitle: "Compare the entrance with a route toward a solid wall.", route: `${state.approach === "bridge" ? "Bridge route" : "North route"} \xB7 ${observation}`, background: ["#e7e8db", "#d5d9c9", "#b7c0ad"] }
      }
    };
  }
  self.onmessage = ({ data }) => self.postMessage(run(data));
})();
