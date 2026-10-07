"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@fin/components/ui/dialog";
import { cn } from "@fin/lib/cn";
import { isActive, NAV_FOOTER, NAV_GROUPS } from "./nav";

/** Barra inferior do celular (DS §5) + menu completo em sheet. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const primary = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_FOOTER]
    .filter((i) => i.mobile)
    .slice(0, 4);

  return (
    <>
      <nav
        aria-label="Navegação rápida"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-ink-3",
                active && "text-ink",
              )}
            >
              <item.icon className="size-5" strokeWidth={active ? 2 : 1.75} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] text-ink-3"
        >
          <MenuIcon className="size-5" strokeWidth={1.75} />
          Menu
        </button>
      </nav>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4">
          <DialogTitle>Menu</DialogTitle>
          <div className="grid gap-5">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="grid gap-1">
                <p className="text-xs text-ink-3">{group.label}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex h-11 items-center gap-3 rounded-control px-2 text-[15px] hover:bg-surface-sunken"
                  >
                    <item.icon className="size-5 text-ink-3" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
            <div className="grid gap-1 border-t border-line pt-3">
              {NAV_FOOTER.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center gap-3 rounded-control px-2 text-[15px] hover:bg-surface-sunken"
                >
                  <item.icon className="size-5 text-ink-3" strokeWidth={1.75} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
