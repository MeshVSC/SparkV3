"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Image from "next/image"

export default function Home() {
  const [isMounted, setIsMounted] = useState(false)

  console.log('[Home] render', { ts: new Date().toISOString() });

  useEffect(() => {
    console.log('[Home] mounted', { ts: new Date().toISOString() });
    setIsMounted(true);
    return () => console.log('[Home] unmounted', { ts: new Date().toISOString() });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isMounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="space-y-12"
          >
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isMounted ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.8 }}
              className="flex justify-center"
            >
              <div className="relative w-48 h-41 md:w-60 md:h-51 lg:w-80 lg:h-68">
                <Image
                  src="/logo.svg"
                  alt="Spark Logo"
                  fill
                  className="object-contain"
                />
              </div>
            </motion.div>

            {/* App Name */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={isMounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-6xl md:text-8xl font-bold"
            >
              Spark
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isMounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-2xl md:text-3xl text-muted-foreground max-w-4xl mx-auto leading-relaxed"
            >
              Capture every spark. Develop every idea. Execute every project.
            </motion.p>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isMounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Button
                size="lg"
                className="px-12 py-6 text-xl"
                onClick={() => window.location.href = '/app'}
              >
                Get Started
                <ArrowRight className="ml-2 w-6 h-6" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              From Spark to Project
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: "01",
                title: "Capture Sparks",
                description: "Instantly capture every idea, thought, or inspiration before it fades away"
              },
              {
                step: "02",
                title: "Develop Ideas",
                description: "Transform your sparks into structured, actionable plans and projects"
              },
              {
                step: "03",
                title: "Execute Projects",
                description: "Follow through with complete project management and execution"
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-6xl font-bold text-primary/20 mb-4">
                  {step.step}
                </div>
                <h3 className="text-2xl font-semibold mb-4">{step.title}</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-6 md:mb-0">
              <div className="relative w-10 h-9">
                <Image
                  src="/logo.svg"
                  alt="Spark Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-semibold text-lg">Spark</span>
            </div>
            <div className="text-muted-foreground text-sm">
              © 2024 Spark. Capture every spark. Execute every project.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
