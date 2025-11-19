import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-stone-200 bg-white text-stone-950 shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

export { Card }

