"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { 
  Lightbulb, 
  Kanban, 
  Clock, 
  Target,
  Trophy,
  Settings
} from "lucide-react"

export interface TabItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  href?: string
  onClick?: () => void
}

interface BottomTabNavigationProps {
  tabs: TabItem[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  className?: string
}

export function BottomTabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className
}: BottomTabNavigationProps) {
  const [selectedTab, setSelectedTab] = useState(activeTab || tabs[0]?.id)

  const handleTabClick = (tab: TabItem) => {
    setSelectedTab(tab.id)
    onTabChange?.(tab.id)
    tab.onClick?.()
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border",
        "px-2 py-2 md:hidden",
        "backdrop-blur-md bg-card/95 safe-area-inset-bottom",
        className
      )}
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))"
      }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto relative">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = selectedTab === tab.id
          
          return (
            <motion.button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "relative flex flex-col items-center justify-center",
                "min-h-[44px] min-w-[44px] px-3 py-1",
                "rounded-lg transition-colors duration-200",
                "touch-manipulation select-none",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:text-foreground"
              )}
              whileTap={{ scale: 0.95 }}
              animate={{
                scale: isActive ? 1.05 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30
              }}
            >
              {/* Background indicator */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 bg-primary/10 rounded-lg"
                  layoutId="activeTabBackground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30
                  }}
                />
              )}

              {/* Icon */}
              <div className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive && "scale-110"
                  )}
                />
                
                {/* Badge */}
                {tab.badge && tab.badge > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      "absolute -top-1 -right-1 h-4 w-4",
                      "bg-destructive text-destructive-foreground",
                      "rounded-full flex items-center justify-center",
                      "text-xs font-medium"
                    )}
                  >
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </motion.div>
                )}
              </div>

              {/* Label */}
              <motion.span
                className={cn(
                  "text-xs font-medium mt-0.5",
                  "transition-opacity duration-200",
                  isActive ? "opacity-100" : "opacity-70"
                )}
                animate={{
                  fontWeight: isActive ? 600 : 500
                }}
              >
                {tab.label}
              </motion.span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}