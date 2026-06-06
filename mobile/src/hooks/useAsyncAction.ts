import { useCallback, useState } from "react";

export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<void>,
) {
  const [running, setRunning] = useState(false);

  const run = useCallback(
    async (...args: TArgs): Promise<void> => {
      setRunning(true);
      try {
        await action(...args);
      } finally {
        setRunning(false);
      }
    },
    [action],
  );

  return { running, run };
}
