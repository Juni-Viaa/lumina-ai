import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
    variant?: "default" | "error" | "success";
    inputSize?: "sm" | "md" | "lg";
}

// ponytail: basic tailwind input styling. Upgrade to CVA when input size/state matrix exceeds 6 variants.
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
    ({ className, variant = "default", inputSize = "md", type = "text", ...props }, ref) => {
        const variants = {
            default:
                "border-white/40 dark:border-slate-700 bg-white/70 dark:bg-slate-800/80 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-blue-500/15",
            error:
                "border-rose-400 bg-rose-50/60 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 focus:border-rose-500 focus:ring-rose-500/20",
            success:
                "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 focus:ring-emerald-500/20",
        };

        const sizes = {
            sm: "py-1.5 px-3 text-xs rounded-lg",
            md: "py-2.5 px-3.5 text-sm rounded-xl",
            lg: "py-3 px-4 text-base rounded-2xl",
        };

        return (
            <input
                ref={ref}
                type={type}
                className={cn(
                    "w-full border text-[#0f2436] dark:text-[#f0f6fc] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
                    variants[variant],
                    sizes[inputSize],
                    className,
                )}
                {...props}
            />
        );
    },
);

GlassInput.displayName = "GlassInput";
