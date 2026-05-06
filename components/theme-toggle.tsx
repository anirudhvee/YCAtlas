"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
    >
      <Sun className="hidden size-3.5 dark:block" strokeWidth={1.75} />
      <Moon className="block size-3.5 dark:hidden" strokeWidth={1.75} />
    </button>
  );
}
