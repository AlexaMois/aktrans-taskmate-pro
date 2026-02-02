import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import StatsCards from "@/components/StatsCards";
import TaskFilters from "@/components/TaskFilters";
import QuickTaskInput from "@/components/QuickTaskInput";
import KanbanBoard from "@/components/KanbanBoard";
import TaskModal from "@/components/TaskModal";
import { Task, User, TaskStatus } from "@/types";
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

  // tabs
  const [activeTab, setActiveTab] = useState<"all" | "my">("all");

  // filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");

  // modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // redirect if not logged
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // load data
  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, usersRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, owner:profiles!tasks_owner_id_fkey(*), author:profiles!tasks_author_id_fkey(*)")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("*, user_roles(role)").eq("active", true),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (usersRes.error) throw usersRes.error;

      const mappedTasks: Task[] = (tasksRes.data || []).map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status as TaskStatus,
        priority: t.priority as "normal" | "urgent",
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
              role: "user",
            }
          : null,
        author: t.author
          ? {
              id: t.author.id,
              telegram_id: t.author.telegram_id,
              name: t.author.name,
              active: t.author.active,
              role: "user",
            }
          : null,
      }));

      const mappedUsers: User[] = (usersRes.data || []).map((u) => ({
        id: u.id,
        telegram_id: u.telegram_id,
        name: u.name,
        active: u.active,
        role: u.user_roles?.[0]?.role || "user",
      }));

      setTasks(mappedTasks);
      setUsers(mappedUsers);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки данных");
    } finally {
      setIsLoading(false);
    }
  };

  // filtering
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // My tasks
    if (activeTab === "my" && user) {
      result = result.filter((t) => t.owner_id === user.id || t.author_id === user.id);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          t.author?.name?.toLowerCase().includes(q) ||
          t.owner?.name?.toLowerCase().includes(q),
      );
    }

    if (selectedOwner !== "all") {
      result = result.filter((t) => t.owner_id === selectedOwner);
    }

    if (selectedStatus !== "all") {
      result = result.filter((t) => t.status === selectedStatus);
    }

    if (selectedPriority !== "all") {
      result = result.filter((t) => t.priority === selectedPriority);
    }

    return result;
  }, [tasks, activeTab, user, searchQuery, selectedOwner, selectedStatus, selectedPriority]);

  // create task
  const handleCreateTask = async (title: string, isUrgent: boolean) => {
    if (!user) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title,
          priority: isUrgent ? "urgent" : "normal",
          author_id: user.id,
          status: "ideas",
        })
        .select()
        .single();

      if (error) throw error;

      setTasks((prev) => [data as Task, ...prev]);
      toast.success("Задача создана");
    } catch (err) {
      console.error(err);
      toast.error("Ошибка создания задачи");
    } finally {
      setIsCreating(false);
    }
  };

  // change status
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const isAdmin = user?.role === "admin";
    const isAuthor = task.author_id === user?.id;

    if (!isAdmin && !isAuthor) {
      toast.error("Нет прав");
      return;
    }

    try {
      const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);

      if (error) throw error;

      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

      toast.success("Статус обновлён");
    } catch (err) {
      console.error(err);
      toast.error("Ошибка обновления");
    }
  };

  // modal
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleTaskUpdate = (task: Task) => {
    setTasks(tasks.map((t) => (t.id === task.id ? task : t)));
  };

  const handleTaskDelete = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  // loaders
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">
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
          setSelectedTask(null);
          setIsModalOpen(false);
        }}
        users={users}
        onTaskUpdate={handleTaskUpdate}
        onTaskDelete={handleTaskDelete}
      />
    </div>
  );
}
