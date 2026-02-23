import type { ComponentPropsWithoutRef, ElementType, ReactElement, ReactNode } from "react";

type CardProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
} & ComponentPropsWithoutRef<T>;

export function Card<T extends ElementType = "article">({
  as,
  children,
  className,
  ...rest
}: CardProps<T>): ReactElement {
  const Component = as ?? "article";

  return (
    <Component className={["glass-card", "lift-tilt", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Component>
  );
}
