"use client"

import { memo } from "react"
import { motion } from "framer-motion"

interface HeroBackgroundProps {
  isLight: boolean
}

function HeroBackgroundComponent({ isLight }: HeroBackgroundProps) {
  const baseGradient = isLight
    ? "linear-gradient(180deg, #ffffff 0%, #f6f7fb 55%, #ffffff 100%)"
    : "linear-gradient(180deg, #08090c 0%, #040506 55%, #090b0f 100%)"
  const gridLine = isLight ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.18)"

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: baseGradient }}
      />

      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 h-full"
        style={{
          WebkitMaskImage:
            "linear-gradient(180deg, black 20%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.45) 72%, transparent 98%)",
          maskImage:
            "linear-gradient(180deg, black 20%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.45) 72%, transparent 98%)",
        }}
      >
        <motion.div
          aria-hidden
          className="absolute"
          style={{
            top: "0%",
            right: "-18%",
            width: "160%",
            height: "160%",
            transform: "translate(0%, -45%) rotate(20deg)",
            transformOrigin: "center",
            backgroundImage: `linear-gradient(0deg, transparent 39px, ${gridLine} 40px), linear-gradient(90deg, transparent 39px, ${gridLine} 40px)`,
            backgroundSize: "40px 40px",
            WebkitMaskImage:
              "linear-gradient(45deg, transparent 32%, rgba(0,0,0,0.45) 58%, rgba(0,0,0,0.82) 78%, black 96%)",
            maskImage:
              "linear-gradient(45deg, transparent 32%, rgba(0,0,0,0.45) 58%, rgba(0,0,0,0.82) 78%, black 96%)",
          }}
          animate={{ backgroundPosition: ["0px 0px", "28px -18px", "0px 0px"] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  )
}

export const HeroBackground = memo(HeroBackgroundComponent)
