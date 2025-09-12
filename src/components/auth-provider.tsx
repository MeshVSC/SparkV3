"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  console.log("[BOOT] AuthProvider render");

  useEffect(() => {
    console.log("[BOOT] AuthProvider mounted");
    return () => console.log("[BOOT] AuthProvider unmounted");
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
