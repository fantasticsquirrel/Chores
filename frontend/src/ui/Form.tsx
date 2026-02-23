import type { InputHTMLAttributes, ReactElement, ReactNode } from "react";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function FormField({ label, className, children }: FormFieldProps): ReactElement {
  return (
    <label className={className}>
      {label}
      {children}
    </label>
  );
}

export function TextInput(props: TextInputProps): ReactElement {
  return <input {...props} />;
}

export function DateInput(props: TextInputProps): ReactElement {
  return <input type="date" {...props} />;
}

export function CheckboxField({ label, className, ...rest }: CheckboxFieldProps): ReactElement {
  return (
    <label className={["checkbox-row", className].filter(Boolean).join(" ")}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}
