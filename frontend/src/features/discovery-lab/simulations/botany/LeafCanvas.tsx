import { useEffect, useRef, useState } from "react";
import {
  createLeafScene,
  type LeafState,
  type LeafLabel,
} from "./createLeafScene";
import { BotanicalLeaf } from "../PhysicalArt";
export function LeafCanvas(props: LeafState) {
  const { light, water, carbon, rate } = props;
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<ReturnType<typeof createLeafScene>>(null);
  const [available, setAvailable] = useState(true);
  const [labels, setLabels] = useState<LeafLabel[]>([]);
  useEffect(() => {
    if (host.current) {
      scene.current = createLeafScene(host.current, setLabels, () => {
        scene.current?.dispose();
        scene.current = null;
        setAvailable(false);
      });
      setAvailable(Boolean(scene.current));
    }
    return () => scene.current?.dispose();
  }, []);
  useEffect(() => {
    scene.current?.setState({ light, water, carbon, rate });
  }, [light, water, carbon, rate]);
  return (
    <div className="leaf-model">
      <div
        className="leaf-canvas"
        ref={host}
        role="img"
        aria-label={`Magnified leaf section with chloroplast-containing cells and water transport. Relative photosynthesis activity ${Math.round(props.rate)} out of 100.`}
      />
      {!available && (
        <div className="leaf-fallback">
          <svg viewBox="0 0 720 420" aria-hidden="true">
            <BotanicalLeaf />
            <circle
              cx="115"
              cy="105"
              r="30"
              fill="#ffe19a"
              opacity={0.15 + props.light / 120}
            />
            <text x="190" y="370" fill="#e8f4df" fontSize="20">
              Relative activity: {Math.round(props.rate)} / 100
            </text>
          </svg>
          <p>
            3D rendering is unavailable. The diagram and resource controls
            remain available.
          </p>
        </div>
      )}
      {available && (
        <div className="leaf-callouts">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {labels.map((label) => (
              <line
                key={label.id}
                x1={label.x}
                y1={label.y}
                x2={label.left}
                y2={label.top}
              />
            ))}
          </svg>
          {labels.map((label) => (
            <span
              key={label.id}
              style={{ left: `${label.left}%`, top: `${label.top}%` }}
            >
              {label.text}
            </span>
          ))}
        </div>
      )}
      <div className="leaf-labels">
        <span>Leaf</span>
        <span>Magnified tissue: chloroplasts inside cells</span>
      </div>
      <div className="leaf-key">
        <span>
          <i style={{ background: "#5cb8cd" }} />
          Water transport
        </span>
        <span>
          <i style={{ background: "#e6c883" }} />
          Sugar transport
        </span>
        <span>
          <i style={{ background: "#d7dfda" }} />
          Carbon dioxide in
        </span>
        <span>
          <i style={{ background: "#f4bcac" }} />
          Oxygen out
        </span>
      </div>
      <p className="leaf-process">
        Light + water + carbon dioxide → sugar + oxygen
      </p>
      <p className="leaf-scale">
        Schematic cutaway. Cell layers and organelles use different display
        scales.
      </p>
    </div>
  );
}
