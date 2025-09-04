"use client";

import React from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  rectIntersection,
  CollisionDetection,
  type DraggableAttributes,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, GripVertical } from "lucide-react";
// import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type LinkItem = { label: string; href: string };
type KanbanItem = {
  id: string;
  title: string;
  description?: string;
  links?: LinkItem[];
};

type ColumnKey = "todo" | "doing" | "done" | "temp";

type BoardState = Record<ColumnKey, KanbanItem[]>;

const initialBoard: BoardState = { todo: [], doing: [], done: [], temp: [] };

const columnMeta: Record<ColumnKey, { title: string; bg: string; ring: string }> = {
  todo: { title: "To-do", bg: "bg-[#E8F0FE]", ring: "ring-[#a7c0ff]" },
  doing: { title: "In-progress", bg: "bg-[#EAF7F1]", ring: "ring-[#b6e3cf]" },
  done: { title: "Done", bg: "bg-[#F4F0FF]", ring: "ring-[#d6c8ff]" },
  temp: { title: "Temp", bg: "bg-[#FFF6E5]", ring: "ring-[#ffd9a5]" },
};

// Custom collision detection for better drop accuracy
const collisionDetectionStrategy: CollisionDetection = (args) => {
  // First, let's see if there are any collisions with the droppable
  const pointerIntersections = rectIntersection(args);
  
  if (pointerIntersections.length > 0) {
    return pointerIntersections;
  }
  
  // If no intersections found, return the closest corners
  return closestCorners(args);
};

export default function KanbanBoard() {
  const [board, setBoard] = React.useState<BoardState>(initialBoard);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newLinks, setNewLinks] = React.useState("");
  const [newColumn, setNewColumn] = React.useState<ColumnKey>("todo");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const loadingRef = React.useRef(false);
  const localUpdateRef = React.useRef<Set<string>>(new Set());

  // Helper function to ensure no duplicate items across columns
  const ensureUniqueItems = React.useCallback((boardState: BoardState): BoardState => {
    const seenIds = new Set<string>();
    const cleanBoard: BoardState = { todo: [], doing: [], done: [], temp: [] };
    
    for (const [colKey, items] of Object.entries(boardState) as [ColumnKey, KanbanItem[]][]) {
      cleanBoard[colKey] = items.filter(item => {
        if (seenIds.has(item.id)) {
          console.warn(`Duplicate item found: ${item.id} in column ${colKey}`);
          return false;
        }
        seenIds.add(item.id);
        return true;
      });
    }
    
    return cleanBoard;
  }, []);

  React.useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    const fetchData = async () => {
      try {
        setError(null);
        const { data: columns } = await supabase
          .from("kanban_columns")
          .select("key, title, position")
          .order("position", { ascending: true });

        const { data: cards } = await supabase
          .from("kanban_cards")
          .select("id, title, description, links, column_key, position")
          .order("position", { ascending: true });

        const next: BoardState = { todo: [], doing: [], done: [], temp: [] };
        for (const col of columns || []) {
          const colKey = col.key as ColumnKey;
          next[colKey] = [];
        }
        for (const c of cards || []) {
          const colKey = (c.column_key as ColumnKey) ?? "todo";
          const links = Array.isArray(c.links)
            ? (c.links as { label?: string; href: string }[]).map((l, i) => ({
                label: l.label ?? `Link ${i + 1}`,
                href: l.href,
              }))
            : undefined;
          next[colKey] = [
            ...next[colKey],
            { id: String(c.id), title: c.title, description: c.description ?? undefined, links },
          ];
        }
        setBoard(ensureUniqueItems(next));
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load board data. Please refresh the page.");
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription for kanban_cards table
    const subscription = supabase
      .channel('kanban_cards_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kanban_cards'
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          console.log('Real-time update received:', payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              console.log('INSERT event:', payload.new);
              if (payload.new) {
                const newCard = payload.new;
                const colKey = (newCard.column_key as ColumnKey) ?? "todo";
                const links = Array.isArray(newCard.links)
                  ? (newCard.links as { label?: string; href: string }[]).map((l, i) => ({
                      label: l.label ?? `Link ${i + 1}`,
                      href: l.href,
                    }))
                  : undefined;
                const newItem: KanbanItem = {
                  id: String(newCard.id),
                  title: newCard.title,
                  description: newCard.description ?? undefined,
                  links,
                };
                setBoard(prev => ensureUniqueItems({
                  ...prev,
                  [colKey]: [newItem, ...prev[colKey]]
                }));
              }
              break;
            case 'UPDATE':
              console.log('UPDATE event:', payload.new);
              if (payload.new) {
                const updatedCard = payload.new;
                const cardId = String(updatedCard.id);
                
                // Skip real-time updates for items we're currently updating locally
                if (localUpdateRef.current.has(cardId)) {
                  console.log(`Skipping real-time update for ${cardId} - local update in progress`);
                  return;
                }
                
                const newColKey = (updatedCard.column_key as ColumnKey) ?? "todo";
                const links = Array.isArray(updatedCard.links)
                  ? (updatedCard.links as { label?: string; href: string }[]).map((l, i) => ({
                      label: l.label ?? `Link ${i + 1}`,
                      href: l.href,
                    }))
                  : undefined;
                const updatedItem: KanbanItem = {
                  id: cardId,
                  title: updatedCard.title,
                  description: updatedCard.description ?? undefined,
                  links,
                };
                setBoard(prev => {
                  const newBoard = { ...prev };
                  
                  // Remove the item from all columns first
                  for (const colKey of Object.keys(newBoard) as ColumnKey[]) {
                    newBoard[colKey] = newBoard[colKey].filter(item => item.id !== cardId);
                  }
                  
                  // Add the updated item to the correct column
                  newBoard[newColKey] = [...newBoard[newColKey], updatedItem];
                  
                  return ensureUniqueItems(newBoard);
                });
              }
              break;
            case 'DELETE':
              console.log('DELETE event:', payload.old);
              if (payload.old) {
                const deletedCard = payload.old;
                setBoard(prev => {
                  const newBoard = { ...prev };
                  for (const colKey of Object.keys(newBoard) as ColumnKey[]) {
                    newBoard[colKey] = newBoard[colKey].filter(item => item.id !== String(deletedCard.id));
                  }
                  return ensureUniqueItems(newBoard);
                });
              }
              break;
            default:
              console.log('Unknown event type:', payload.eventType);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('disconnected');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [ensureUniqueItems]);

  // Configure sensors for better drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Slightly more distance to prevent accidental drags
        delay: 100, // Small delay for better UX
        tolerance: 5, // Tolerance for movement
      },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Find the containers
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    
    if (!activeContainer || !overContainer) return;
    
    if (activeContainer !== overContainer) {
      setBoard((prev) => {
        const activeItems = prev[activeContainer];
        const overItems = prev[overContainer];
        
        // Find the indices
        const activeIndex = activeItems.findIndex((item) => item.id === activeId);
        const overIndex = overItems.findIndex((item) => item.id === overId);
        
        let newIndex: number;
        if (overId in prev) {
          // We're over a container
          newIndex = overItems.length + 1;
        } else {
          const isBelowOverItem = over && active.rect.current.translated &&
            active.rect.current.translated.top > over.rect.top + over.rect.height;
          
          const modifier = isBelowOverItem ? 1 : 0;
          newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
        }
        
        return {
          ...prev,
          [activeContainer]: prev[activeContainer].filter((item) => item.id !== activeId),
          [overContainer]: [
            ...prev[overContainer].slice(0, newIndex),
            prev[activeContainer][activeIndex],
            ...prev[overContainer].slice(newIndex, prev[overContainer].length),
          ],
        };
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    
    if (!activeContainer || !overContainer) {
      setActiveId(null);
      return;
    }
    
    if (activeContainer === overContainer) {
      // Same container sorting - keep local for speed
      const activeIndex = board[activeContainer].findIndex((item) => item.id === activeId);
      const overIndex = board[overContainer].findIndex((item) => item.id === overId);
      
      if (activeIndex !== overIndex) {
        setBoard((prev) => ({
          ...prev,
          [overContainer]: arrayMove(prev[overContainer], activeIndex, overIndex),
        }));
        // Persist order for this column in background
        void persistColumnPositions(overContainer);
      }
    } else {
      // Moved across columns - update immediately for better UX
      const activeItem = board[activeContainer].find(item => item.id === activeId);
      if (activeItem) {
        // Update local state immediately
        setBoard((prev) => {
          const newBoard = { ...prev };
          // Remove from source column
          newBoard[activeContainer] = newBoard[activeContainer].filter(item => item.id !== activeId);
          // Add to target column
          newBoard[overContainer] = [...newBoard[overContainer], activeItem];
          return ensureUniqueItems(newBoard);
        });
        
        // Update Supabase in background
        void updateCardColumnAndPositions(activeId, overContainer, activeContainer);
      }
    }
    
    setActiveId(null);
  }

  function findContainer(id: string): ColumnKey | undefined {
    if (id in board) {
      return id as ColumnKey;
    }
    
    for (const [key, items] of Object.entries(board)) {
      if (items.find((item) => item.id === id)) {
        return key as ColumnKey;
      }
    }
    
    return undefined;
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const links = newLinks
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map((href, i) => ({ label: `Link ${i + 1}`, href }));
    (async () => {
      const position = 0;
      const { data, error } = await supabase
        .from("kanban_cards")
        .insert({
          title: newTitle,
          description: newDesc || null,
          links: links.length ? links : null,
          column_key: newColumn,
          position,
        })
        .select("id, title, description, links, column_key, position")
        .single();
      if (!error && data) {
        const newItem: KanbanItem = {
          id: String(data.id),
          title: data.title,
          description: data.description ?? undefined,
          links: Array.isArray(data.links)
            ? (data.links as { label?: string; href: string }[]).map((l, i) => ({
                label: l.label ?? `Link ${i + 1}`,
                href: l.href,
              }))
            : undefined,
        };
        setBoard(prev => ensureUniqueItems({ ...prev, [newColumn]: [newItem, ...prev[newColumn]] }));
        // Recompute positions after unshift
        void persistColumnPositions(newColumn);
        setAddOpen(false);
        setNewTitle(""); setNewDesc(""); setNewLinks(""); setNewColumn("todo");
      }
    })();
  }

  async function handleDelete(col: ColumnKey, id: string) {
    try {
      setError(null);
      console.log("Deleting card with id:", id);
      
      const { error } = await supabase
        .from("kanban_cards")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting card:", error);
        setError(`Failed to delete task: ${error.message}`);
        return;
      }

      console.log("Successfully deleted card with id:", id);
      // Update local state immediately for better UX
      setBoard(prev => ensureUniqueItems({ ...prev, [col]: prev[col].filter(i => i.id !== id) }));
      await persistColumnPositions(col);
    } catch (error) {
      console.error("Error deleting card:", error);
      setError("Failed to delete task. Please check your connection.");
    }
  }

  async function handleEdit(col: ColumnKey, updated: KanbanItem) {
    try {
      setError(null);
      console.log("Updating card with id:", updated.id, "data:", updated);
      
      const links = (updated.links || []).map((l, i) => ({ label: l.label ?? `Link ${i + 1}`, href: l.href }));
      const updateData = {
        title: updated.title,
        description: updated.description ?? null,
        links: links.length ? links : null,
        updated_at: new Date().toISOString(),
      };
      
      console.log("Update data:", updateData);

      const { data, error } = await supabase
        .from("kanban_cards")
        .update(updateData)
        .eq("id", updated.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating card:", error);
        setError(`Failed to update task: ${error.message}`);
        return;
      }

      console.log("Successfully updated card:", data);
      // Update local state immediately for better UX
      setBoard(prev => ensureUniqueItems({
        ...prev,
        [col]: prev[col].map(i => (i.id === updated.id ? { ...i, ...updated } : i)),
      }));
    } catch (error) {
      console.error("Error updating card:", error);
      setError("Failed to update task. Please check your connection.");
    }
  }

  const activeItem = activeId ? findActiveItem(activeId) : null;

  function findActiveItem(id: string): KanbanItem | undefined {
    for (const items of Object.values(board)) {
      const found = items.find(item => item.id === id);
      if (found) return found;
    }
    return undefined;
  }

  async function persistColumnPositions(col: ColumnKey) {
    try {
      const items = board[col];
      if (items.length === 0) return;
      
      // Re-read latest to avoid stale closure
      const current = items.map((it, idx) => ({ id: it.id, position: idx }));
      
      // Update all positions in parallel for better performance
      const updatePromises = current.map(row => 
        supabase.from("kanban_cards").update({ position: row.position }).eq("id", row.id)
      );
      
      await Promise.all(updatePromises);
      console.log(`Updated positions for ${current.length} items in column ${col}`);
    } catch (error) {
      console.error(`Error updating positions for column ${col}:`, error);
    }
  }


  async function updateCardColumnAndPositions(cardId: string, newCol: ColumnKey, oldCol: ColumnKey) {
    try {
      console.log(`Moving card ${cardId} from ${oldCol} to ${newCol}`);
      
      // Mark this card as being updated locally to prevent real-time conflicts
      localUpdateRef.current.add(cardId);
      
      // Update the card's column
      const { error: columnError } = await supabase
        .from("kanban_cards")
        .update({ 
          column_key: newCol,
          updated_at: new Date().toISOString()
        })
        .eq("id", cardId);

      if (columnError) {
        console.error("Error updating card column:", columnError);
        setError(`Failed to move task: ${columnError.message}`);
        localUpdateRef.current.delete(cardId);
        return;
      }

      // Update positions for both columns in parallel
      await Promise.all([
        persistColumnPositions(newCol),
        persistColumnPositions(oldCol),
      ]);

      console.log(`Successfully moved card ${cardId} from ${oldCol} to ${newCol}`);
      
      // Remove from local update tracking after a short delay
      setTimeout(() => {
        localUpdateRef.current.delete(cardId);
      }, 1000);
    } catch (error) {
      console.error("Error updating card column and positions:", error);
      setError("Failed to move task. Please check your connection.");
      localUpdateRef.current.delete(cardId);
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-3">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white/80">Loading board...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto px-3">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white drop-shadow mb-2">Kanban Board</h2>
          <p className="text-white/80 text-sm">~ &ldquo;The secret of getting ahead is getting started.&rdquo;</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs ${
              connectionStatus === 'connected' ? 'text-green-400' : 
              connectionStatus === 'connecting' ? 'text-yellow-400' : 
              'text-red-400'
            }`}>
              ● {connectionStatus === 'connected' ? 'Live' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 
                 'Offline'}
            </span>
          </div>
          {error && (
            <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded-md">
              <p className="text-red-300 text-xs">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 text-xs underline mt-1"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="h-10 px-6">
              <span className="mr-2">+</span>
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add task</DialogTitle>
              <DialogDescription>Fill details and choose a column.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
              </div>
              <div>
                <Label htmlFor="links">Links (comma separated)</Label>
                <Input id="links" placeholder="https://... , https://..." value={newLinks} onChange={(e) => setNewLinks(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="col">Column</Label>
                <select id="col" className="mt-1 h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm" value={newColumn} onChange={(e) => setNewColumn(e.target.value as ColumnKey)}>
                  <option value="todo">To-do</option>
                  <option value="doing">In-progress</option>
                  <option value="done">Done</option>
                  <option value="temp">Temp</option>
                </select>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit">Add</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {(Object.keys(board) as ColumnKey[]).map((key) => (
            <Column
              key={key}
              colKey={key}
              items={board[key]}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))}
        </div>
        
        <DragOverlay>
          {activeItem ? (
            <div className="transform rotate-2 scale-110 shadow-2xl opacity-90">
              <KanbanCard
                item={activeItem}
                dragging={true}
                onDelete={async () => {}}
                onEdit={async () => {}}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ colKey, items, onDelete, onEdit }: { colKey: ColumnKey; items: KanbanItem[]; onDelete: (c: ColumnKey, id: string) => Promise<void>; onEdit: (c: ColumnKey, item: KanbanItem) => Promise<void>; }) {
  const meta = columnMeta[colKey];
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  
  return (
    <div className={`rounded-2xl p-4 ${meta.bg} ring-1 ${meta.ring} shadow-sm`}>
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-neutral-800 text-lg">{meta.title}</span>
          <span className="inline-flex items-center justify-center rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-sm">
            {items.length}
          </span>
        </div>
      </div>
      
      <div ref={setNodeRef} className={`space-y-3 min-h-[160px] p-2 rounded-lg transition-all duration-200 ${isOver ? 'bg-white/60 ring-2 ring-blue-300 scale-[1.02]' : 'bg-transparent'}`}>
        <SortableContext id={colKey} items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => (
            <SortableKanbanCard
              key={`${colKey}-${item.id}-${index}`}
              item={item}
              onDelete={async () => await onDelete(colKey, item.id)}
              onEdit={async (upd) => await onEdit(colKey, upd)}
            />
          ))}
          {items.length === 0 && (
            <div className="h-16 rounded-md border border-dashed border-neutral-300 bg-white/50 flex items-center justify-center text-xs text-neutral-500 transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/50">
              Drop here
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableKanbanCard({ item, onDelete, onEdit }: { item: KanbanItem; onDelete: () => Promise<void>; onEdit: (item: KanbanItem) => Promise<void>; }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    willChange: transform ? 'transform' as const : undefined,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'opacity-50 scale-105' : 'opacity-100'} transition-all duration-200`}
    >
      <KanbanCard
        item={item}
        dragging={isDragging}
        onDelete={onDelete}
        onEdit={onEdit}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}

function KanbanCard({ 
  item, 
  dragging, 
  onDelete, 
  onEdit, 
  dragHandleProps,
  isOverlay = false 
}: { 
  item: KanbanItem; 
  dragging: boolean; 
  onDelete: () => Promise<void>; 
  onEdit: (item: KanbanItem) => Promise<void>; 
  dragHandleProps?: { attributes: DraggableAttributes; listeners?: React.DOMAttributes<Element> };
  isOverlay?: boolean;
}) {
  const [editTitle, setEditTitle] = React.useState(item.title);
  const [editDesc, setEditDesc] = React.useState(item.description || "");
  const [editLinks, setEditLinks] = React.useState((item.links || []).map(l => l.href).join(", "));
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(true);
    
    try {
      const links = editLinks
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map((href, i) => ({ label: `Link ${i + 1}`, href }));

      await onEdit({ ...item, title: editTitle, description: editDesc || undefined, links: links.length ? links : undefined });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <Dialog>
      <Card className={`shadow-sm rounded-lg hover:shadow-md hover:scale-[1.01] transition-all duration-200 ${
        dragging ? "ring-2 ring-blue-400 shadow-xl" : "ring-1 ring-black/5"
      } ${isOverlay ? 'cursor-grabbing' : 'cursor-grab'}`}>
        <div 
          className="flex flex-col p-0"
          {...(!isOverlay && dragHandleProps ? {
            ...dragHandleProps.attributes,
            ...(dragHandleProps.listeners as React.DOMAttributes<HTMLDivElement>)
          } : {})}
        >
          <CardHeader className="px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-[16px] leading-tight font-semibold text-neutral-800 flex-1">{item.title}</CardTitle>
              {!isOverlay && (
                <div className="p-1 rounded transition-colors">
                  <GripVertical className="size-3.5 text-neutral-300" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 pt-0 pb-2">
            {item.description && (
              <p className="mb-2 text-neutral-600 text-[14px] leading-snug">{item.description}</p>
            )}
            {item.links && item.links.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.links.map((l, i) => (
                  <a
                    key={`${item.id}-link-chip-${i}`}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] rounded-full bg-neutral-100 px-1.5 py-0.5 text-neutral-600 font-medium hover:underline hover:text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="px-3 pt-1 pb-2 border-t border-neutral-100">
            <div className="flex w-full">
              <div className="ml-auto flex gap-1.5">
                <DialogTrigger asChild>
                  <Button 
                    size="iconXs" 
                    variant="outline" 
                    aria-label="Edit" 
                    className="hover:bg-neutral-100 h-7 w-7" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <Pencil className="size-3" />
                  </Button>
                </DialogTrigger>
                <Button 
                  size="iconXs" 
                  variant="destructive" 
                  aria-label="Delete" 
                  className="hover:bg-red-100 h-7 w-7" 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                  ) : (
                    <Trash2 className="size-3" />
                  )}
                </Button>
              </div>
            </div>
          </CardFooter>
        </div>
      </Card>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          {item.description && (
            <DialogDescription>{item.description}</DialogDescription>
          )}
        </DialogHeader>
        <form
          onSubmit={handleSave}
          className="space-y-3"
        >
          <div>
            <Label htmlFor={`ed-title-${item.id}`}>Title</Label>
            <Input id={`ed-title-${item.id}`} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`ed-desc-${item.id}`}>Description</Label>
            <Textarea id={`ed-desc-${item.id}`} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
          </div>
          <div>
            <Label htmlFor={`ed-links-${item.id}`}>Links (comma separated)</Label>
            <Input id={`ed-links-${item.id}`} value={editLinks} onChange={(e) => setEditLinks(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Close</Button>
            </DialogClose>
            <Button 
              type="submit" 
              disabled={isEditing}
            >
              {isEditing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


