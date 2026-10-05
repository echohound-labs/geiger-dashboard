"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";
import { THEME_KEY } from "@/lib/theme-script";

export type ThemeChoice = "dark" | "light" | "system";
const EVENT = "gero-theme-change";

function readChoice(): ThemeChoice {
  try {
    const c = localStorage.getItem(THEME_KEY);
    return c === "light" || c === "dark" ? c : "system";
  } catch {
    return "system";
  }
}
function apply(choice: ThemeChoice) {
  const light = choice === "light" || (choice === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice);
  const set = (c: ThemeChoice) => {
    try {
      if (c === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, c);
    } catch {}
    apply(c);
    window.dispatchEvent(new Event(EVENT));
  };
  return [choice, set];
}

/** Mounted once in the root layout: keeps <html data-theme> in sync with the choice, and with the device setting while on "system". */
export function ThemeSync() {
  const [choice] = useTheme();
  useLayoutEffect(() => {
    apply(choice);
  }, [choice]);
  useEffect(() => {
    if (choice !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);
  return null;
}

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light theme", Icon: SunIcon },
  { value: "dark", label: "Dark theme", Icon: MoonIcon },
  { value: "system", label: "Follow device theme", Icon: MonitorIcon },
];

export function ThemeToggle() {
  const [choice, setChoice] = useTheme();
  return (
    <div className="seg" role="group" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button key={value} type="button" title={label} aria-label={label} aria-pressed={choice === value} onClick={() => setChoice(value)}>
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
