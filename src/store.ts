// Local persistence for the Project Engineer workspace.
//
// The workspace is a single-page app with no server: every record is kept in
// the browser's localStorage under one key and starts empty. Nothing is
// seeded — every project, task, inspection, change order, payment,
// procurement, and stakeholder is created by the person using the app.

import { useSyncExternalStore } from "react";

export type ProjectType =
  | "zeb_charging"
  | "microgrid"
  | "electrical"
  | "facility"
  | "transit"
  | "other";
export type ProjectPhase =
  | "planning"
  | "design"
  | "procurement"
  | "construction"
  | "integration"
  | "testing"
  | "closeout"
  | "complete";
export type ProjectStatus =
  | "on_track"
  | "at_risk"
  | "delayed"
  | "on_hold"
  | "complete";
export type Priority = "low" | "normal" | "high" | "critical";
export type TaskStatus = "open" | "in_progress" | "done";
export type InspectionType =
  | "site_visit"
  | "milestone"
  | "field_condition"
  | "safety"
  | "quality";
export type InspectionResult = "pending" | "pass" | "conditional" | "fail";
export type ChangeOrderStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "submitted" | "approved" | "paid";
export type ProcurementDocType = "SOW" | "RFP" | "RFQ";
export type ProcurementStage =
  | "draft"
  | "issued"
  | "evaluation"
  | "awarded"
  | "closed";

export interface Project {
  id: number;
  name: string;
  code: string;
  type: ProjectType;
  phase: ProjectPhase;
  status: ProjectStatus;
  priority: Priority;
  location: string;
  contractor: string;
  budget: number;
  spent: number;
  percentComplete: number;
  startDate: string;
  targetDate: string;
  description: string;
  notes: string;
  createdAt: string;
}

export interface Task {
  id: number;
  projectId: number | null;
  projectName: string;
  title: string;
  owner: string;
  dueDate: string;
  status: TaskStatus;
}

export interface Inspection {
  id: number;
  projectId: number | null;
  projectName: string;
  type: InspectionType;
  date: string;
  inspector: string;
  result: InspectionResult;
  findings: string;
  followUp: string;
  followUpDone: boolean;
}

export interface ChangeOrder {
  id: number;
  projectId: number | null;
  projectName: string;
  title: string;
  description: string;
  costImpact: number;
  scheduleDays: number;
  status: ChangeOrderStatus;
  requestedBy: string;
  date: string;
}

export interface Payment {
  id: number;
  projectId: number | null;
  projectName: string;
  payee: string;
  amount: number;
  period: string;
  status: PaymentStatus;
  date: string;
}

export interface Procurement {
  id: number;
  projectId: number | null;
  projectName: string;
  title: string;
  docType: ProcurementDocType;
  stage: ProcurementStage;
  dueDate: string;
  vendor: string;
  value: number;
}

export interface Stakeholder {
  id: number;
  name: string;
  org: string;
  role: string;
  projectId: number | null;
  projectName: string;
  contact: string;
  lastContact: string;
  notes: string;
}

export interface Workspace {
  projects: Project[];
  tasks: Task[];
  inspections: Inspection[];
  changeOrders: ChangeOrder[];
  payments: Payment[];
  procurements: Procurement[];
  stakeholders: Stakeholder[];
}

// Raw rows, as stored (without the derived projectName).
interface RawTask {
  id: number;
  projectId: number | null;
  title: string;
  owner: string;
  dueDate: string;
  status: TaskStatus;
}
interface RawInspection {
  id: number;
  projectId: number | null;
  type: InspectionType;
  date: string;
  inspector: string;
  result: InspectionResult;
  findings: string;
  followUp: string;
  followUpDone: boolean;
}
interface RawChangeOrder {
  id: number;
  projectId: number | null;
  title: string;
  description: string;
  costImpact: number;
  scheduleDays: number;
  status: ChangeOrderStatus;
  requestedBy: string;
  date: string;
}
interface RawPayment {
  id: number;
  projectId: number | null;
  payee: string;
  amount: number;
  period: string;
  status: PaymentStatus;
  date: string;
}
interface RawProcurement {
  id: number;
  projectId: number | null;
  title: string;
  docType: ProcurementDocType;
  stage: ProcurementStage;
  dueDate: string;
  vendor: string;
  value: number;
}
interface RawStakeholder {
  id: number;
  name: string;
  org: string;
  role: string;
  projectId: number | null;
  contact: string;
  lastContact: string;
  notes: string;
}

interface RawState {
  projects: Project[];
  tasks: RawTask[];
  inspections: RawInspection[];
  changeOrders: RawChangeOrder[];
  payments: RawPayment[];
  procurements: RawProcurement[];
  stakeholders: RawStakeholder[];
  nextId: number;
}

const STORAGE_KEY = "zeb-project-engineer-workspace-v1";

function emptyState(): RawState {
  return {
    projects: [],
    tasks: [],
    inspections: [],
    changeOrders: [],
    payments: [],
    procurements: [],
    stakeholders: [],
    nextId: 1,
  };
}

function load(): RawState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<RawState>;
    const base = emptyState();
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : base.projects,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : base.tasks,
      inspections: Array.isArray(parsed.inspections)
        ? parsed.inspections
        : base.inspections,
      changeOrders: Array.isArray(parsed.changeOrders)
        ? parsed.changeOrders
        : base.changeOrders,
      payments: Array.isArray(parsed.payments)
        ? parsed.payments
        : base.payments,
      procurements: Array.isArray(parsed.procurements)
        ? parsed.procurements
        : base.procurements,
      stakeholders: Array.isArray(parsed.stakeholders)
        ? parsed.stakeholders
        : base.stakeholders,
      nextId:
        typeof parsed.nextId === "number" && parsed.nextId > 0
          ? parsed.nextId
          : 1,
    };
  } catch {
    return emptyState();
  }
}

let state: RawState =
  typeof window !== "undefined" ? load() : emptyState();

const listeners = new Set<() => void>();
let cachedWorkspace: Workspace | null = null;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — the in-memory copy still works for
    // this session.
  }
}

function emit() {
  cachedWorkspace = null;
  persist();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function derive(): Workspace {
  if (cachedWorkspace) return cachedWorkspace;
  const names = new Map(state.projects.map((p) => [p.id, p.name]));
  const nameOf = (id: number | null) =>
    id != null ? (names.get(id) ?? "") : "";
  const byName = (a: string, b: string) => a.localeCompare(b);
  cachedWorkspace = {
    projects: [...state.projects].sort((a, b) => byName(a.name, b.name)),
    tasks: [...state.tasks]
      .sort((a, b) => {
        if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        return b.id - a.id;
      })
      .map((t) => ({ ...t, projectName: nameOf(t.projectId) })),
    inspections: [...state.inspections]
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return b.id - a.id;
      })
      .map((i) => ({ ...i, projectName: nameOf(i.projectId) })),
    changeOrders: [...state.changeOrders]
      .sort((a, b) => b.id - a.id)
      .map((c) => ({ ...c, projectName: nameOf(c.projectId) })),
    payments: [...state.payments]
      .sort((a, b) => b.id - a.id)
      .map((p) => ({ ...p, projectName: nameOf(p.projectId) })),
    procurements: [...state.procurements]
      .sort((a, b) => {
        if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        return b.id - a.id;
      })
      .map((p) => ({ ...p, projectName: nameOf(p.projectId) })),
    stakeholders: [...state.stakeholders]
      .sort((a, b) => byName(a.name, b.name))
      .map((s) => ({ ...s, projectName: nameOf(s.projectId) })),
  };
  return cachedWorkspace;
}

/** React hook returning the current workspace; re-renders on every change. */
export function useWorkspaceData(): Workspace {
  return useSyncExternalStore(subscribe, derive, derive);
}

function nextId(): number {
  return state.nextId++;
}

function requireName(value: string, what: string) {
  if (!value.trim()) throw new Error(`Give the ${what} a name first.`);
}

// ---- Data operations (same shape as the original server actions) ----

export const api = {
  getWorkspace(): Workspace {
    return derive();
  },

  createProject(
    fields: Omit<Project, "id" | "createdAt">,
  ): { id: number } {
    requireName(fields.name, "project");
    const id = nextId();
    state.projects.push({
      ...fields,
      id,
      createdAt: new Date().toISOString(),
    });
    emit();
    return { id };
  },

  updateProject(
    args: { id: number } & Omit<Project, "id" | "createdAt">,
  ): { ok: true } {
    const { id, ...fields } = args;
    const row = state.projects.find((p) => p.id === id);
    if (row) Object.assign(row, fields);
    emit();
    return { ok: true };
  },

  deleteProject(args: { id: number }): { ok: true } {
    // Linked records keep their rows but lose the project link
    // (their project name resolves to empty, as before).
    state.projects = state.projects.filter((p) => p.id !== args.id);
    emit();
    return { ok: true };
  },

  createTask(args: {
    projectId: number | null;
    title: string;
    owner: string;
    dueDate: string;
    status: TaskStatus;
  }): { id: number } {
    requireName(args.title, "task");
    const id = nextId();
    state.tasks.push({ id, ...args });
    emit();
    return { id };
  },

  setTaskStatus(args: { id: number; status: TaskStatus }): { ok: true } {
    const row = state.tasks.find((t) => t.id === args.id);
    if (row) row.status = args.status;
    emit();
    return { ok: true };
  },

  deleteTask(args: { id: number }): { ok: true } {
    state.tasks = state.tasks.filter((t) => t.id !== args.id);
    emit();
    return { ok: true };
  },

  createInspection(args: {
    projectId: number | null;
    type: InspectionType;
    date: string;
    inspector: string;
    result: InspectionResult;
    findings: string;
    followUp: string;
  }): { id: number } {
    const id = nextId();
    state.inspections.push({ id, ...args, followUpDone: false });
    emit();
    return { id };
  },

  setInspectionFollowUp(args: { id: number; done: boolean }): { ok: true } {
    const row = state.inspections.find((i) => i.id === args.id);
    if (row) row.followUpDone = args.done;
    emit();
    return { ok: true };
  },

  deleteInspection(args: { id: number }): { ok: true } {
    state.inspections = state.inspections.filter((i) => i.id !== args.id);
    emit();
    return { ok: true };
  },

  createChangeOrder(args: {
    projectId: number | null;
    title: string;
    description: string;
    costImpact: number;
    scheduleDays: number;
    status: ChangeOrderStatus;
    requestedBy: string;
    date: string;
  }): { id: number } {
    requireName(args.title, "change order");
    const id = nextId();
    state.changeOrders.push({ id, ...args });
    emit();
    return { id };
  },

  setChangeOrderStatus(args: {
    id: number;
    status: ChangeOrderStatus;
  }): { ok: true } {
    const row = state.changeOrders.find((c) => c.id === args.id);
    if (row) row.status = args.status;
    emit();
    return { ok: true };
  },

  deleteChangeOrder(args: { id: number }): { ok: true } {
    state.changeOrders = state.changeOrders.filter((c) => c.id !== args.id);
    emit();
    return { ok: true };
  },

  createPayment(args: {
    projectId: number | null;
    payee: string;
    amount: number;
    period: string;
    status: PaymentStatus;
    date: string;
  }): { id: number } {
    const id = nextId();
    state.payments.push({ id, ...args });
    emit();
    return { id };
  },

  setPaymentStatus(args: { id: number; status: PaymentStatus }): {
    ok: true;
  } {
    const row = state.payments.find((p) => p.id === args.id);
    if (row) row.status = args.status;
    emit();
    return { ok: true };
  },

  deletePayment(args: { id: number }): { ok: true } {
    state.payments = state.payments.filter((p) => p.id !== args.id);
    emit();
    return { ok: true };
  },

  createProcurement(args: {
    projectId: number | null;
    title: string;
    docType: ProcurementDocType;
    stage: ProcurementStage;
    dueDate: string;
    vendor: string;
    value: number;
  }): { id: number } {
    requireName(args.title, "procurement");
    const id = nextId();
    state.procurements.push({ id, ...args });
    emit();
    return { id };
  },

  setProcurementStage(args: {
    id: number;
    stage: ProcurementStage;
  }): { ok: true } {
    const row = state.procurements.find((p) => p.id === args.id);
    if (row) row.stage = args.stage;
    emit();
    return { ok: true };
  },

  deleteProcurement(args: { id: number }): { ok: true } {
    state.procurements = state.procurements.filter((p) => p.id !== args.id);
    emit();
    return { ok: true };
  },

  createStakeholder(args: {
    name: string;
    org: string;
    role: string;
    projectId: number | null;
    contact: string;
    lastContact: string;
    notes: string;
  }): { id: number } {
    requireName(args.name, "stakeholder");
    const id = nextId();
    state.stakeholders.push({ id, ...args });
    emit();
    return { id };
  },

  updateStakeholder(args: {
    id: number;
    name: string;
    org: string;
    role: string;
    projectId: number | null;
    contact: string;
    lastContact: string;
    notes: string;
  }): { ok: true } {
    const { id, ...fields } = args;
    const row = state.stakeholders.find((s) => s.id === id);
    if (row) Object.assign(row, fields);
    emit();
    return { ok: true };
  },

  deleteStakeholder(args: { id: number }): { ok: true } {
    state.stakeholders = state.stakeholders.filter((s) => s.id !== args.id);
    emit();
    return { ok: true };
  },
};

// ---- Small compatibility shims so the ported UI keeps its shape ----
//
// The original UI used async mutations with onSuccess/onError callbacks.
// Here every operation is synchronous (localStorage), so this shim runs the
// function immediately and calls the matching callback.

export function useMutation<TArgs = unknown>(opts: {
  mutationFn: (args: TArgs) => unknown;
  onSuccess?: () => void;
  onError?: (e: Error) => void;
}): { mutate: (args?: TArgs) => void; isPending: boolean } {
  return {
    isPending: false,
    mutate: (args?: TArgs) => {
      try {
        const result = opts.mutationFn(args as TArgs);
        if (
          result &&
          typeof (result as { then?: unknown }).then === "function"
        ) {
          (result as Promise<unknown>)
            .then(() => opts.onSuccess?.())
            .catch((e: unknown) =>
              opts.onError?.(
                e instanceof Error ? e : new Error(String(e)),
              ),
            );
        } else {
          opts.onSuccess?.();
        }
      } catch (e) {
        opts.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    },
  };
}

export function useQueryClient(): {
  invalidateQueries: (...args: unknown[]) => void;
} {
  // No cache to invalidate — the store notifies subscribers directly.
  return { invalidateQueries: () => {} };
}
