import { Sidebar } from "@/components/sidebar"
import { MobileNavigation } from "@/components/mobile-navigation"
import { SparkProvider } from "@/contexts/spark-context"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SparkProvider>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-hidden md:ml-0 mb-16 md:mb-0">
          {children}
        </main>
        <MobileNavigation />
      </div>
    </SparkProvider>
  )
}