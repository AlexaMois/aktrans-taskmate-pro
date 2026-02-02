import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import StatsCards from "@/components/StatsCards";
import TaskFilters from "@/components/TaskFilters";
import QuickTaskInput from "@/components/QuickTaskInput";
import KanbanBoard from "@/components/KanbanBoard";
import TaskModal from "@/components/TaskModal";
import { Task, User, TaskStatus, TaskScope } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [activeTab, setActiveTab] = useState<TaskScope>("common");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Build tasks query based on user role - filter at DB level for privacy
      let tasksQuery = supabase
        .from("tasks")
        .select("*, owner:profiles!tasks_owner_id_fkey(*), author:profiles!tasks_author_id_fkey(*)")
        .order("created_at", { ascending: false });

      // Non-admin users only see: common tasks OR their own personal tasks
      if (user && user.role !== "admin") {
        tasksQuery = tasksQuery.or(`scope.eq.common,and(scope.eq.personal,owner_id.eq.${user.id})`);
      }

      const [tasksRes, usersRes] = await Promise.all([
        tasksQuery,
        supabase.from("profiles").select("*, user_roles(role)").eq("active", true),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (usersRes.error) throw usersRes.error;

      const mappedTasks: Task[] = (tasksRes.data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status as TaskStatus,
        priority: t.priority as number,
        scope: (t.scope || 'common') as TaskScope,
        owner_id: t.owner_id,
        author_id: t.author_id,
        created_at: t.created_at,
        updated_at: t.updated_at,
        owner: t.owner
          ? {
              id: t.owner.id,
              telegram_id: t.owner.telegram_id,
              name: t.owner.name,
              active: t.owner.active,
              role: "user" as const,
            }
          : null,
        author: t.author
          ? {
              id: t.author.id,
              telegram_id: t.author.telegram_id,
              name: t.author.name,
              active: t.author.active,
              role: "user" as const,
            }
          : null,
      }));

      const mappedUsers: User[] = (usersRes.data || []).map((u: any) => ({
        id: u.id,
        telegram_id: u.telegram_id,
        name: u.name,
        active: u.active,
        role: (u.user_roles && u.user_roles[0]?.role) || "user",
      }));

      setTasks(mappedTasks);
      setUsers(mappedUsers);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Ошибка загрузки данных");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by scope (tab)
    if (activeTab === "common") {
      result = result.filter((t) => t.scope === "common");
    } else if (activeTab === "personal" && user) {
      result = result.filter((t) => t.scope === "personal" && t.owner_id === user.id);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => {
        const title = (t.title || "").toLowerCase();
        const desc = (t.description || "").toLowerCase();
        const author = (t.author?.name || "").toLowerCase();
        const owner = (t.owner?.name || "").toLowerCase();
        return title.includes(q) || desc.includes(q) || author.includes(q) || owner.includes(q);
      });
    }

    if (selectedOwner !== "all") {
      result = result.filter((t) => t.owner_id === selectedOwner);
    }

    if (selectedStatus !== "all") {
      result = result.filter((t) => t.status === selectedStatus);
    }

    if (selectedPriority !== "all") {
      result = result.filter((t) => t.priority === parseInt(selectedPriority));
    }

    return result;
  }, [tasks, activeTab, user, searchQuery, selectedOwner, selectedStatus, selectedPriority]);

  const syncTaskToSheets = async (task: Task) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-sheets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            scope: task.scope,
            author_name: task.author?.name || "",
            owner_name: task.owner?.name || null,
            owner_telegram_id: task.owner?.telegram_id || null,
            created_at: task.created_at,
            updated_at: task.updated_at,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Sync to sheets failed:", errorData);
      }
    } catch (error) {
      console.error("Error syncing to sheets:", error);
    }
  };

  const handleCreateTask = async (title: string) => {
    if (!user) return;

    setIsCreating(true);
    try {
      const scope: TaskScope = activeTab;
      const insertData = {
        title,
        priority: 3, // Default: Низкий
        author_id: user.id,
        owner_id: user.id, // Always set owner to current user
        status: "ideas" as const,
        scope,
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert(insertData)
        .select("*, owner:profiles!tasks_owner_id_fkey(*), author:profiles!tasks_author_id_fkey(*)")
        .single();

      if (error) throw error;

      await supabase.from("task_history").insert({
        task_id: data.id,
        action: "Задача создана",
        old_value: null,
        new_value: title,
        author_id: user.id,
      });

      const newTask: Task = {
        id: data.id,
        title: data.title,
        description: data.description,
        status: data.status as TaskStatus,
        priority: data.priority as number,
        scope: data.scope as TaskScope,
        owner_id: data.owner_id,
        author_id: data.author_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        owner: data.owner
          ? {
              id: data.owner.id,
              telegram_id: data.owner.telegram_id,
              name: data.owner.name,
              active: data.owner.active,
              role: "user" as const,
            }
          : null,
        author: data.author
          ? {
              id: data.author.id,
              telegram_id: data.author.telegram_id,
              name: data.author.name,
              active: data.author.active,
              role: "user" as const,
            }
          : null,
      };

      setTasks((prev) => [newTask, ...prev]);
      toast.success("Задача создана");

      // Sync to Google Sheets in background
      syncTaskToSheets(newTask);
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Ошибка создания задачи");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const isAdmin = user?.role === "admin";
    const isAuthor = task.author_id === user?.id;
    const canEdit = isAdmin || isAuthor;

    if (!canEdit) {
      toast.error("Нет прав на изменение");
      return;
    }

    if (newStatus === "done" && !isAdmin) {
      toast.error("Только админ может завершить задачу");
      return;
    }

    try {
      const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);

      if (error) throw error;

      const { STATUS_LABELS } = await import("@/types");
      await supabase.from("task_history").insert({
        task_id: taskId,
        action: "Изменён статус",
        old_value: STATUS_LABELS[task.status],
        new_value: STATUS_LABELS[newStatus],
        author_id: user!.id,
      });

      const { data: updatedData } = await supabase.from("tasks").select("updated_at").eq("id", taskId).single();

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, updated_at: updatedData?.updated_at || t.updated_at } : t,
        ),
      );

      toast.success("Статус обновлён");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Ошибка обновления");
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 container mx-auto px-4 py-4 space-y-4">
        {user.role === "admin" && <StatsCards tasks={tasks} />}

        <TaskFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedOwner={selectedOwner}
          onOwnerChange={setSelectedOwner}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedPriority={selectedPriority}
          onPriorityChange={setSelectedPriority}
          users={users}
        />

        <QuickTaskInput onCreateTask={handleCreateTask} isCreating={isCreating} />

        <KanbanBoard tasks={filteredTasks} onTaskClick={handleTaskClick} onStatusChange={handleStatusChange} />
      </main>

      <TaskModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
        }}
        users={users}
        onTaskUpdate={handleTaskUpdate}
        onTaskDelete={handleTaskDelete}
      />
    </div>
  );
}
