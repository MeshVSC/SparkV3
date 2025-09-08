"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

// Presence indicator component for showing online status
const PresenceIndicator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    status: 'online' | 'idle' | 'away' | 'offline';
    size?: 'sm' | 'md' | 'lg';
    showPulse?: boolean;
  }
>(({ className, status, size = 'md', showPulse = true, ...props }, ref) => {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  const statusClasses = {
    online: 'bg-green-500',
    idle: 'bg-yellow-500',
    away: 'bg-orange-500',
    offline: 'bg-gray-400'
  };

  return (
    <div
      ref={ref}
      className={cn(
        "absolute bottom-0 right-0 rounded-full border-2 border-background",
        sizeClasses[size],
        statusClasses[status],
        showPulse && status === 'online' && 'animate-pulse',
        className
      )}
      {...props}
    />
  );
});
PresenceIndicator.displayName = "PresenceIndicator";

export { Avatar, AvatarImage, AvatarFallback, PresenceIndicator }
