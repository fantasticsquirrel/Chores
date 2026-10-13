import { useContext, useEffect, type ReactNode } from "react";
import { ColorContext, useLocalColors } from "../hooks/useBirthBandColors";

/** Lifetime is the existing authorized household/session owner; no storage/API. */
export function BirthBandColorScope({
  children,
  retired = false,
}: {
  children: ReactNode;
  retired?: boolean;
}) {
  const value = useLocalColors();
  const { reset } = value;
  useEffect(() => {
    if (retired) reset();
  }, [retired, reset]);
  return <ColorContext.Provider value={value}>{children}</ColorContext.Provider>;
}
export function BirthBandColorBoundary({ children }: { children: ReactNode }) {
  const scope = useContext(ColorContext);
  return scope ? children : <BirthBandColorScope>{children}</BirthBandColorScope>;
}
