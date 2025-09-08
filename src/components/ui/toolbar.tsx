"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-2 p-1",
          orientation === "vertical" && "flex-col",
          className
        )}
        {...props}
      />
    )
  }
)
Toolbar.displayName = "Toolbar"

export { Toolbar }