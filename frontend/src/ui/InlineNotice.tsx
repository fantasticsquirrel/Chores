import type { HTMLAttributes, ReactElement, ReactNode } from "react";

type InlineNoticeVariant = "info" | "success" | "error";

type InlineNoticeProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
  variant?: InlineNoticeVariant;
};

export function InlineNotice({ variant = "info", className, role, children, ...rest }: InlineNoticeProps): ReactElement {
  return (
    <p
      className={["inline-toast", `inline-toast-${variant}`, className].filter(Boolean).join(" ")}
      role={role ?? (variant === "error" ? "alert" : undefined)}
      {...rest}
    >
      {children}
    </p>
  );
}
