import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

type ControlDensity = "compact" | "default" | "comfortable";

type SharedControlProps = {
  density?: ControlDensity;
};

type TextInputProps = InputHTMLAttributes<HTMLInputElement> &
  SharedControlProps;

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & SharedControlProps;

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  SharedControlProps;

type CheckboxFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
};

export function FormField({
  label,
  className,
  children,
}: FormFieldProps): ReactElement {
  return (
    <label className={["ui-field", className].filter(Boolean).join(" ")}>
      <span className="ui-field-label">{label}</span>
      {children}
    </label>
  );
}

function controlClassName(
  type: "input" | "select" | "textarea",
  density: ControlDensity,
  className?: string,
): string {
  return ["ui-control", `ui-${type}`, `ui-control--${density}`, className]
    .filter(Boolean)
    .join(" ");
}

export function TextInput({
  className,
  density = "default",
  ...props
}: TextInputProps): ReactElement {
  return (
    <input
      type="text"
      className={controlClassName("input", density, className)}
      {...props}
    />
  );
}

export function DateInput({
  className,
  density = "default",
  ...props
}: TextInputProps): ReactElement {
  return (
    <input
      type="date"
      className={controlClassName("input", density, className)}
      {...props}
    />
  );
}

export function Select({
  className,
  density = "default",
  ...props
}: SelectProps): ReactElement {
  return (
    <select
      className={controlClassName("select", density, className)}
      {...props}
    />
  );
}

export function TextArea({
  className,
  density = "default",
  ...props
}: TextAreaProps): ReactElement {
  return (
    <textarea
      className={controlClassName("textarea", density, className)}
      {...props}
    />
  );
}

export function CheckboxField({
  label,
  className,
  ...rest
}: CheckboxFieldProps): ReactElement {
  return (
    <label className={["checkbox-row", className].filter(Boolean).join(" ")}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}
