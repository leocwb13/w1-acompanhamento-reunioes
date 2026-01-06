import { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar,
  AlertCircle,
  User as UserIcon,
  Clock,
  Flag,
  Lock,
  Plus
} from 'lucide-react';
import { getAllTasks, updateTaskStatus } from '../services/taskService';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import type { Database, TaskStatus, TaskPriority } from '../lib/database.types';

type Task = Database['public']['Tables']['tasks']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

interface TaskWithClient extends Task {
  client: Client;
}

interface KanbanBoardProps {
  selectedClientId: string | null;
  onSelectClient?: (clientId: string) => void;
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'bg-gray-100 border-gray-300' },
  { id: 'pendente', label: 'Pendente', color: 'bg-blue-100 border-blue-300' },
  { id: 'em_andamento', label: 'Em Andamento', color: 'bg-yellow-100 border-yellow-300' },
  { id: 'em_revisao', label: 'Em Revisão', color: 'bg-purple-100 border-purple-300' },
  { id: 'concluida', label: 'Concluída', color: 'bg-green-100 border-green-300' }
];

const PRIORITY_CONFIG = {
  baixa: { label: 'Baixa', color: 'bg-gray-200 text-gray-700', icon: Flag },
  media: { label: 'Média', color: 'bg-blue-200 text-blue-700', icon: Flag },
  alta: { label: 'Alta', color: 'bg-orange-200 text-orange-700', icon: Flag },
  urgente: { label: 'Urgente', color: 'bg-red-200 text-red-700', icon: AlertCircle }
};

function TaskCard({ task }: { task: TaskWithClient }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const priorityConfig = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const PriorityIcon = priorityConfig?.icon || Flag;

  const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'concluida';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg p-3 shadow-sm border-2 cursor-move hover:shadow-md transition-shadow ${
        isOverdue ? 'border-red-300' : 'border-gray-200'
      } ${task.blocked ? 'opacity-60' : ''}`}
    >
      {task.blocked && (
        <div className="flex items-center gap-1 mb-2 text-xs text-red-600">
          <Lock className="w-3 h-3" />
          <span>Bloqueada</span>
        </div>
      )}

      <h4 className="font-medium text-gray-900 text-sm mb-2">{task.title}</h4>

      {task.description && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-1 mb-2">
        {priorityConfig && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${priorityConfig.color}`}>
            <PriorityIcon className="w-3 h-3" />
            {priorityConfig.label}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <UserIcon className="w-3 h-3" />
          <span>{task.owner}</span>
        </div>

        <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
          <Calendar className="w-3 h-3" />
          <span>{new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
        </div>
      </div>

      {!task.client_id && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-600">{task.client.name}</span>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  column,
  tasks,
  onAddTask
}: {
  column: typeof COLUMNS[0];
  tasks: TaskWithClient[];
  onAddTask: (status: TaskStatus) => void;
}) {
  return (
    <div className={`flex flex-col rounded-lg border-2 ${column.color} p-3 min-w-[280px]`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{column.label}</h3>
          <span className="bg-white px-2 py-0.5 rounded-full text-xs font-medium text-gray-600">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(column.id)}
          className="p-1 hover:bg-white rounded transition-colors"
          title="Adicionar tarefa"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[200px]">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function KanbanBoard({ selectedClientId, onSelectClient }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<TaskWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<TaskWithClient | null>(null);
  const { showToast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadTasks();
  }, [selectedClientId]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const allTasks = await getAllTasks();
      let filteredTasks = allTasks;

      if (selectedClientId) {
        filteredTasks = allTasks.filter(task => task.client_id === selectedClientId);
      }

      filteredTasks = filteredTasks.filter(task => task.status !== 'cancelada');

      setTasks(filteredTasks as any);
    } catch (error) {
      console.error('Error loading tasks:', error);
      showToast('Erro ao carregar tarefas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveTask(null);

    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overColumn = COLUMNS.find(col =>
      tasks.filter(t => t.status === col.id).some(t => t.id === over.id)
    );

    if (!overColumn) {
      const droppedColumn = COLUMNS.find(col => over.id === col.id);
      if (droppedColumn && activeTask.status !== droppedColumn.id) {
        try {
          await updateTaskStatus(activeTask.id, droppedColumn.id);
          await loadTasks();
          showToast('Tarefa movida com sucesso', 'success');
        } catch (error) {
          showToast('Erro ao mover tarefa', 'error');
        }
      }
      return;
    }

    if (activeTask.status !== overColumn.id) {
      try {
        await updateTaskStatus(activeTask.id, overColumn.id);
        await loadTasks();
        showToast('Tarefa movida com sucesso', 'success');
      } catch (error) {
        showToast('Erro ao mover tarefa', 'error');
      }
    } else {
      const activeIndex = tasks.findIndex(t => t.id === active.id);
      const overIndex = tasks.findIndex(t => t.id === over.id);

      if (activeIndex !== overIndex) {
        setTasks(arrayMove(tasks, activeIndex, overIndex));
      }
    }
  };

  const handleAddTask = (status: TaskStatus) => {
    showToast('Use o chat para criar uma nova tarefa após uma reunião', 'info');
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-6 overflow-x-auto h-full">
        {COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={getTasksByStatus(column.id)}
            onAddTask={handleAddTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-3 opacity-90">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
