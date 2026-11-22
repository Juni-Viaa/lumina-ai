import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: "panel" | "inner" | "interactive";
}

// ponytail: basic variant classes. Upgrade to cva (class-variance-authority) when component variants exceed 5 combinations.
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
    ({ className, variant = "panel", children, ...props }, ref) => {
        const variantClass = {
            panel: "glass-panel",
            inner: "glass-inner rounded-xl",
            interactive: "glass-card",
        }[variant];

        return (
            <div ref={ref} className={cn(variantClass, className)} {...props}>
                {children}
            </div>
        );
    },
);

GlassCard.displayName = "GlassCard";
