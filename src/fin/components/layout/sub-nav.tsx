"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@fin/lib/cn";

/** Abas de navegação entre subpáginas (rolam na horizontal no celular). */
export function SubNav({
  items,
  label,
}: {
  items: { href: string; label: string }[];
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm text-ink-2 transition-colors hover:text-ink",
                  active && "border-ink font-medium text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
