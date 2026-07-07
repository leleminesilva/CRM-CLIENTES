import { cn } from "@/lib/utils/cn";

const ASPECT_RATIO = 1232 / 743;

export function Logo({ height = 32, className }: { height?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/logo-icon-white.png"
      alt="Infinity Glass"
      width={Math.round(height * ASPECT_RATIO)}
      height={height}
      className={cn("shrink-0", className)}
    />
  );
}
