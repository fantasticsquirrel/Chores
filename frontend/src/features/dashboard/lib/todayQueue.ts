export type TodayResource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function isTodayCaughtUp(
  approvals: TodayResource<readonly unknown[]>,
  children: TodayResource<readonly { id: number; active: boolean }[]>,
  counts: Record<number, TodayResource<number>>,
): boolean {
  return (
    !approvals.loading &&
    !approvals.error &&
    approvals.data?.length === 0 &&
    !children.loading &&
    !children.error &&
    children.data !== null &&
    children.data
      .filter((child) => child.active)
      .every(
        (child) =>
          counts[child.id]?.data === 0 &&
          !counts[child.id]?.error &&
          !counts[child.id]?.loading,
      )
  );
}
