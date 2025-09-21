"use client";

import { AchievementCenter } from "@/components/achievement-center";
import { CreateSparkDialog } from "@/components/create-spark-dialog";
import { AdvancedSearch } from "@/components/enhanced-search";
import { ExportDialog } from "@/components/export-dialog";
import { ExportDropdown } from "@/components/export-dropdown";
import { NotificationDropdown } from "@/components/notifications/NotificationCenter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { useGuest } from "@/contexts/guest-context";
import { useSearch } from "@/contexts/search-context";
import { useSpark } from "@/contexts/spark-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  Kanban,
  Lightbulb,
  Menu,
  Plus,
  Settings,
  Sparkles,
  Tag as TagIcon,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function Sidebar() {
  console.log("[UI Sidebar] mounted/executing", new Date().toISOString());
  useEffect(() => {
    console.log("[UI Sidebar] useEffect mount", new Date().toISOString());
    return () => console.log("[UI Sidebar] unmount", new Date().toISOString());
  }, []);
  const { data: session } = useSession();
  const { state, actions } = useSpark();
  const { isGuest, guestData } = useGuest();
  const { setFilteredSparks } = useSearch();
  const isMobile = useIsMobile();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAchievementCenterOpen, setIsAchievementCenterOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwipeFromEdge = useRef(false);

  const handleCreateSpark = () => {
    setIsCreateDialogOpen(true);
  };

  const prevFilteredSparksRef = useRef<any[]>([]);

  const handleFiltersChange = (filteredSparks: any[]) => {
    console.log("[Sidebar] handleFiltersChange called:", {
      timestamp: new Date().toISOString(),
      isArray: Array.isArray(filteredSparks),
      length: filteredSparks?.length || 0,
      prevLength: prevFilteredSparksRef.current?.length || 0,
    });

    if (!Array.isArray(filteredSparks)) return;

    const hasChanged =
      JSON.stringify(prevFilteredSparksRef.current) !==
      JSON.stringify(filteredSparks);
    console.log("[Sidebar] handleFiltersChange hasChanged:", {
      timestamp: new Date().toISOString(),
      hasChanged,
      willCallSetFilteredSparks: hasChanged,
    });

    if (hasChanged) {
      prevFilteredSparksRef.current = filteredSparks;
      console.log("[Sidebar] Calling setFilteredSparks:", {
        timestamp: new Date().toISOString(),
        sparks: filteredSparks.map((s) => ({ id: s.id, title: s.title })),
      });
      setFilteredSparks(filteredSparks);
    }
  };

  const openMobileSidebar = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  // Log sidebar renders
  useEffect(() => {
    console.log("[Sidebar] Rendering AdvancedSearch inside AnimatePresence:", {
      timestamp: new Date().toISOString(),
      renderCount: Math.random(),
    });
  });

  // Touch event handlers for swipe gestures
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isMobile) return;

      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;

      // Check if touch started from left edge (within 20px)
      isSwipeFromEdge.current = touch.clientX <= 20 && !isMobileOpen;
    },
    [isMobile, isMobileOpen]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (
        !isMobile ||
        touchStartX.current === null ||
        touchStartY.current === null
      )
        return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Only handle horizontal swipes (more horizontal than vertical)
      if (absDeltaX < 50 || absDeltaY > absDeltaX) {
        touchStartX.current = null;
        touchStartY.current = null;
        isSwipeFromEdge.current = false;
        return;
      }

      // Swipe from left edge to open
      if (isSwipeFromEdge.current && deltaX > 50) {
        openMobileSidebar();
      }
      // Swipe left on open drawer to close
      else if (isMobileOpen && deltaX < -50) {
        closeMobileSidebar();
      }

      touchStartX.current = null;
      touchStartY.current = null;
      isSwipeFromEdge.current = false;
    },
    [isMobile, isMobileOpen, openMobileSidebar, closeMobileSidebar]
  );

  // Add touch event listeners
  useEffect(() => {
    if (!isMobile) return;

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, handleTouchStart, handleTouchEnd]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        closeMobileSidebar();
      }
    },
    [closeMobileSidebar]
  );

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && isMobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "unset";
      };
    }
  }, [isMobile, isMobileOpen]);

  const displaySparks = state.sparks;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SEEDLING":
        return "bg-green-100 text-green-800";
      case "SAPLING":
        return "bg-blue-100 text-blue-800";
      case "TREE":
        return "bg-purple-100 text-purple-800";
      case "FOREST":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Spark</h1>
          </div>
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={closeMobileSidebar}
                className="md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <NotificationDropdown userId={session?.user?.id} />
            <UserAvatar />
          </div>
        </div>

        {/* Guest mode warning */}
        {isGuest && !session?.user?.id && (
          <Alert className="mb-4 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 text-sm">
              Your work is saved locally.{" "}
              <Link href="/auth/signin" className="underline font-medium">
                Sign in
              </Link>{" "}
              to save it permanently.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-4">
          <AnimatePresence mode="wait">
            <AdvancedSearch onFiltersChange={handleFiltersChange} />
          </AnimatePresence>
        </div>

        <Button onClick={handleCreateSpark} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Spark
        </Button>
      </div>

      <Tabs defaultValue="sparks" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 m-2">
          <TabsTrigger value="sparks" className="text-xs">
            <Lightbulb className="h-3 w-3 mr-1" />
            Sparks
          </TabsTrigger>
          <TabsTrigger value="views" className="text-xs">
            <Kanban className="h-3 w-3 mr-1" />
            Views
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-xs">
            <Trophy className="h-3 w-3 mr-1" />
            Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sparks" className="flex-1 overflow-hidden p-2">
          <div className="space-y-2 max-h-full overflow-y-auto">
            {displaySparks.map((spark) => (
              <Card
                key={spark.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => actions.selectSpark(spark)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm line-clamp-1">
                      {spark.title}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getStatusColor(spark.status)}`}
                    >
                      {spark.status.toLowerCase()}
                    </Badge>
                  </div>
                  {spark.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {spark.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Lvl {spark.level}</span>
                    <span>{spark.xp} XP</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="views" className="flex-1 overflow-hidden p-2">
          <div className="space-y-2">
            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => actions.setViewMode("canvas")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  <div>
                    <h3 className="font-medium text-sm">Canvas View</h3>
                    <p className="text-xs text-muted-foreground">
                      Free-form workspace
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => actions.setViewMode("kanban")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Kanban className="h-4 w-4" />
                  <div>
                    <h3 className="font-medium text-sm">Kanban Board</h3>
                    <p className="text-xs text-muted-foreground">
                      Workflow management
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => actions.setViewMode("timeline")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <div>
                    <h3 className="font-medium text-sm">Timeline</h3>
                    <p className="text-xs text-muted-foreground">
                      Chronological view
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => actions.setViewMode("connections")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <div>
                    <h3 className="font-medium text-sm">Connections</h3>
                    <p className="text-xs text-muted-foreground">
                      Manage spark relationships
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardContent className="p-3">
                <Link href="/app/tags" className="flex items-center gap-2">
                  <TagIcon className="h-4 w-4" />
                  <div>
                    <h3 className="font-medium text-sm">Tag Management</h3>
                    <p className="text-xs text-muted-foreground">
                      Organize tags
                    </p>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardContent className="p-3">
                <Link href="/workspaces" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <div>
                    <h3 className="font-medium text-sm">Workspaces</h3>
                    <p className="text-xs text-muted-foreground">
                      Manage team workspaces
                    </p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="flex-1 overflow-hidden p-2">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Your Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Sparks</span>
                  <span className="font-medium">{displaySparks.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total XP</span>
                  <span className="font-medium">
                    {displaySparks.reduce((sum, spark) => sum + spark.xp, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Completed Todos</span>
                  <span className="font-medium">
                    {displaySparks.reduce(
                      (sum, spark) =>
                        sum +
                        (spark.todos?.filter((todo) => todo.completed).length ||
                          0),
                      0
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Target className="h-3 w-3 mr-2" />
                  Daily Challenge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setIsAchievementCenterOpen(true)}
                >
                  <Trophy className="h-3 w-3 mr-2" />
                  Achievement Center
                </Button>
                <ExportDropdown
                  projectName="My Spark Project"
                  sparks={displaySparks}
                  connections={state.sparks.flatMap(
                    (spark) => spark.connections || []
                  )}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setIsExportDialogOpen(true)}
                >
                  <FileSpreadsheet className="h-3 w-3 mr-2" />
                  CSV Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Settings className="h-3 w-3 mr-2" />
                  Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-80 bg-card border-r flex-col h-full">
        <SidebarContent />
      </div>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={openMobileSidebar}
        className="fixed top-4 left-4 z-50 md:hidden bg-card border shadow-md"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Mobile Drawer */}
      {isMobile && (
        <>
          {/* Backdrop */}
          <div
            ref={backdropRef}
            className={cn(
              "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden",
              isMobileOpen ? "opacity-100 visible" : "opacity-0 invisible"
            )}
            onClick={handleBackdropClick}
          />

          {/* Drawer */}
          <div
            ref={sidebarRef}
            className={cn(
              "fixed top-0 left-0 z-50 h-full w-80 bg-card border-r flex flex-col transition-transform duration-300 ease-out md:hidden",
              isMobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <SidebarContent />
          </div>
        </>
      )}

      <CreateSparkDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <AchievementCenter
        isOpen={isAchievementCenterOpen}
        onOpenChange={setIsAchievementCenterOpen}
      />

      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        sparks={displaySparks}
      />
    </>
  );
}
