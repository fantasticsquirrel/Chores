import type { PizzaPlate } from "../tactile/tableGeometry";

export function FractionPieceToggles({
  plate,
  plateName,
  onToggle,
}: {
  plate: PizzaPlate;
  plateName: string;
  onToggle: (piece: number) => void;
}) {
  return (
    <div
      className="fraction-piece-toggles"
      role="group"
      aria-label={`Individual pieces on ${plateName}`}
    >
      <span>Choose individual pieces</span>
      <div>
        {Array.from({ length: plate.d }, (_, piece) => (
          <button
            key={piece}
            type="button"
            aria-label={`${plateName} slice ${piece + 1}`}
            aria-pressed={plate.slices.includes(piece)}
            onClick={() => onToggle(piece)}
          >
            {piece + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
