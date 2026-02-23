import type { ButtonHTMLAttributes, ReactElement } from "react";
import { Link, type LinkProps } from "react-router-dom";

type ButtonVariant = "primary" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

type ButtonLinkProps = LinkProps & {
  variant?: ButtonVariant;
  className?: string;
};

function buildButtonClass(variant: ButtonVariant, className?: string): string {
  return [
    "jewel-button",
    "button-reset",
    variant === "danger" ? "danger-button" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({ variant = "primary", className, type = "button", ...rest }: ButtonProps): ReactElement {
  return <button type={type} className={buildButtonClass(variant, className)} {...rest} />;
}

export function ButtonLink({ variant = "primary", className, ...rest }: ButtonLinkProps): ReactElement {
  return <Link className={buildButtonClass(variant, className)} {...rest} />;
}
