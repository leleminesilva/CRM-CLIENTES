"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Tooltip } from "@fin/components/ui/tooltip";
import { cn } from "@fin/lib/cn";
import { useMediaQuery } from "@fin/lib/use-client-store";
import { BrandMark, BrandName } from "./brand";
import { isActive, NAV_FOOTER, NAV_GROUPS, type NavItem } from "./nav";

export const SIDEBAR_COOKIE = "cg_sidebar";

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-control px-2.5 text-[14px] text-ink-2 transition-colors duration-120",
        "hover:bg-surface-sunken hover:text-ink",
        active && "bg-surface-sunken font-medium text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      <item.icon
        className={cn(
          "size-[18px] shrink-0",
          active ? "text-ink" : "text-ink-3 group-hover:text-ink-2",
        )}
        strokeWidth={1.75}
      />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export function Sidebar({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  // No tablet (md) a sidebar é sempre um trilho de ícones; no desktop respeita a preferência.
  const isDesktop = useMediaQuery("(min-width: 64rem)");
  const iconOnly = collapsed || !isDesktop;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface md:flex",
        "w-16",
        collapsed ? "lg:w-16" : "lg:w-60",
      )}
      data-collapsed={collapsed}
    >
      <div
        className={cn(
          "flex h-14 items-center gap-2.5 px-4",
          collapsed ? "justify-center px-0" : "max-lg:justify-center max-lg:px-0",
        )}
      >
        <BrandMark className="size-7" />
        <BrandName className={cn("max-lg:hidden", collapsed && "lg:hidden")} />
      </div>

      <nav aria-label="Principal" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="grid gap-0.5">
            <p
              className={cn(
                "px-2.5 pb-1 text-xs text-ink-3",
                collapsed ? "sr-only" : "max-lg:sr-only",
              )}
            >
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={iconOnly} />
            ))}
          </div>
        ))}
      </nav>

      <div className="grid gap-0.5 border-t border-line px-3 py-3">
        {NAV_FOOTER.map((item) => (
          <NavLink key={item.href} item={item} collapsed={iconOnly} />
        ))}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "hidden h-9 cursor-pointer items-center gap-3 rounded-control px-2.5 text-[14px] text-ink-3 transition-colors hover:bg-surface-sunken hover:text-ink lg:flex",
            collapsed && "justify-center px-0",
          )}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-[18px]" strokeWidth={1.75} />
          ) : (
            <PanelLeftCloseIcon className="size-[18px]" strokeWidth={1.75} />
          )}
          <span className={cn(collapsed && "sr-only")}>Recolher</span>
        </button>
      </div>
    </aside>
  );
}
