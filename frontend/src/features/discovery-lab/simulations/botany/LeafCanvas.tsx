import { useId, type CSSProperties } from "react";
import type { LeafState } from "./createLeafScene";

function flowStyle(level: number) {
  return {
    "--leaf-flow-opacity": Math.max(0.14, level / 100),
    "--leaf-flow-width": `${3 + level / 24}px`,
  } as CSSProperties;
}

function FlowLabel({
  x,
  y,
  width,
  title,
  detail,
  className = "",
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  detail: string;
  className?: string;
}) {
  return (
    <g
      className={`leaf-flow-label ${className}`}
      transform={`translate(${x} ${y})`}
    >
      <rect width={width} height="50" rx="12" />
      <text x="14" y="21" className="leaf-flow-label-title">
        {title}
      </text>
      <text x="14" y="39" className="leaf-flow-label-detail">
        {detail}
      </text>
    </g>
  );
}

export function LeafCanvas(props: LeafState & { limitingLabel?: string }) {
  const { light, water, carbon, rate } = props;
  const id = useId().replace(/:/g, "");
  const roundedRate = Math.round(rate);
  const label = `Leaf process diagram. Light energy ${Math.round(light)} percent enters the leaf. Water ${Math.round(water)} percent enters through a vein and carbon dioxide ${Math.round(carbon)} percent enters through a stoma. Chloroplast activity index ${roundedRate} out of 100. Sugars and oxygen are outputs. The oxygen released comes from water.${props.limitingLabel ? ` Model limit or limits: ${props.limitingLabel}.` : ""}`;

  return (
    <div
      className="leaf-model leaf-process-graphic"
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 840 470" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8fbd68" />
            <stop offset=".55" stopColor="#5f994f" />
            <stop offset="1" stopColor="#3c7444" />
          </linearGradient>
          <linearGradient id={`${id}-cell`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dceab7" />
            <stop offset="1" stopColor="#b9d98f" />
          </linearGradient>
          <linearGradient id={`${id}-chloroplast`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7fbd54" />
            <stop offset="1" stopColor="#2f7240" />
          </linearGradient>
          <clipPath id={`${id}-lens`}>
            <circle cx="612" cy="244" r="146" />
          </clipPath>
          <filter
            id={`${id}-shadow`}
            x="-30%"
            y="-30%"
            width="170%"
            height="180%"
          >
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="10"
              floodColor="#244735"
              floodOpacity=".18"
            />
          </filter>
          <filter
            id={`${id}-glow`}
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
          >
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id={`${id}-energy-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10Z" fill="#c79424" />
          </marker>
          <marker
            id={`${id}-water-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10Z" fill="#2f87a1" />
          </marker>
          <marker
            id={`${id}-matter-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10Z" fill="#5c6d6a" />
          </marker>
          <marker
            id={`${id}-sugar-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10Z" fill="#a06b34" />
          </marker>
          <marker
            id={`${id}-oxygen-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10Z" fill="#bc645e" />
          </marker>
        </defs>

        <rect
          x="8"
          y="8"
          width="824"
          height="454"
          rx="28"
          className="leaf-diagram-backdrop"
        />

        <g
          className="leaf-energy-flow leaf-state-flow"
          data-testid="leaf-light-flow"
          data-flow-kind="energy"
          data-level={Math.round(light)}
          style={flowStyle(light)}
        >
          <path d="M78 40L176 132" markerEnd={`url(#${id}-energy-arrow)`} />
          <path d="M128 24L216 118" markerEnd={`url(#${id}-energy-arrow)`} />
          <path d="M186 30L255 116" markerEnd={`url(#${id}-energy-arrow)`} />
          <FlowLabel
            x={30}
            y={76}
            width={128}
            title="LIGHT ENERGY"
            detail={`${Math.round(light)}% setting`}
            className="leaf-energy-label"
          />
        </g>

        <g filter={`url(#${id}-shadow)`}>
          <path
            className="leaf-blade"
            d="M74 248C147 105 346 82 515 194C418 348 218 374 74 248Z"
            fill={`url(#${id}-leaf)`}
          />
          <path className="leaf-midrib" d="M86 250C211 240 344 222 493 198" />
          <path
            className="leaf-vein"
            d="M180 237L143 177M229 229L193 155M280 221L260 139M335 212L334 132M386 205L410 151"
          />
          <path
            className="leaf-vein"
            d="M183 240L143 296M235 232L201 320M289 224L274 335M346 216L349 326M401 207L430 291"
          />
          <path className="leaf-petiole" d="M78 249C50 270 33 293 19 322" />
        </g>

        <g
          className="leaf-water-flow leaf-state-flow"
          data-testid="leaf-water-flow"
          data-flow-kind="matter"
          data-level={Math.round(water)}
          style={flowStyle(water)}
        >
          <path
            d="M18 356C70 331 81 285 126 258C205 244 288 230 370 216"
            markerEnd={`url(#${id}-water-arrow)`}
          />
          <FlowLabel
            x={28}
            y={365}
            width={136}
            title="WATER IN"
            detail={`${Math.round(water)}% setting`}
          />
        </g>

        <path
          className="leaf-magnify-link"
          d="M422 162C464 120 510 99 558 96M431 314C481 347 522 369 566 384"
        />
        <circle cx="612" cy="244" r="153" className="leaf-lens-ring" />
        <g clipPath={`url(#${id}-lens)`}>
          <rect
            x="460"
            y="91"
            width="304"
            height="306"
            className="leaf-lens-background"
          />
          <path
            d="M455 139C524 126 688 128 770 146V176H455Z"
            className="leaf-epidermis"
          />
          <path
            d="M455 315C542 303 687 305 770 321V350C679 367 534 364 455 348Z"
            className="leaf-epidermis"
          />
          {[486, 535, 584, 633, 682, 731].map((x) => (
            <rect
              key={x}
              x={x}
              y="170"
              width="40"
              height="103"
              rx="18"
              fill={`url(#${id}-cell)`}
              className="leaf-palisade-cell"
            />
          ))}
          {[493, 548, 610, 675, 726].map((x, index) => (
            <ellipse
              key={x}
              cx={x}
              cy={288 + (index % 2) * 18}
              rx="31"
              ry="23"
              className="leaf-spongy-cell"
            />
          ))}
          <path
            d="M573 334C587 310 604 310 618 334C606 351 587 351 573 334ZM622 334C636 310 653 310 667 334C654 351 635 351 622 334Z"
            className="leaf-guard-cells"
          />
          <ellipse cx="620" cy="337" rx="8" ry="21" className="leaf-stoma" />
          <g className="leaf-cell-focus">
            <rect x="557" y="178" width="124" height="94" rx="22" />
            <g
              data-testid="leaf-chloroplast"
              data-activity={roundedRate}
              className="leaf-chloroplast"
              style={
                {
                  "--leaf-activity": Math.max(0.12, rate / 100),
                } as CSSProperties
              }
              filter={`url(#${id}-glow)`}
            >
              <ellipse
                cx="619"
                cy="225"
                rx="45"
                ry="24"
                fill={`url(#${id}-chloroplast)`}
              />
              <path d="M588 219C603 208 631 208 650 220M590 230C609 240 633 239 650 229" />
            </g>
          </g>
        </g>

        <g
          className="leaf-carbon-flow leaf-state-flow"
          data-testid="leaf-carbon-flow"
          data-flow-kind="matter"
          data-level={Math.round(carbon)}
          style={flowStyle(carbon)}
        >
          <path
            d="M808 411C759 396 708 374 648 342"
            markerEnd={`url(#${id}-matter-arrow)`}
          />
          <FlowLabel
            x={684}
            y={400}
            width={130}
            title="CO₂ IN"
            detail={`${Math.round(carbon)}% setting`}
          />
        </g>

        <g
          className="leaf-sugar-flow leaf-state-flow"
          data-testid="leaf-sugar-output"
          data-flow-kind="matter"
          data-level={roundedRate}
          style={flowStyle(rate)}
        >
          <path
            d="M581 240C527 259 470 285 410 321C354 350 306 365 246 376"
            markerEnd={`url(#${id}-sugar-arrow)`}
          />
          <FlowLabel
            x={185}
            y={374}
            width={154}
            title="SUGARS OUT"
            detail={`activity ${roundedRate} / 100`}
          />
        </g>

        <g
          className="leaf-oxygen-flow leaf-state-flow"
          data-testid="leaf-oxygen-output"
          data-flow-kind="matter"
          data-level={roundedRate}
          style={flowStyle(rate)}
        >
          <path
            d="M655 334C704 302 750 271 807 240"
            markerEnd={`url(#${id}-oxygen-arrow)`}
          />
          <FlowLabel
            x={693}
            y={174}
            width={126}
            title="O₂ OUT"
            detail="from water"
          />
        </g>

        <g className="leaf-structure-label" transform="translate(498 106)">
          <rect width="118" height="34" rx="9" />
          <text x="12" y="22">
            Leaf tissue
          </text>
        </g>
        <path className="leaf-structure-leader" d="M614 139L634 171" />
        <g className="leaf-structure-label" transform="translate(541 278)">
          <rect width="112" height="34" rx="9" />
          <text x="12" y="22">
            Chloroplast
          </text>
        </g>
        <path className="leaf-structure-leader" d="M603 278L617 248" />
        <g className="leaf-structure-label" transform="translate(510 353)">
          <rect width="93" height="34" rx="9" />
          <text x="12" y="22">
            Stoma
          </text>
        </g>
        <path className="leaf-structure-leader" d="M603 365L619 347" />

        <g className="leaf-process-core" transform="translate(465 36)">
          <rect width="338" height="45" rx="13" />
          <text x="169" y="19" textAnchor="middle">
            CHLOROPLAST PROCESS
          </text>
          <text x="169" y="36" textAnchor="middle">
            light energy helps make sugars from water + CO₂
          </text>
        </g>
      </svg>
      <div className="leaf-mobile-flow-key" aria-hidden="true">
        <span className="leaf-key-energy">
          Light energy in <strong>{Math.round(light)}%</strong>
        </span>
        <span className="leaf-key-water">
          Water in <strong>{Math.round(water)}%</strong>
        </span>
        <span className="leaf-key-carbon">
          CO₂ in <strong>{Math.round(carbon)}%</strong>
        </span>
        <span className="leaf-key-sugar">
          Sugars out <strong>{roundedRate}/100</strong>
        </span>
        <span className="leaf-key-oxygen">
          O₂ out <strong>from water</strong>
        </span>
      </div>
      <p className="leaf-scale">
        Schematic: tissue, cells, chloroplast and transport paths are not to one
        scale.
      </p>
    </div>
  );
}
