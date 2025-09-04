"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type TodoItem = {
  id: string;
  title: string;
  description?: string;
  links?: { label: string; href: string }[];
  column_key: string;
  created_at: string;
  updated_at: string;
};

export default function MobileTodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLinks, setNewLinks] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch todos from Supabase
  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("kanban_cards")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching todos:", error);
        return;
      }

      setTodos(data || []);
    } catch (error) {
      console.error("Error fetching todos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTitle.trim()) return;

    try {
      const links = newLinks
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map((href, i) => ({ label: `Link ${i + 1}`, href }));

      const { data, error } = await supabase
        .from("kanban_cards")
        .insert({
          title: newTitle,
          description: newDesc || null,
          links: links.length ? links : null,
          column_key: "todo",
          position: 0,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding todo:", error);
        return;
      }

      setTodos(prev => [data, ...prev]);
      setNewTitle("");
      setNewDesc("");
      setNewLinks("");
      setAddOpen(false);
    } catch (error) {
      console.error("Error adding todo:", error);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      const { error } = await supabase
        .from("kanban_cards")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting todo:", error);
        return;
      }

      setTodos(prev => prev.filter(todo => todo.id !== id));
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  const handleEditTodo = async (id: string, updatedData: Partial<TodoItem>) => {
    try {
      const { data, error } = await supabase
        .from("kanban_cards")
        .update({
          title: updatedData.title,
          description: updatedData.description,
          links: updatedData.links,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating todo:", error);
        return;
      }

      setTodos(prev => prev.map(todo => todo.id === id ? data : todo));
    } catch (error) {
      console.error("Error updating todo:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading todos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
            <p className="text-gray-600 text-sm mt-1">
              {todos.length} {todos.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
                <DialogDescription>
                  Create a new task to add to your list.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddTodo} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input 
                    id="title" 
                    value={newTitle} 
                    onChange={(e) => setNewTitle(e.target.value)} 
                    placeholder="Enter task title..."
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="desc">Description</Label>
                  <Textarea 
                    id="desc" 
                    value={newDesc} 
                    onChange={(e) => setNewDesc(e.target.value)} 
                    rows={3}
                    placeholder="Enter task description..."
                  />
                </div>
                <div>
                  <Label htmlFor="links">Links (comma separated)</Label>
                  <Input 
                    id="links" 
                    placeholder="https://example.com, https://another.com" 
                    value={newLinks} 
                    onChange={(e) => setNewLinks(e.target.value)} 
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Add Task
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Todo List */}
      <div className="px-4 py-6 space-y-4">
        {todos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
            <p className="text-gray-600 mb-4">Get started by adding your first task.</p>
            <Button 
              onClick={() => setAddOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        ) : (
          todos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onDelete={handleDeleteTodo}
              onEdit={handleEditTodo}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TodoCard({ 
  todo, 
  onDelete, 
  onEdit 
}: { 
  todo: TodoItem; 
  onDelete: (id: string) => void; 
  onEdit: (id: string, data: Partial<TodoItem>) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editDesc, setEditDesc] = useState(todo.description || "");
  const [editLinks, setEditLinks] = useState(
    (todo.links || []).map(l => l.href).join(", ")
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const links = editLinks
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map((href, i) => ({ label: `Link ${i + 1}`, href }));

    onEdit(todo.id, {
      title: editTitle,
      description: editDesc || undefined,
      links: links.length ? links : undefined,
    });
    setEditOpen(false);
  };

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 leading-tight">
            {todo.title}
          </CardTitle>
          <div className="flex gap-2 ml-4">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <Label htmlFor={`edit-title-${todo.id}`}>Title</Label>
                    <Input 
                      id={`edit-title-${todo.id}`}
                      value={editTitle} 
                      onChange={(e) => setEditTitle(e.target.value)} 
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-desc-${todo.id}`}>Description</Label>
                    <Textarea 
                      id={`edit-desc-${todo.id}`}
                      value={editDesc} 
                      onChange={(e) => setEditDesc(e.target.value)} 
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-links-${todo.id}`}>Links (comma separated)</Label>
                    <Input 
                      id={`edit-links-${todo.id}`}
                      value={editLinks} 
                      onChange={(e) => setEditLinks(e.target.value)} 
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDelete(todo.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {todo.description && (
          <p className="text-gray-700 text-sm mb-3 leading-relaxed">
            {todo.description}
          </p>
        )}
        {todo.links && todo.links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {todo.links.map((link, i) => (
              <a
                key={i}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Created {new Date(todo.created_at).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
