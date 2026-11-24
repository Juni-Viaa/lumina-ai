import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "circular" | "rounded" | "text";
}

// ponytail: lightweight skeleton components using CSS shimmer. Upgrade to SVG masked skeletons if complex graphic placeholders are needed.
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
    ({ className, variant = "default", ...props }, ref) => {
        const variantClass = {
            default: "rounded-md",
            circular: "rounded-full",
            rounded: "rounded-2xl",
            text: "h-4 rounded",
        }[variant];

        return (
            <div
                ref={ref}
                role="status"
                aria-label="Memuat konten…"
                aria-busy="true"
                className={cn("skeleton-shimmer", variantClass, className)}
                {...props}
            />
        );
    },
);
Skeleton.displayName = "Skeleton";

export function SkeletonChatBubble({
    role = "assistant",
}: {
    role?: "user" | "assistant";
}) {
    const isUser = role === "user";

    if (isUser) {
        return (
            <div className="flex flex-row-reverse gap-3.5" role="status" aria-label="Memuat pesan…">
                <Skeleton variant="circular" className="h-9 w-9 shrink-0" />
                <div className="flex max-w-[80%] flex-col items-end gap-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-12 w-64 rounded-2xl rounded-tr-sm" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-3.5" role="status" aria-label="Memuat pesan…">
            <Skeleton variant="circular" className="h-9 w-9 shrink-0" />
            <div className="flex max-w-[85%] flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-20 w-full rounded-2xl rounded-tl-sm" />
                <div className="flex gap-2 pt-1">
                    <Skeleton className="h-5 w-24 rounded-lg" />
                    <Skeleton className="h-5 w-20 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div
            role="status"
            aria-label="Memuat data…"
            className={cn(
                "glass-inner flex items-center justify-between p-4 rounded-xl",
                className,
            )}
        >
            <div className="flex-1 space-y-2 pr-4">
                <Skeleton className="h-4 w-3/5" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-8 w-20 rounded-xl" />
                <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
        </div>
    );
}

export function SkeletonTableRow() {
    return (
        <tr role="status" aria-label="Memuat baris tabel…">
            <td className="p-4 text-center">
                <Skeleton className="mx-auto h-4 w-4" />
            </td>
            <td className="p-4">
                <Skeleton className="h-4 w-4/5" />
            </td>
            <td className="p-4">
                <Skeleton className="h-3 w-12" />
            </td>
            <td className="p-4">
                <Skeleton className="h-3 w-14" />
            </td>
            <td className="p-4">
                <Skeleton className="h-3 w-24" />
            </td>
            <td className="p-4 text-center">
                <Skeleton className="mx-auto h-5 w-8 rounded-full" />
            </td>
            <td className="p-4">
                <Skeleton className="h-5 w-20 rounded-full" />
            </td>
            <td className="p-4 text-center">
                <Skeleton className="mx-auto h-7 w-7 rounded-xl" />
            </td>
        </tr>
    );
}

export function SkeletonSidebarItem() {
    return (
        <div
            role="status"
            aria-label="Memuat riwayat…"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        >
            <Skeleton variant="circular" className="h-4 w-4 shrink-0" />
            <Skeleton className="h-3 w-3/4" />
        </div>
    );
}
