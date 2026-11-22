"use client";

import {
    createContext,
    useContext,
    useEffect,
    useCallback,
    useSyncExternalStore,
    type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: "light" | "dark";
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "system",
    resolvedTheme: "light",
    setTheme: () => {},
});

const THEME_KEY = "lumina-theme";

function subscribe(callback: () => void) {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): Theme {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
    return "system";
}

function getServerSnapshot(): Theme {
    return "system";
}

// ponytail: useSyncExternalStore handles storage sync. Upgrade to next-themes if multi-tab broadcasting or theme script injection is needed.
export function ThemeProvider({ children }: { children: ReactNode }) {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const getSystemTheme = useCallback((): "light" | "dark" => {
        if (typeof window === "undefined") return "light";
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }, []);

    const resolvedTheme: "light" | "dark" =
        theme === "system" ? getSystemTheme() : theme;

    useEffect(() => {
        const root = document.documentElement;
        const media = window.matchMedia("(prefers-color-scheme: dark)");

        const applyTheme = () => {
            const current = theme === "system" ? (media.matches ? "dark" : "light") : theme;
            root.setAttribute("data-theme", current);
            if (current === "dark") {
                root.classList.add("dark");
            } else {
                root.classList.remove("dark");
            }
        };

        applyTheme();
        media.addEventListener("change", applyTheme);
        return () => media.removeEventListener("change", applyTheme);
    }, [theme]);

    const setTheme = useCallback((next: Theme) => {
        localStorage.setItem(THEME_KEY, next);
        window.dispatchEvent(new Event("storage"));
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
