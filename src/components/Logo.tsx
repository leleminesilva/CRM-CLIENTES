import { cn } from "@/lib/utils/cn";

export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/logo-icon-blue.png"
      alt="Infinity Glass"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  );
}
