"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"

interface FloatingActionButtonProps {
  onClick?: () => void
  icon?: React.ComponentType<{ className?: string }>
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "primary" | "secondary"
  disabled?: boolean
  children?: React.ReactNode
  ariaLabel?: string
}

export function FloatingActionButton({
  onClick,
  icon: Icon = Plus,
  className,
  size = "lg",
  variant = "primary",
  disabled = false,
  children,
  ariaLabel = "Add new item"
}: FloatingActionButtonProps) {
  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-14 w-14", 
    lg: "h-16 w-16"
  }

  const iconSizeClasses = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-7 w-7"
  }

  const variantClasses = {
    primary: "bg-primary text-primary-foreground shadow-primary/25",
    secondary: "bg-secondary text-secondary-foreground shadow-secondary/25"
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        // Base styles
        "fixed bottom-20 right-4 z-50",
        "flex items-center justify-center",
        "rounded-full shadow-lg border",
        "touch-manipulation select-none",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        
        // Size
        sizeClasses[size],
        
        // Variant
        variantClasses[variant],
        
        // States
        disabled 
          ? "opacity-50 cursor-not-allowed" 
          : "hover:shadow-xl active:shadow-md",
        
        // Mobile specific positioning  
        "md:hidden safe-area-inset-bottom safe-area-inset-right",
        
        className
      )}
      style={{
        bottom: "max(5rem, calc(env(safe-area-inset-bottom) + 1rem))",
        right: "max(1rem, env(safe-area-inset-right))"
      }}
      whileHover={disabled ? {} : { 
        scale: 1.05,
        rotate: 90
      }}
      whileTap={disabled ? {} : { 
        scale: 0.95,
        rotate: 90
      }}
      initial={{ 
        opacity: 0, 
        scale: 0,
        rotate: -90
      }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        rotate: 0
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        duration: 0.3
      }}
    >
      {children || (
        <motion.div
          animate={{ rotate: 0 }}
          whileHover={{ rotate: 90 }}
          transition={{ duration: 0.2 }}
        >
          <Icon className={iconSizeClasses[size]} />
        </motion.div>
      )}
    </motion.button>
  )
}

// Extended FAB with expandable menu
interface ExpandableFABProps extends Omit<FloatingActionButtonProps, 'children'> {
  items: Array<{
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    onClick: () => void
  }>
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

export function ExpandableFloatingActionButton({
  items,
  expanded = false,
  onExpandedChange,
  ...props
}: ExpandableFABProps) {
  const handleMainClick = () => {
    if (items.length > 1) {
      onExpandedChange?.(!expanded)
    } else if (items[0]) {
      items[0].onClick()
    }
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 md:hidden"
      style={{
        bottom: "max(5rem, calc(env(safe-area-inset-bottom) + 1rem))",
        right: "max(1rem, env(safe-area-inset-right))"
      }}
    >
      {/* Expanded menu items */}
      {expanded && items.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-20 right-0 flex flex-col gap-3"
        >
          {items.map((item, index) => {
            const Icon = item.icon
            
            return (
              <motion.button
                key={item.id}
                onClick={() => {
                  item.onClick()
                  onExpandedChange?.(false)
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  "bg-card text-card-foreground shadow-lg border rounded-full",
                  "hover:shadow-xl active:shadow-md transition-all duration-200",
                  "whitespace-nowrap"
                )}
                initial={{ 
                  opacity: 0, 
                  x: 20,
                  scale: 0.8
                }}
                animate={{ 
                  opacity: 1, 
                  x: 0,
                  scale: 1
                }}
                exit={{
                  opacity: 0,
                  x: 20,
                  scale: 0.8
                }}
                transition={{
                  delay: index * 0.05,
                  type: "spring",
                  stiffness: 260,
                  damping: 20
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </motion.button>
            )
          })}
        </motion.div>
      )}

      {/* Main FAB */}
      <FloatingActionButton
        {...props}
        onClick={handleMainClick}
        icon={expanded ? undefined : props.icon}
      >
        {expanded ? (
          <motion.div
            animate={{ rotate: 45 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="h-7 w-7" />
          </motion.div>
        ) : null}
      </FloatingActionButton>
    </div>
  )
}