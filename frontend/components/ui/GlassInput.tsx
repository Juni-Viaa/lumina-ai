import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
    variant?: "default" | "error" | "success";
    inputSize?: "sm" | "md" | "lg";
    /** Decorative element rendered inside the left edge of the field. */
    leadingIcon?: ReactNode;
    /** Element rendered inside the right edge (e.g. a password visibility toggle). */
    trailing?: ReactNode;
}

// ponytail: basic tailwind input styling. Upgrade to CVA when input size/state matrix exceeds 6 variants.
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
    (
        {
            className,
            variant = "default",
            inputSize = "md",
            type = "text",
            leadingIcon,
            trailing,
            ...props
        },
        ref,
    ) => {
        const variants = {
            default:
                "border-white/40 dark:border-slate-700 bg-white/70 dark:bg-slate-800/80 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-blue-500/15",
            error:
                "border-rose-400 bg-rose-50/60 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 focus:border-rose-500 focus:ring-rose-500/20",
            success:
                "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 focus:ring-emerald-500/20",
        };

        // Explicit left/right padding avoids conflicts between `px-*` and `pl-*`/`pr-*`
        // once a leading icon or trailing control is present.
        const sizes = {
            sm: {
                base: "py-1.5 text-xs rounded-lg",
                pl: "pl-3",
                pr: "pr-3",
                plWithIcon: "pl-9",
                prWithControl: "pr-9",
            },
            md: {
                base: "py-2.5 text-sm rounded-xl",
                pl: "pl-3.5",
                pr: "pr-3.5",
                plWithIcon: "pl-10",
                prWithControl: "pr-11",
            },
            lg: {
                base: "py-3 text-base rounded-2xl",
                pl: "pl-4",
                pr: "pr-4",
                plWithIcon: "pl-12",
                prWithControl: "pr-12",
            },
        };

        const size = sizes[inputSize];
        const input = (
            <input
                ref={ref}
                type={type}
                className={cn(
                    "w-full border text-[#0f2436] dark:text-[#f0f6fc] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
                    variants[variant],
                    size.base,
                    leadingIcon ? size.plWithIcon : size.pl,
                    trailing ? size.prWithControl : size.pr,
                    className,
                )}
                {...props}
            />
        );

        if (!leadingIcon && !trailing) return input;

        return (
            <div className="relative">
                {leadingIcon && (
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#6a8b9f]">
                        {leadingIcon}
                    </span>
                )}
                {input}
                {trailing && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3.5">
                        {trailing}
                    </span>
                )}
            </div>
        );
    },
);

GlassInput.displayName = "GlassInput";
