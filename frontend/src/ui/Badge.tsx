import type { HTMLAttributes, ReactElement } from "react";

type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export function Badge({ className, ...rest }: BadgeProps): ReactElement {
  return <span className={["pill", className].filter(Boolean).join(" ")} {...rest} />;
}
