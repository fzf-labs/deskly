import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { db, type Task } from '@/data';
import { getSessionsDir } from '@/lib/paths';
import {
  addBackgroundTask,
  getBackgroundTask,
  getRunningTaskCount,
  removeBackgroundTask,
  subscribeToBackgroundTasks,
  type BackgroundTask,
} from '../model/background-tasks';

import type {
  AgentMessage,
  AgentPhase,
  MessageAttachment,
  PendingQuestion,
  PermissionRequest,
  SessionInfo,
  TaskPlan,
} from './agent';

type TaskNodeLike = {
  id: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'failed';
};

export type {
  PermissionRequest,
  QuestionOption,
  AgentQuestion,
  PendingQuestion,
  MessageAttachment,
  AgentMessage,
  PlanStep,
  TaskPlan,
  AgentPhase,
  SessionInfo,
} from './agent';

export interface UseAgentReturn {
  messages: AgentMessage[];
  setMessages: Dispatch<SetStateAction<AgentMessage[]>>;
  isRunning: boolean;
  taskId: string | null;
  sessionId: string | null;
  sessionFolder: string | null;
  taskFolder: string | null;
  pendingPermission: PermissionRequest | null;
  pendingQuestion: PendingQuestion | null;
  phase: AgentPhase;
  plan: TaskPlan | null;
  runAgent: (
    prompt: string,
    existingTaskId?: string,
    sessionInfo?: SessionInfo,
    attachments?: MessageAttachment[],
    workDirOverride?: string
  ) => Promise<string>;
  approvePlan: () => Promise<void>;
  rejectPlan: () => void;
  continueConversation: (
    reply: string,
    attachments?: MessageAttachment[],
    workDirOverride?: string
  ) => Promise<void>;
  stopAgent: () => Promise<void>;
  clearMessages: () => void;
  loadTask: (taskId: string) => Promise<Task | null>;
  loadMessages: (taskId: string) => Promise<void>;
  respondToPermission: (
    permissionId: string,
    approved: boolean
  ) => Promise<void>;
  respondToQuestion: (
    questionId: string,
    answers: Record<string, string>
  ) => Promise<void>;
  setSessionInfo: (sessionId: string | null) => void;
  backgroundTasks: BackgroundTask[];
  runningBackgroundTaskCount: number;
}

const appendSystemError = (
  setMessages: Dispatch<SetStateAction<AgentMessage[]>>,
  content: string
) => {
  setMessages((prev) => [
    ...prev,
    {
      type: 'error',
      content,
    },
  ]);
};

const getCurrentTaskNodeRuntime = async (currentTaskId: string): Promise<{
  id: string;
  sessionId: string | null;
  cliToolId: string | null;
} | null> => {
  try {
    const currentNode = (await db.getCurrentTaskNode(currentTaskId)) as {
      id?: string;
      session_id?: string | null;
      cli_tool_id?: string | null;
    } | null;
    if (currentNode?.id) {
      return {
        id: currentNode.id,
        sessionId: currentNode.session_id ?? null,
        cliToolId: currentNode.cli_tool_id ?? null,
      };
    }

    const nodes = (await db.getTaskNodes(currentTaskId)) as Array<{
      id: string;
      session_id?: string | null;
      cli_tool_id?: string | null;
    }>;
    const first = nodes[0];
    if (!first) return null;
    return {
      id: first.id,
      sessionId: first.session_id ?? null,
      cliToolId: first.cli_tool_id ?? null,
    };
  } catch (error) {
    console.error('[useAgent] Failed to resolve task node runtime:', error);
    return null;
  }
};

export function useAgent(): UseAgentReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [sessionFolder, setSessionFolder] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] =
    useState<PermissionRequest | null>(null);
  const [pendingQuestion, setPendingQuestion] =
    useState<PendingQuestion | null>(null);
  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [runningBackgroundTaskCount, setRunningBackgroundTaskCount] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const initialPromptRef = useRef<string>('');

  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    const unsubscribe = subscribeToBackgroundTasks((tasks) => {
      setBackgroundTasks(tasks);
      setRunningBackgroundTaskCount(getRunningTaskCount());
    });
    return unsubscribe;
  }, []);

  const setSessionInfo = useCallback((sessionId: string | null) => {
    sessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);
  }, []);

  const loadTask = useCallback(async (id: string): Promise<Task | null> => {
    const currentTaskId = activeTaskIdRef.current;
    if (currentTaskId && currentTaskId !== id && isRunning && sessionIdRef.current) {
      addBackgroundTask({
        taskId: currentTaskId,
        sessionId: sessionIdRef.current,
        abortController: new AbortController(),
        isRunning: true,
        prompt: initialPromptRef.current,
      });
    }

    activeTaskIdRef.current = id;
    setMessages([]);
    setPendingPermission(null);
    setPendingQuestion(null);
    setPlan(null);

    try {
      const task = await db.getTask(id);
      if (!task) return null;

      initialPromptRef.current = task.prompt || '';

      const nodeRuntime = await getCurrentTaskNodeRuntime(id);
      const sessionId = nodeRuntime?.sessionId ?? null;
      setSessionInfo(sessionId);

      try {
        const sessionsDir = await getSessionsDir();
        const projectKey = task.project_id || 'project';
        setSessionFolder(`${sessionsDir}/${projectKey}/${task.id}`);
      } catch (error) {
        console.error('[useAgent] Failed to compute session folder:', error);
        setSessionFolder(null);
      }

      return task;
    } catch (error) {
      console.error('[useAgent] Failed to load task:', error);
      return null;
    }
  }, [isRunning, setSessionInfo]);

  const loadMessages = useCallback(async (id: string): Promise<void> => {
    activeTaskIdRef.current = id;
    setTaskId(id);
    setMessages([]);
    setPendingPermission(null);
    setPendingQuestion(null);
    setPlan(null);

    const backgroundTask = getBackgroundTask(id);
    if (backgroundTask && backgroundTask.isRunning) {
      setSessionInfo(backgroundTask.sessionId);
      setIsRunning(true);
      setPhase('executing');
      removeBackgroundTask(id);
      return;
    }

    setIsRunning(false);
    setPhase('idle');
  }, [setSessionInfo]);

  const stopAgent = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    if (currentSessionId && window.api?.cliSession?.stopSession) {
      try {
        await window.api.cliSession.stopSession(currentSessionId);
      } catch (error) {
        console.error('[useAgent] Failed to stop CLI session:', error);
      }
    }

    if (taskId) {
      try {
        const currentNode = (await db.getCurrentTaskNode(taskId)) as TaskNodeLike | null;
        if (currentNode?.id && currentNode.status === 'in_progress') {
          await db.stopTaskNodeExecution(currentNode.id, 'stopped_by_user');
        }
      } catch (error) {
        console.error('[useAgent] Failed to stop task node execution:', error);
      }
    }

    setIsRunning(false);
    setPhase('idle');
  }, [taskId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setTaskId(null);
    setSessionInfo(null);
    setSessionFolder(null);
    setPendingPermission(null);
    setPendingQuestion(null);
    setPlan(null);
    setPhase('idle');
    setIsRunning(false);
    activeTaskIdRef.current = null;
    initialPromptRef.current = '';
  }, [setSessionInfo]);

  const runAgent = useCallback(async (
    prompt: string,
    existingTaskId?: string,
    _sessionInfo?: SessionInfo,
    attachments?: MessageAttachment[]
  ): Promise<string> => {
    const targetTaskId = existingTaskId ?? taskId;
    if (targetTaskId) {
      setTaskId(targetTaskId);
    }

    setPhase('idle');
    appendSystemError(
      setMessages,
      'Legacy agent HTTP runtime has been removed. Please use the CLI session flow.'
    );

    if (prompt.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          type: 'user',
          content: prompt,
          attachments,
        },
      ]);
    }

    return targetTaskId ?? '';
  }, [taskId]);

  const approvePlan = useCallback(async (): Promise<void> => {
    setPlan(null);
    setPhase('idle');
  }, []);

  const rejectPlan = useCallback((): void => {
    setPlan(null);
    setPhase('idle');
  }, []);

  const continueConversation = useCallback(async (
    reply: string,
    attachments?: MessageAttachment[]
  ): Promise<void> => {
    if (reply.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          type: 'user',
          content: reply,
          attachments,
        },
      ]);
    }
    appendSystemError(
      setMessages,
      'Legacy agent HTTP runtime has been removed. Please continue with the CLI session flow.'
    );
    setPhase('idle');
  }, []);

  const respondToPermission = useCallback(async (
    permissionId: string,
    approved: boolean
  ): Promise<void> => {
    setPendingPermission(null);
    setMessages((prev) => [
      ...prev,
      {
        type: 'text',
        content: approved
          ? `Permission ${permissionId} approved.`
          : `Permission ${permissionId} denied.`,
      },
    ]);
  }, []);

  const respondToQuestion = useCallback(async (
    questionId: string,
    answers: Record<string, string>
  ): Promise<void> => {
    setPendingQuestion(null);
    setMessages((prev) => [
      ...prev,
      {
        type: 'text',
        content: `Question ${questionId} answered: ${Object.values(answers).join(', ')}`,
      },
    ]);
  }, []);

  return {
    messages,
    setMessages,
    isRunning,
    taskId,
    sessionId: currentSessionId,
    sessionFolder,
    taskFolder: sessionFolder,
    pendingPermission,
    pendingQuestion,
    phase,
    plan,
    runAgent,
    approvePlan,
    rejectPlan,
    continueConversation,
    stopAgent,
    clearMessages,
    loadTask,
    loadMessages,
    respondToPermission,
    respondToQuestion,
    setSessionInfo,
    backgroundTasks,
    runningBackgroundTaskCount,
  };
}
