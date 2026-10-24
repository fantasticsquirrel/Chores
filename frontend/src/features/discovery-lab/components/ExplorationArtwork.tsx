import { useId } from "react";
import { ExpansionArtwork } from "./ExpansionArtwork";
import { ExtendedArtwork } from "./ExtendedArtwork";

/** Small, deterministic illustrations: no remote images or child data requests. */
export function ExplorationArtwork({ id }: { id: string }) {
  const uid = useId().replace(/:/g, "");
  const space = ["orbital-mechanics", "solar-system", "moon-phases"].includes(
    id,
  );
  return (
    <svg
      className="discovery-artwork"
      viewBox="0 0 360 210"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${uid}-bg`}>
          <stop stopColor="#253761" />
          <stop offset="1" stopColor="#101b36" />
        </radialGradient>
        <radialGradient id={`${uid}-planet`} cx="30%" cy="25%">
          <stop stopColor="#a5eee6" />
          <stop offset=".55" stopColor="#41aaa9" />
          <stop offset="1" stopColor="#163e68" />
        </radialGradient>
        <linearGradient id={`${uid}-leaf`} x2="1" y2="1">
          <stop stopColor="#a5efb2" />
          <stop offset="1" stopColor="#26897b" />
        </linearGradient>
      </defs>
      <rect width="360" height="210" fill={`url(#${uid}-bg)`} />
      {space &&
        [...Array(22)].map((_, i) => (
          <circle
            key={i}
            cx={(i * 79 + 17) % 360}
            cy={(i * 43 + 13) % 210}
            r={i % 3 === 0 ? 1.5 : 0.7}
            fill="#c8dafa"
            opacity={0.25 + (i % 4) * 0.12}
          />
        ))}
      {space && (
        <>
          <ellipse
            cx="180"
            cy="111"
            rx="130"
            ry="51"
            fill="none"
            stroke="#91b4db"
            opacity=".3"
            transform="rotate(-18 180 111)"
          />
          <ellipse
            cx="180"
            cy="111"
            rx="92"
            ry="35"
            fill="none"
            stroke="#91b4db"
            opacity=".3"
            transform="rotate(-18 180 111)"
          />
          <circle
            cx="180"
            cy="111"
            r={id === "solar-system" ? 34 : 42}
            fill={id === "solar-system" ? "#ffd091" : `url(#${uid}-planet)`}
          />
          <circle
            cx="286"
            cy="59"
            r={id === "moon-phases" ? 24 : 12}
            fill="#e5e8f1"
          />
          {id === "moon-phases" && (
            <path
              d="M 286 35 A 24 24 0 0 1 286 83 A 10 24 0 0 0 286 35"
              fill="#536588"
            />
          )}
          {id === "solar-system" && (
            <>
              <circle cx="90" cy="131" r="9" fill="#df9d83" />
              <circle cx="64" cy="160" r="18" fill="#e0c5a2" />
              <ellipse
                cx="64"
                cy="160"
                rx="28"
                ry="7"
                fill="none"
                stroke="#ddd4c0"
                strokeWidth="3"
                transform="rotate(-22 64 160)"
              />
            </>
          )}
          {id === "orbital-mechanics" && (
            <>
              <path d="M268 65l30-12" stroke="#ffd091" strokeWidth="2" />
              <path
                d="m292 49 8 3-4 7"
                fill="none"
                stroke="#ffd091"
                strokeWidth="2"
              />
            </>
          )}
        </>
      )}
      {id === "reflection-refraction" && (
        <>
          <path d="M0 113h360v97H0z" fill="#4fc4cc" opacity=".15" />
          <path d="M0 113h360" stroke="#8eedef" opacity=".7" />
          <path d="M180 25v167" stroke="#9eaec7" strokeDasharray="5 6" />
          <path
            d="M68 30l112 83 48 82M180 113 292 30"
            fill="none"
            stroke="#ffd486"
            strokeWidth="4"
          />
          <path
            d="M180 113 292 30"
            stroke="#ffd486"
            strokeWidth="8"
            opacity=".1"
          />
          <path d="M180 113a35 35 0 0 0-28-35" fill="none" stroke="#e6baf7" />
        </>
      )}
      {id === "gravity" && (
        <>
          <path d="M30 168h300" stroke="#7198b8" />
          <path
            d="M80 160Q130 -58 275 160"
            fill="none"
            stroke="#a9dcd8"
            strokeDasharray="5 5"
            strokeWidth="2"
          />
          <circle cx="80" cy="160" r="11" fill="#ffd091" />
          <circle cx="178" cy="53" r="16" fill={`url(#${uid}-planet)`} />
          <path
            d="M178 78v49m-7-8 7 8 7-8"
            fill="none"
            stroke="#ffd091"
            strokeWidth="3"
          />
          <path d="M40 174h280l-25 16H65z" fill="#425f72" />
        </>
      )}
      {id === "photosynthesis" && (
        <>
          <circle cx="64" cy="46" r="23" fill="#ffd091" />
          <path
            d="M88 61 140 99M93 47 153 67"
            stroke="#ffd091"
            strokeWidth="3"
            strokeDasharray="4 6"
          />
          <path
            d="M182 175q-3-60 54-135 12 99-54 135Z"
            fill={`url(#${uid}-leaf)`}
          />
          <path
            d="M183 171q-76-10-79-80 75 3 79 80Z"
            fill={`url(#${uid}-leaf)`}
          />
          <path
            d="M181 202q-3-60 55-162M180 164l-68-65m91 16 28-11m-16-17 21-7"
            fill="none"
            stroke="#d6f8d5"
            strokeWidth="2"
          />
          <circle cx="285" cy="122" r="12" fill="#a3dce9" />
          <circle cx="310" cy="147" r="7" fill="#a3dce9" />
          <path d="M253 131h-20m8-6-8 6 8 6" stroke="#a3dce9" fill="none" />
        </>
      )}
      {id === "castle-defenses" && (
        <>
          <path d="M25 176q140-28 310 0v34H25z" fill="#376b78" />
          <path
            d="M68 157V83h21V68h17v15h21v74m106 0V83h21V68h17v15h21v74"
            fill="#9baac1"
          />
          <path d="M111 157V107h136v50" fill="#7385a0" />
          <path d="M142 157V60h18V45h18v15h20V45h18v15h17v97" fill="#b9c4d4" />
          <path d="M172 157v-28a12 12 0 0 1 24 0v28" fill="#172641" />
          <path d="M170 158h28l20 28h-68z" fill="#ccab81" />
          <path d="M184 45V24l28 9-28 8" stroke="#dbb0e7" fill="#dbb0e7" />
          <path
            d="M156 83v14m54-14v14M94 100v15m164-15v15"
            stroke="#263754"
            strokeWidth="5"
          />
        </>
      )}
      <ExtendedArtwork id={id} />
      <ExpansionArtwork id={id} />
    </svg>
  );
}
