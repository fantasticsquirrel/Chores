/** @jsx h */
import { h } from "../exploration-packages/space-life-support/vector-author";
export function CastleMaterials({ id }: { id: string }) {
  return (
    <defs>
      <pattern
        id={`${id}-stone`}
        width="20"
        height="12"
        patternUnits="userSpaceOnUse"
      >
        <rect width="20" height="12" fill="#bcb9a6" />
        <path
          d="M0 0h20M0 6h20M10 0v6M0 6v6M20 6v6"
          fill="none"
          stroke="#807f73"
          strokeWidth=".6"
        />
        <path d="M1 1h8M11 7h8" stroke="#eee5cc" strokeWidth=".6" />
      </pattern>
      <pattern
        id={`${id}-pave`}
        width="17"
        height="13"
        patternUnits="userSpaceOnUse"
      >
        <rect width="17" height="13" fill="#79816c" />
        <path
          d="M0 0h17M0 0v13M8 0v6M0 6h17"
          fill="none"
          stroke="#525f50"
          strokeWidth=".7"
        />
      </pattern>
      <pattern
        id={`${id}-roof`}
        width="13"
        height="8"
        patternUnits="userSpaceOnUse"
      >
        <rect width="13" height="8" fill="#9c6252" />
        <path
          d="M0 0h13M0 4h13M6 0v4M0 4v4"
          stroke="#c48b6b"
          strokeWidth=".6"
          fill="none"
        />
      </pattern>
      <linearGradient id={`${id}-water`} x2="1" y2="1">
        <stop stopColor="#335f60" />
        <stop offset=".5" stopColor="#68a2a0" />
        <stop offset="1" stopColor="#254c52" />
      </linearGradient>
      <radialGradient id={`${id}-tree`} cx="30%" cy="25%">
        <stop stopColor="#7d9c63" />
        <stop offset="1" stopColor="#2d4b36" />
      </radialGradient>
      <linearGradient id={`${id}-tower`} x2="1" y2="1">
        <stop stopColor="#eee2bd" />
        <stop offset=".5" stopColor="#bab79c" />
        <stop offset="1" stopColor="#626c60" />
      </linearGradient>
    </defs>
  );
}
