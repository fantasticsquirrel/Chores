/* Classic worker: deterministic time scrubbing, no imports or browser access. */
self.onmessage = ({ data }) => {
  const defaults = { length: 1, mass: 1, time: 0 };
  const values =
    data.type === "reset" ? defaults : { ...defaults, ...data.values };
  const length = Math.max(0.5, Math.min(2, values.length));
  const mass = Math.max(0.5, Math.min(2, values.mass));
  const time = Math.max(0, Math.min(10, values.time));
  const omega = Math.sqrt(9.81 / length);
  const period = (2 * Math.PI) / omega;
  const angle = ((10 * Math.PI) / 180) * Math.cos(omega * time);
  const degrees = (angle * 180) / Math.PI;
  const line = (x, y, x2, y2, stroke = "#91a4c9", width = 2) => ({
    kind: "line",
    x,
    y,
    x2,
    y2,
    stroke,
    width,
  });
  const text = (x, y, value, fill = "#e8eefc", size = 16) => ({
    kind: "text",
    x,
    y,
    text: value,
    fill,
    size,
  });
  const shapes = [
    { kind: "rect", x: 0, y: 0, width: 800, height: 480, fill: "#111c35" },
    { kind: "rect", x: 18, y: 18, width: 310, height: 355, fill: "#1c2b49" },
    { kind: "rect", x: 346, y: 18, width: 436, height: 355, fill: "#1c2b49" },
    text(36, 48, "Pendulum position"),
    text(366, 48, "Angle over 10 seconds"),
    line(173, 80, 173, 330, "#566988", 1),
    line(133, 78, 213, 78, "#b7c6df", 5),
  ];
  // 112 display units per metre; bob radius represents mass, not physical size.
  const radius = 112 * length;
  const x = 173 + radius * Math.sin(angle);
  const y = 80 + radius * Math.cos(angle);
  shapes.push(line(173, 80, x, y, "#e5edf7", 3));
  shapes.push({ kind: "circle", x, y, r: 10 + mass * 5, fill: "#f6c56a" });
  shapes.push({ kind: "circle", x: 173, y: 80, r: 5, fill: "#e5edf7" });
  shapes.push(
    text(36, 350, `${length.toFixed(1)} m string; ${mass.toFixed(1)} kg bob`),
  );
  const left = 400,
    right = 750,
    mid = 192,
    amplitude = 82;
  for (const value of [-10, 0, 10]) {
    const yy = mid - (value * amplitude) / 10;
    shapes.push(line(left, yy, right, yy, "#3c506e", 1));
    shapes.push(text(359, yy + 5, `${value}°`, "#c3cee4", 14));
  }
  for (let tick = 0; tick <= 10; tick += 2) {
    const xx = left + (tick * (right - left)) / 10;
    shapes.push(line(xx, 102, xx, 282, "#3c506e", 1));
    shapes.push(text(xx - 5, 310, `${tick}`, "#c3cee4", 14));
  }
  shapes.push(text(515, 346, "Time (seconds)", "#c3cee4", 14));
  for (let i = 0; i < 100; i += 1) {
    const t1 = i / 10,
      t2 = (i + 1) / 10;
    shapes.push(
      line(
        left + i * 3.5,
        mid - amplitude * Math.cos(omega * t1),
        left + (i + 1) * 3.5,
        mid - amplitude * Math.cos(omega * t2),
        "#66d5e5",
        2,
      ),
    );
  }
  const markerX = left + time * 35;
  const markerY = mid - amplitude * Math.cos(omega * time);
  shapes.push(line(markerX, 102, markerX, 282, "#f6c56a", 2));
  shapes.push({
    kind: "circle",
    x: markerX,
    y: markerY,
    r: 5,
    fill: "#f6c56a",
  });
  shapes.push(text(24, 406, `Period: ${period.toFixed(2)} s`));
  shapes.push(text(274, 406, `Time: ${time.toFixed(1)} s`));
  shapes.push(text(504, 406, `Cycles: ${(time / period).toFixed(2)}`));
  shapes.push(
    text(
      24,
      440,
      "Move Time to compare positions. Release angle 10°; no friction.",
      "#c3cee4",
      15,
    ),
  );
  self.postMessage({
    animate: false,
    description: `At ${time.toFixed(1)} seconds, the ${length.toFixed(1)} metre pendulum with a ${mass.toFixed(1)} kilogram bob is at ${degrees.toFixed(1)} degrees from vertical. Its period is ${period.toFixed(2)} seconds, and ${(time / period).toFixed(2)} cycles have elapsed. The curve shows angle against time; the marked point matches the bob. Changing mass does not alter the curve. Bob size indicates mass only; the diagram is schematic. Move Time to inspect motion.`,
    shapes,
    controls: [
      {
        id: "length",
        label: "Length (m)",
        min: 0.5,
        max: 2,
        step: 0.1,
        value: length,
      },
      {
        id: "mass",
        label: "Mass (kg)",
        min: 0.5,
        max: 2,
        step: 0.1,
        value: mass,
      },
      {
        id: "time",
        label: "Time (s)",
        min: 0,
        max: 10,
        step: 0.1,
        value: time,
      },
    ],
  });
};
