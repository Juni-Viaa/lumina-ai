import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "glass" | "ghost";
    size?: "sm" | "md" | "lg" | "icon";
}

// ponytail: static variant mapping. Upgrade to cva if size/variant matrix expands.
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
    ({ className, variant = "glass", size = "md", type = "button", disabled, children, ...props }, ref) => {
        const variants = {
            primary:
                "bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-[0_4px_14px_rgba(37,99,235,0.3)] hover:scale-105 hover:shadow-[0_6px_20px_rgba(37,99,235,0.45)] active:scale-95 disabled:hover:scale-100",
            glass:
                "glass-inner text-[#0f2436] dark:text-[#f0f6fc] hover:bg-white/40 dark:hover:bg-slate-700/50 active:scale-95",
            ghost:
                "text-[#3b82f6] dark:text-[#60a5fa] hover:bg-[#3b82f6]/10 active:scale-95",
        };

        const sizes = {
            sm: "px-3 py-1.5 text-xs rounded-lg",
            md: "px-4 py-2 text-sm rounded-xl",
            lg: "px-6 py-2.5 text-base rounded-2xl",
            icon: "h-9 w-9 p-0 flex items-center justify-center rounded-full",
        };

        return (
            <button
                ref={ref}
                type={type}
                disabled={disabled}
                className={cn(
                    "inline-flex items-center justify-center font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer",
                    variants[variant],
                    sizes[size],
                    className,
                )}
                {...props}
            >
                {children}
            </button>
        );
    },
);

GlassButton.displayName = "GlassButton";
