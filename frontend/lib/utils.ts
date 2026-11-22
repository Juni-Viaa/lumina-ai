// ponytail: using native string join filter. Upgrade to clsx/tailwind-merge when class collision resolution is needed.
export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(" ");
}
