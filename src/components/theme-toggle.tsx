"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

// Icon visibility is driven purely by the `dark` class on <html>, so the
// server markup never disagrees with the client and there is no flash.
export function ThemeToggle() {
  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      // private mode etc. — the toggle still works for this visit
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11!"
      aria-label="Toggle dark / light theme"
      onClick={toggleTheme}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
