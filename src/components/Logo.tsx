import logoIcon from "@/assets/logo-icon-white.png";
import { cn } from "@/lib/utils/cn";

const ASPECT_RATIO = logoIcon.width / logoIcon.height;

export function Logo({ height = 32, className }: { height?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoIcon.src}
      alt="Infinity Glass"
      width={Math.round(height * ASPECT_RATIO)}
      height={height}
      className={cn("shrink-0", className)}
    />
  );
}
