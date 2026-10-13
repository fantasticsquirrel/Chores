import type { LayoutResult } from "@family-manager/family-tree-core";
import {
  displayRoutePoints,
  edgeDash,
  routeLabelPoint,
} from "../lib/presentation/viewport";

export function TreeEdges({ layout }: { layout: LayoutResult }) {
  return (
    <svg className="family-tree-edges" width="1" height="1" aria-hidden="true">
      {layout.routes.map((route) => {
        const points = displayRoutePoints(route)
          .map((point) => `${point.x},${point.y}`)
          .join(" ");
        const labelPoint = routeLabelPoint(route);
        return (
          <g
            key={route.key}
            data-edge-key={route.key}
            data-pattern={route.pattern}
          >
            <title>{route.label}</title>
            <polyline
              points={points}
              className="family-tree-edge"
              strokeWidth={route.pattern === "double" ? 6 : 2}
              strokeDasharray={edgeDash[route.pattern]}
            />
            {route.pattern === "double" && (
              <polyline
                points={points}
                className="family-tree-edge-inner"
                strokeWidth="2"
              />
            )}
            <text
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              className="family-tree-edge-label"
            >
              {route.label}
            </text>
          </g>
        );
      })}
      {layout.junctions.map((junction) => (
        <g key={junction.id} data-junction-id={junction.id}>
          <title>{junction.label}</title>
          <circle
            cx={junction.x}
            cy={junction.y}
            r="5"
            className="family-tree-junction"
          />
        </g>
      ))}
    </svg>
  );
}
