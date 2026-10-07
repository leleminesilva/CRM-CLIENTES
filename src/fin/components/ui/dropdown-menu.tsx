"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@fin/lib/cn";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuSub = Menu.Sub;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export const menuContentClasses =
  "z-50 min-w-48 overflow-hidden rounded-card border border-line bg-surface-raised p-1 text-ink shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

export const menuItemClasses =
  "relative flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-sunken [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3";

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof Menu.Content>,
  React.ComponentPropsWithoutRef<typeof Menu.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <Menu.Portal>
      <Menu.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(menuContentClasses, className)}
        {...props}
      />
    </Menu.Portal>
  );
});

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof Menu.Item>,
  React.ComponentPropsWithoutRef<typeof Menu.Item> & { destructive?: boolean }
>(function DropdownMenuItem({ className, destructive, ...props }, ref) {
  return (
    <Menu.Item
      ref={ref}
      className={cn(
        menuItemClasses,
        destructive && "text-critical data-[highlighted]:bg-critical/8 [&_svg]:text-critical",
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof Menu.RadioItem>,
  React.ComponentPropsWithoutRef<typeof Menu.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <Menu.RadioItem ref={ref} className={cn(menuItemClasses, "pr-8", className)} {...props}>
      {children}
      <Menu.ItemIndicator className="absolute right-2 inline-flex">
        <CheckIcon className="!text-ink" />
      </Menu.ItemIndicator>
    </Menu.RadioItem>
  );
});

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof Menu.Label>,
  React.ComponentPropsWithoutRef<typeof Menu.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return <Menu.Label ref={ref} className={cn("px-2 py-1.5 text-xs text-ink-3", className)} {...props} />;
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof Menu.Separator>,
  React.ComponentPropsWithoutRef<typeof Menu.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <Menu.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />;
});

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof Menu.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof Menu.SubTrigger>
>(function DropdownMenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <Menu.SubTrigger
      ref={ref}
      className={cn(menuItemClasses, "data-[state=open]:bg-surface-sunken", className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </Menu.SubTrigger>
  );
});

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof Menu.SubContent>,
  React.ComponentPropsWithoutRef<typeof Menu.SubContent>
>(function DropdownMenuSubContent({ className, ...props }, ref) {
  return (
    <Menu.Portal>
      <Menu.SubContent ref={ref} className={cn(menuContentClasses, className)} {...props} />
    </Menu.Portal>
  );
});
