import { Button } from "../ui";
export function OwnerPagination({
  total,
  offset,
  limit,
  count,
  label,
  onOffset,
}: {
  total: number;
  offset: number;
  limit: number;
  count: number;
  label: string;
  onOffset: (value: number) => void;
}) {
  return (
    <nav className="ops-pagination" aria-label={`${label} pagination`}>
      <span>
        {total === 0
          ? "0 results"
          : `${offset + 1}–${offset + count} of ${total}`}
      </span>
      <Button
        disabled={offset === 0}
        onClick={() => onOffset(Math.max(0, offset - limit))}
      >
        Previous {label}
      </Button>
      <Button
        disabled={offset + limit >= total}
        onClick={() => onOffset(offset + limit)}
      >
        Next {label}
      </Button>
    </nav>
  );
}
