"use client"

import { useSpark } from "@/contexts/spark-context"
import { useSearch } from "@/contexts/search-context"
import { SparkCard } from "@/components/spark-card"
import { SparkStatus } from "@/types/spark"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  TreePine, 
  Trees,
  Plus,
  Leaf
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreateSparkDialog } from "@/components/create-spark-dialog"
import { useState, useCallback, useRef, useEffect } from "react"
import { DndContext, DragEndEvent, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, DragOverlay } from "@dnd-kit/core"
import { Spark } from "@/types/spark"

// Enhanced touch sensor with optimized thresholds
class TouchFriendlyPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: (event: any) => {
        return shouldHandleEvent(event.nativeEvent);
      },
    },
  ];
}

function shouldHandleEvent(event: PointerEvent): boolean {
  let cur = event.target as Element;

  while (cur) {
    if (cur.dataset && cur.dataset.noDnd) {
      return false;
    }
    cur = cur.parentElement!;
  }

  return true;
}

// Custom hook for haptic feedback
function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  return {
    dragStart: () => vibrate(50),
    dragMove: () => vibrate(25),
    dragEnd: () => vibrate([30, 20, 30]),
    dragCancel: () => vibrate(100),
  };
}

// Draggable Spark Card Component for Kanban with Touch Support
function DraggableKanbanCard({ spark, isSelected, onClick }: { spark: Spark; isSelected: boolean; onClick: () => void }) {
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchOffset, setTouchOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const haptic = useHapticFeedback();
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: spark.id,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect && touch) {
      setTouchStartPos({ x: touch.clientX, y: touch.clientY });
      setTouchOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      });
      haptic.dragStart();
    }
  }, [haptic]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    
    // Start dragging if moved more than threshold
    if (!isTouchDragging && (deltaX > 8 || deltaY > 8)) {
      setIsTouchDragging(true);
      e.preventDefault();
      haptic.dragMove();
    }
    
    if (isTouchDragging) {
      e.preventDefault();
    }
  }, [touchStartPos, isTouchDragging, haptic]);

  const handleTouchEnd = useCallback(() => {
    if (isTouchDragging) {
      haptic.dragEnd();
    }
    setTouchStartPos(null);
    setIsTouchDragging(false);
    setTouchOffset({ x: 0, y: 0 });
  }, [isTouchDragging, haptic]);

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    filter: isDragging ? 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))' : 'none',
    transition: isDragging ? 'none' : 'all 200ms ease',
  } : undefined;

  return (
    <div 
      ref={(node) => {
        setNodeRef(node);
        if (cardRef.current !== node) {
          (cardRef as any).current = node;
        }
      }}
      style={style} 
      className={`
        touch-manipulation select-none cursor-grab
        ${isDragging ? 'touch-drag-active scale-105' : ''}
        ${isTouchDragging ? 'touch-dragging' : ''}
      `}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      {...listeners} 
      {...attributes}
    >
      <SparkCard
        spark={spark}
        isSelected={isSelected}
        onClick={onClick}
        isDragging={isDragging || isTouchDragging}
      />
    </div>
  );
}

// Droppable Column Component with Enhanced Touch Support
function DroppableColumn({ 
  column, 
  children, 
  onSparkClick 
}: { 
  column: any; 
  children: React.ReactNode; 
  onSparkClick: (spark: Spark) => void 
}) {
  const [isTouchOver, setIsTouchOver] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const handleTouchEnter = useCallback(() => {
    setIsTouchOver(true);
  }, []);

  const handleTouchLeave = useCallback(() => {
    setIsTouchOver(false);
  }, []);

  return (
    <Card 
      ref={setNodeRef} 
      className={`
        h-fit transition-all duration-200 touch-manipulation
        ${isOver || isTouchOver ? 'ring-2 ring-primary bg-primary/5 drop-zone-active' : ''}
        ${isOver ? 'drop-zone-hover' : ''}
      `}
      onTouchStart={handleTouchEnter}
      onTouchEnd={handleTouchLeave}
    >
      <CardHeader className="pb-3 touch:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 touch:gap-3">
            <column.icon className="h-5 w-5 touch:h-6 touch:w-6" />
            <CardTitle className="text-lg touch:text-xl">{column.title}</CardTitle>
          </div>
          <Badge variant="outline" className={`${column.color} touch:text-sm touch:px-3 touch:py-1`}>
            {column.sparks.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 touch:space-y-4 min-h-[200px] touch:min-h-[250px]">
        {children}
        
        {column.sparks.length === 0 && (
          <div className="text-center py-8 touch:py-12 text-muted-foreground">
            <column.icon className="h-8 w-8 touch:h-10 touch:w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm touch:text-base">No {column.title.toLowerCase()}s yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KanbanView() {
  const { state, actions } = useSpark()
  const { filteredSparks } = useSearch()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [activeSpark, setActiveSpark] = useState<Spark | null>(null)
  const haptic = useHapticFeedback()

  const sensors = useSensors(
    useSensor(TouchFriendlyPointerSensor, {
      activationConstraint: {
        distance: 6, // Reduced for better touch sensitivity
        tolerance: 8,
        delay: 100,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const spark = state.sparks.find(s => s.id === active.id)
    setActiveSpark(spark || null)
    haptic.dragStart()
  }, [state.sparks, haptic])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const spark = state.sparks.find(s => s.id === active.id)
      const newStatus = over.id as SparkStatus
      
      if (spark && spark.status !== newStatus) {
        haptic.dragEnd()
        await actions.updateSpark(spark.id, {
          status: newStatus,
        })
        // Refresh user stats after status change
        actions.loadUserStats()
      }
    } else {
      haptic.dragCancel()
    }

    setActiveSpark(null)
  }, [state.sparks, actions, haptic])

  // Use filtered sparks from search context, fallback to all sparks if no filtering
  const sparksToDisplay = filteredSparks.length > 0 ? filteredSparks : state.sparks

  const columns = [
    {
      id: SparkStatus.SEEDLING,
      title: "Seedling",
      icon: Leaf,
      color: "bg-green-100 text-green-800 border-green-200",
      sparks: sparksToDisplay.filter(spark => spark.status === SparkStatus.SEEDLING)
    },
    {
      id: SparkStatus.SAPLING,
      title: "Sapling",
      icon: TreePine,
      color: "bg-blue-100 text-blue-800 border-blue-200",
      sparks: sparksToDisplay.filter(spark => spark.status === SparkStatus.SAPLING)
    },
    {
      id: SparkStatus.TREE,
      title: "Tree",
      icon: TreePine,
      color: "bg-purple-100 text-purple-800 border-purple-200",
      sparks: sparksToDisplay.filter(spark => spark.status === SparkStatus.TREE)
    },
    {
      id: SparkStatus.FOREST,
      title: "Forest",
      icon: Trees,
      color: "bg-orange-100 text-orange-800 border-orange-200",
      sparks: sparksToDisplay.filter(spark => spark.status === SparkStatus.FOREST)
    }
  ]

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full p-6 touch:p-4 overflow-auto">
        <div className="mb-6 touch:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl touch:text-3xl font-bold">Kanban Board</h1>
            <p className="text-muted-foreground touch:text-base">
              Organize your sparks by their growth stage
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="touch:h-12 touch:px-6 touch:text-base"
          >
            <Plus className="h-4 w-4 touch:h-5 touch:w-5 mr-2" />
            New Spark
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 touch:gap-4 touch:grid-cols-1 sm:touch:grid-cols-2">
          {columns.map((column) => (
            <DroppableColumn 
              key={column.id} 
              column={column}
              onSparkClick={(spark) => actions.selectSpark(spark)}
            >
              {column.sparks.map((spark) => (
                <div 
                  key={spark.id} 
                  className="cursor-grab active:cursor-grabbing touch-manipulation"
                  style={{ touchAction: 'none' }}
                >
                  <DraggableKanbanCard
                    spark={spark}
                    isSelected={state.selectedSpark?.id === spark.id}
                    onClick={() => actions.selectSpark(spark)}
                  />
                </div>
              ))}
            </DroppableColumn>
          ))}
        </div>

        <CreateSparkDialog 
          open={isCreateDialogOpen} 
          onOpenChange={setIsCreateDialogOpen}
        />
      </div>
      
      <DragOverlay dropAnimation={null}>
        {activeSpark ? (
          <div className="drag-preview opacity-90 scale-105 rotate-2 pointer-events-none">
            <SparkCard
              spark={activeSpark}
              isSelected={false}
              onClick={() => {}}
              isDragging={true}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}