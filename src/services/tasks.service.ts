import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import supabaseService from './supabase.service'
import { Task, TaskType, TaskUser } from '../entities'
import { TaskCreateDTO, TaskUpdateDTO } from '../validators/task.validator'

interface ITaskService {
  subscribe: (projectId: number, callback: (payload: RealtimePostgresChangesPayload<Task>) => void) => void
  create: (data: TaskCreateDTO, projectId: number, userId: string) => Promise<{ task: Task; taskUser: TaskUser }>
  update: (id: number, data: TaskUpdateDTO) => Promise<{ task: Task }>
  delete: (id: number) => Promise<{ task: Task }>
  listByProjectId: (projectId: number) => Promise<{ task: Task[] }>
  move: (taskId: number, toType: TaskType, newOrder: number) => Promise<{ task: Task[] }>
}

class TaskService implements ITaskService {
  private static instance: TaskService

  static createInstance() {
    if (!TaskService.instance) TaskService.instance = new TaskService()
    return TaskService.instance
  }

  subscribe = (projectId: number, callback: (payload: RealtimePostgresChangesPayload<Task>) => void) => {
    supabaseService
      .channel(`tasks-project-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, callback)
      .subscribe()
  }

  create = async (payload: TaskCreateDTO, projectId: number, userId: string) => {
    const { data } = await supabaseService
      .from('tasks')
      .insert({ ...payload, project_id: projectId })
      .select('*')
      .single()
      .throwOnError()

    const newTask = data!

    try {
      const { data: taskUser } = await supabaseService
        .from('task_users')
        .insert({
          task_id: newTask.id,
          user_id: userId,
        })
        .select('*')
        .single()
        .throwOnError()

      return { task: newTask, taskUser: taskUser! }
    } catch (error) {
      await this.delete(newTask.id)
      throw error
    }
  }

  update = async (id: number, data: TaskUpdateDTO) => {
    const { data: task } = await supabaseService.from('tasks').update(data).eq('id', id).select('*').single().throwOnError()

    return { task: task! }
  }

  delete = async (id: number) => {
    const { data: task } = await supabaseService.from('tasks').select('*').eq('id', id).single().throwOnError()
    await supabaseService.from('tasks').delete().eq('id', id).throwOnError()

    return { task: task! }
  }

  move = async (taskId: number, toType: TaskType, newOrder: number) => {
    const { data } = await supabaseService.from('tasks').select('*').eq('id', taskId).single().throwOnError()
    const currentTask = data!

    let updatedToTasks: Task[] = []
    if (currentTask.type !== toType) {
      const { data: toTasks } = await supabaseService
        .from('tasks')
        .select('*')
        .eq('type', toType)
        .eq('project_id', currentTask.project_id)
        .gte('position', newOrder)
        .order('position', { ascending: false })
        .throwOnError()

      updatedToTasks = toTasks!.map((task) => ({ ...task, position: task.position + 1 }))
      await supabaseService.from('tasks').upsert(updatedToTasks).throwOnError()
    }

    await supabaseService.from('tasks').update({ position: 0, type: toType }).eq('id', taskId).select('*').single().throwOnError()

    let fromTasksQuery = supabaseService
      .from('tasks')
      .select('*')
      .eq('type', currentTask.type)
      .eq('project_id', currentTask.project_id)
      .gt('position', currentTask.position)
      .throwOnError()

    if (currentTask.type === toType) {
      fromTasksQuery = fromTasksQuery.lte('position', newOrder)
    }

    const { data: fromTasks } = await fromTasksQuery
    const updatedFromTasks = fromTasks!.map((task) => ({ ...task, position: task.position - 1 }))
    await supabaseService.from('tasks').upsert(updatedFromTasks).throwOnError()

    const { data: updatedTask } = await supabaseService
      .from('tasks')
      .update({ position: newOrder, type: toType })
      .eq('id', taskId)
      .select('*')
      .single()
      .throwOnError()

    return { task: [...updatedToTasks, ...updatedFromTasks, updatedTask!] }
  }

  listByProjectId: (projectId: number) => Promise<{ task: Task[] }> = async (projectId) => {
    const { data: task } = await supabaseService.from('tasks').select('*').eq('project_id', projectId).throwOnError()

    return { task: task! }
  }
}

export default TaskService.createInstance()
