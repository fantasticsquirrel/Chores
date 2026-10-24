/** Worker-side resource transport cache; full scene state is still validated by the host. */
export function createFrameCompactor() {
  let previous: Record<string, string> = {};
  return <T extends { scene3d?: any }>(frame: T, reset = false): T => {
    if (!frame.scene3d) return frame;
    const scene = { ...frame.scene3d };
    const next: Record<string, string> = {};
    for (const key of ["geometries", "materials", "textures"])
      next[key] = JSON.stringify(scene[key]);
    if (!reset && previous.geometries) {
      scene.reuseResources = true;
      for (const key of ["geometries", "materials", "textures"])
        if (next[key] === previous[key]) delete scene[key];
    }
    previous = next;
    return { ...frame, scene3d: scene };
  };
}
