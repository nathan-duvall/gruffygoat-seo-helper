import { useState, useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";

function getEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme-mode") as ThemeMode) || "system";
    }
    return "system";
  });

  const effectiveTheme = typeof window !== "undefined" ? getEffectiveTheme(mode) : "light";

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(getEffectiveTheme(mode));
    localStorage.setItem("theme-mode", mode);
  }, [mode]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const toggleTheme = () => setMode((t) => (t === "light" ? "dark" : "light"));
  const setTheme = (t: ThemeMode) => setMode(t);

  // For backwards compat, expose "theme" as the effective light/dark value
  return { theme: effectiveTheme, mode, toggleTheme, setTheme };
}
