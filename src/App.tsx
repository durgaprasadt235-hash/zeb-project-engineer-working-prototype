import { useMemo, useState, type ReactNode } from "react";
import {
  api,
  useMutation,
  useQueryClient,
  useWorkspaceData,
  type Workspace,
} from "./store";
type Project = Workspace["projects"][number];
type Task = Workspace["tasks"][number];
type Inspection = Workspace["inspections"][number];
type ChangeOrder = Workspace["changeOrders"][number];
type Payment = Workspace["payments"][number];
type Procurement = Workspace["procurements"][number];
type Stakeholder = Workspace["stakeholders"][number];

type Tab =
  | "dashboard"
  | "projects"
  | "inspections"
  | "procurement"
  | "finance"
  | "stakeholders"
  | "brief";

// ---------- labels ----------

const TYPE_LABELS: Record<Project["type"], string> = {
  zeb_charging: "ZEB charging",
  microgrid: "Microgrid",
  electrical: "Electrical infrastructure",
  facility: "Facility upgrade",
  transit: "Transit operations",
  other: "Other",
};
const PHASE_LABELS: Record<Project["phase"], string> = {
  planning: "Planning",
  design: "Design",
  procurement: "Procurement",
  construction: "Construction",
  integration: "Integration",
  testing: "Testing",
  closeout: "Closeout",
  complete: "Complete",
};
const PHASES = Object.keys(PHASE_LABELS) as Project["phase"][];
const STATUS_LABELS: Record<Project["status"], string> = {
  on_track: "On track",
  at_risk: "At risk",
  delayed: "Delayed",
  on_hold: "On hold",
  complete: "Complete",
};
const INSP_TYPE_LABELS: Record<Inspection["type"], string> = {
  site_visit: "Site visit",
  milestone: "Milestone inspection",
  field_condition: "Field condition",
  safety: "Safety",
  quality: "Quality control",
};
const RESULT_LABELS: Record<Inspection["result"], string> = {
  pending: "Pending",
  pass: "Pass",
  conditional: "Conditional",
  fail: "Fail",
};
const STAGE_LABELS: Record<Procurement["stage"], string> = {
  draft: "Draft",
  issued: "Issued",
  evaluation: "Evaluation",
  awarded: "Awarded",
  closed: "Closed",
};

// ---------- helpers ----------

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(d: string): string {
  if (!d) return "—";
  const parsed = new Date(`${d}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusColor(status: string): string {
  switch (status) {
    case "on_track":
    case "pass":
    case "approved":
    case "paid":
    case "complete":
    case "awarded":
      return "var(--green)";
    case "at_risk":
    case "conditional":
    case "pending":
    case "submitted":
    case "evaluation":
      return "var(--amber)";
    case "delayed":
    case "fail":
    case "rejected":
      return "var(--red)";
    default:
      return "var(--dim)";
  }
}

function Badge({ label, color }: { label: string; color?: string }) {
  const c = color ?? "var(--dim)";
  return (
    <span
      className="inline-block border px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide uppercase"
      style={{ color: c, borderColor: c, borderRadius: 2 }}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold tracking-wide text-[var(--dim)] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm text-[var(--text)]";
const inputStyle = { borderRadius: "var(--radius)" } as const;

function PrimaryButton({
  children,
  onClick,
  disabled,
  submit,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  submit?: boolean;
}) {
  return (
    <button
      type={submit ? "submit" : "button"}
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 text-sm font-semibold disabled:opacity-50"
      style={{
        background: "var(--accent)",
        color: "var(--accent-text)",
        borderRadius: "var(--radius)",
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)]"
      style={{ borderRadius: "var(--radius)" }}
    >
      {children}
    </button>
  );
}

function DeleteControl({
  label,
  onDelete,
  pending,
}: {
  label: string;
  onDelete: () => void;
  pending?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => setConfirming(true)}
        className="px-2 py-1.5 text-sm font-medium"
        style={{ color: "var(--red)" }}
      >
        Delete
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={`Confirm ${label}`}
        onClick={onDelete}
        disabled={pending}
        className="px-2 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--red)", borderRadius: "var(--radius)" }}
      >
        Confirm delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="px-2 py-1.5 text-sm text-[var(--dim)]"
      >
        Cancel
      </button>
    </span>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm font-medium" style={{ color: "var(--red)" }}>
      {message}
    </p>
  );
}

function ProjectPicker({
  projects,
  value,
  onChange,
  label = "Project",
}: {
  projects: Project[];
  value: number | null;
  onChange: (id: number | null) => void;
  label?: string;
}) {
  return (
    <Field label={label}>
      <select
        aria-label={label}
        className={inputCls}
        style={inputStyle}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      >
        <option value="">No project linked</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--dim)]"
      style={{ borderRadius: "var(--radius)" }}
    >
      {children}
    </div>
  );
}

// ---------- App shell ----------

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "projects", label: "Projects" },
  { id: "inspections", label: "Inspections" },
  { id: "procurement", label: "Procurement" },
  { id: "finance", label: "Finance" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "brief", label: "Role brief" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const data = useWorkspaceData();
  const ws = { isPending: false, error: null as string | null, data };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b-2 border-[var(--accent)] bg-[var(--surface)] px-4 pt-3 pb-0">
        <p className="font-mono text-[11px] tracking-widest text-[var(--dim)] uppercase">
          Prince George's County DPW&amp;T · Office of Transportation
        </p>
        <h1 className="mt-0.5 text-xl font-bold">
          Project Engineer Workspace
        </h1>
        <p className="mt-0.5 text-sm text-[var(--dim)]">
          ZEB charging, microgrid &amp; facility projects · Largo, MD
        </p>
        <nav
          aria-label="Workspace sections"
          className="mt-3 flex flex-wrap gap-1"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
              className="px-3 py-2 text-sm font-semibold"
              style={{
                borderBottom:
                  tab === t.id
                    ? "3px solid var(--amber)"
                    : "3px solid transparent",
                color: tab === t.id ? "var(--text)" : "var(--dim)",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-10">
        {ws.isPending && <p className="text-sm text-[var(--dim)]">Loading workspace…</p>}
        {ws.error && (
          <p role="alert" className="text-sm" style={{ color: "var(--red)" }}>
            Couldn't load the workspace. Pull to refresh or reopen the page.
          </p>
        )}
        {ws.data && tab === "dashboard" && (
          <Dashboard data={ws.data} goTab={setTab} />
        )}
        {ws.data && tab === "projects" && <ProjectsView data={ws.data} />}
        {ws.data && tab === "inspections" && <InspectionsView data={ws.data} />}
        {ws.data && tab === "procurement" && <ProcurementView data={ws.data} />}
        {ws.data && tab === "finance" && <FinanceView data={ws.data} />}
        {ws.data && tab === "stakeholders" && (
          <StakeholdersView data={ws.data} />
        )}
        {tab === "brief" && <RoleBrief />}
      </main>
    </div>
  );
}

// ---------- Dashboard ----------

function Stat({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className="border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
      style={{ borderRadius: "var(--radius)" }}
    >
      <p className="text-[11px] font-semibold tracking-wide text-[var(--dim)] uppercase">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-xl font-semibold"
        style={alert ? { color: "var(--red)" } : undefined}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[var(--dim)]">{sub}</p>}
    </div>
  );
}

function Dashboard({
  data,
  goTab,
}: {
  data: Workspace;
  goTab: (t: Tab) => void;
}) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  const [taskTitle, setTaskTitle] = useState("");
  const [taskProject, setTaskProject] = useState<number | null>(null);
  const [taskOwner, setTaskOwner] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskError, setTaskError] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);

  const createTask = useMutation({
    mutationFn: async () =>
      await api.createTask({
        projectId: taskProject,
        title: taskTitle.trim(),
        owner: taskOwner.trim(),
        dueDate: taskDue,
        status: "open",
      }),
    onSuccess: () => {
      setTaskTitle("");
      setTaskOwner("");
      setTaskDue("");
      setTaskError(null);
      invalidate();
    },
    onError: (e) => setTaskError(e.message),
  });
  const setTaskStatus = useMutation({
    mutationFn: async (args: { id: number; status: Task["status"] }) =>
      await api.setTaskStatus(args),
    onSuccess: invalidate,
  });
  const deleteTask = useMutation({
    mutationFn: async (id: number) => await api.deleteTask({ id }),
    onSuccess: invalidate,
  });

  const today = todayStr();
  const active = data.projects.filter((p) => p.phase !== "complete");
  const totalBudget = data.projects.reduce((s, p) => s + p.budget, 0);
  const totalSpent = data.projects.reduce((s, p) => s + p.spent, 0);
  const pctSpent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const atRisk = data.projects.filter(
    (p) => p.status === "at_risk" || p.status === "delayed",
  );
  const pendingCOs = data.changeOrders.filter((c) => c.status === "pending");
  const pendingCOValue = pendingCOs.reduce((s, c) => s + c.costImpact, 0);
  const openFollowUps = data.inspections.filter(
    (i) => i.followUp.trim() !== "" && !i.followUpDone,
  );
  const overdueTasks = data.tasks.filter(
    (t) => t.status !== "done" && t.dueDate !== "" && t.dueDate < today,
  );
  const openTasks = data.tasks.filter((t) => t.status !== "done");

  const report = useMemo(() => {
    const lines: string[] = [];
    lines.push("PROJECT STATUS REPORT — Office of Transportation");
    lines.push(`Generated ${fmtDate(today)}`);
    lines.push("");
    lines.push(
      `Portfolio: ${data.projects.length} project(s), ${active.length} active. Budget ${money(totalBudget)}, spent ${money(totalSpent)} (${pctSpent}%).`,
    );
    if (atRisk.length > 0) {
      lines.push("");
      lines.push("AT RISK / DELAYED:");
      for (const p of atRisk) {
        lines.push(
          `- ${p.name}${p.code ? ` (${p.code})` : ""} — ${STATUS_LABELS[p.status]}, ${PHASE_LABELS[p.phase]} phase, ${p.percentComplete}% complete, target ${fmtDate(p.targetDate)}`,
        );
      }
    }
    if (pendingCOs.length > 0) {
      lines.push("");
      lines.push(
        `PENDING CHANGE ORDERS (${pendingCOs.length}, net ${money(pendingCOValue)}):`,
      );
      for (const c of pendingCOs) {
        lines.push(
          `- ${c.title}${c.projectName ? ` — ${c.projectName}` : ""}: ${money(c.costImpact)}, ${c.scheduleDays} day(s) schedule impact`,
        );
      }
    }
    if (openFollowUps.length > 0) {
      lines.push("");
      lines.push("OPEN INSPECTION FOLLOW-UPS:");
      for (const i of openFollowUps) {
        lines.push(
          `- ${i.projectName || "Unlinked"} (${fmtDate(i.date)}): ${i.followUp}`,
        );
      }
    }
    if (overdueTasks.length > 0) {
      lines.push("");
      lines.push("OVERDUE TASKS:");
      for (const t of overdueTasks) {
        lines.push(`- ${t.title} — due ${fmtDate(t.dueDate)}${t.owner ? `, owner ${t.owner}` : ""}`);
      }
    }
    if (
      atRisk.length === 0 &&
      pendingCOs.length === 0 &&
      openFollowUps.length === 0 &&
      overdueTasks.length === 0
    ) {
      lines.push("");
      lines.push("No at-risk projects, pending change orders, open follow-ups, or overdue tasks.");
    }
    return lines.join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const hasData = data.projects.length > 0;

  return (
    <div className="space-y-6">
      {!hasData && (
        <EmptyState>
          <p className="font-semibold text-[var(--text)]">No projects yet.</p>
          <p className="mt-1">
            This workspace starts empty — add your first project and its
            budget, inspections, change orders, and payments will roll up
            here automatically.
          </p>
          <div className="mt-3">
            <PrimaryButton onClick={() => goTab("projects")}>
              Add your first project
            </PrimaryButton>
          </div>
        </EmptyState>
      )}

      <section aria-label="Portfolio totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active projects" value={String(active.length)} sub={`${data.projects.length} total in portfolio`} />
        <Stat label="Portfolio budget" value={money(totalBudget)} sub={`${money(totalSpent)} spent`} />
        <Stat label="At risk / delayed" value={String(atRisk.length)} alert={atRisk.length > 0} sub="projects needing attention" />
        <Stat label="Pending change orders" value={String(pendingCOs.length)} sub={`net impact ${money(pendingCOValue)}`} />
      </section>

      {hasData && (
        <section
          aria-label="Budget versus spent"
          className="border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          style={{ borderRadius: "var(--radius)" }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Budget vs. spent</h2>
            <p className="font-mono text-sm">
              {money(totalSpent)} / {money(totalBudget)} · {pctSpent}%
            </p>
          </div>
          <div
            className="mt-2 h-3 w-full border border-[var(--border)]"
            role="progressbar"
            aria-valuenow={pctSpent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Percent of portfolio budget spent"
            style={{ borderRadius: 2 }}
          >
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, pctSpent)}%`,
                background: pctSpent > 90 ? "var(--red)" : "var(--accent)",
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PHASES.map((phase) => {
              const count = data.projects.filter((p) => p.phase === phase).length;
              return (
                <span
                  key={phase}
                  className="border border-[var(--border)] px-2 py-1 font-mono text-[11px]"
                  style={{ borderRadius: 2, opacity: count === 0 ? 0.45 : 1 }}
                >
                  {PHASE_LABELS[phase]} · {count}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {atRisk.length > 0 && (
        <section aria-label="Projects needing attention">
          <h2 className="mb-2 text-base font-bold">Needs attention</h2>
          <ul className="space-y-2">
            {atRisk.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                style={{ borderRadius: "var(--radius)", borderLeft: "4px solid var(--red)" }}
              >
                <span className="font-semibold">{p.name}</span>
                <Badge label={STATUS_LABELS[p.status]} color={statusColor(p.status)} />
                <span className="text-sm text-[var(--dim)]">
                  {PHASE_LABELS[p.phase]} · {p.percentComplete}% · target {fmtDate(p.targetDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Coordination tasks">
        <h2 className="mb-2 text-base font-bold">
          Coordination tasks{" "}
          <span className="font-mono text-sm font-normal text-[var(--dim)]">
            {openTasks.length} open · {overdueTasks.length} overdue
          </span>
        </h2>
        <form
          className="mb-3 grid gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:grid-cols-2"
          style={{ borderRadius: "var(--radius)" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!taskTitle.trim()) {
              setTaskError("Give the task a title first.");
              return;
            }
            createTask.mutate();
          }}
        >
          <Field label="Task">
            <input
                            className={inputCls}
              style={inputStyle}
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Confirm site access with depot ops"
            />
          </Field>
          <ProjectPicker projects={data.projects} value={taskProject} onChange={setTaskProject} />
          <Field label="Owner">
            <input
                            className={inputCls}
              style={inputStyle}
              value={taskOwner}
              onChange={(e) => setTaskOwner(e.target.value)}
              placeholder="Name or team"
            />
          </Field>
          <Field label="Due date">
            <input
                            type="date"
              className={inputCls}
              style={inputStyle}
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <FormError message={taskError} />
            <PrimaryButton submit disabled={createTask.isPending}>
              {createTask.isPending ? "Adding…" : "Add task"}
            </PrimaryButton>
          </div>
        </form>
        {data.tasks.length === 0 ? (
          <EmptyState>No tasks yet. Add the next coordination step above.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {data.tasks.map((t) => {
              const overdue =
                t.status !== "done" && t.dueDate !== "" && t.dueDate < today;
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  style={{
                    borderRadius: "var(--radius)",
                    borderLeft: overdue ? "4px solid var(--red)" : undefined,
                  }}
                >
                  <span
                    className="font-medium"
                    style={
                      t.status === "done"
                        ? { textDecoration: "line-through", color: "var(--dim)" }
                        : undefined
                    }
                  >
                    {t.title}
                  </span>
                  {t.projectName && (
                    <span className="text-xs text-[var(--dim)]">{t.projectName}</span>
                  )}
                  {t.owner && <span className="text-xs text-[var(--dim)]">· {t.owner}</span>}
                  {t.dueDate && (
                    <span
                      className="font-mono text-xs"
                      style={overdue ? { color: "var(--red)", fontWeight: 600 } : undefined}
                    >
                      due {fmtDate(t.dueDate)}
                      {overdue ? " (overdue)" : ""}
                    </span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1">
                    <select
                      aria-label={`Status for task ${t.title}`}
                      className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
                      style={{ borderRadius: "var(--radius)" }}
                      value={t.status}
                      onChange={(e) =>
                        setTaskStatus.mutate({
                          id: t.id,
                          status: e.target.value as Task["status"],
                        })
                      }
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                    <DeleteControl
                      label={`Delete task ${t.title}`}
                      pending={deleteTask.isPending}
                      onDelete={() => deleteTask.mutate(t.id)}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Status report">
        <h2 className="mb-2 text-base font-bold">Status report</h2>
        <p className="mb-2 text-sm text-[var(--dim)]">
          Generated from the records above — copy it into your County status
          update.
        </p>
        <pre
          className="overflow-x-auto border border-[var(--border)] bg-[var(--surface)] px-3 py-3 font-mono text-xs whitespace-pre-wrap"
          style={{ borderRadius: "var(--radius)" }}
        >
          {report}
        </pre>
        <div className="mt-2">
          <GhostButton
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report);
                setReportCopied(true);
              } catch {
                setReportCopied(false);
              }
            }}
          >
            {reportCopied ? "Copied ✓" : "Copy report"}
          </GhostButton>
        </div>
      </section>
    </div>
  );
}

// ---------- Projects ----------

type ProjectForm = {
  name: string;
  code: string;
  type: Project["type"];
  phase: Project["phase"];
  status: Project["status"];
  priority: Project["priority"];
  location: string;
  contractor: string;
  budget: string;
  spent: string;
  percentComplete: string;
  startDate: string;
  targetDate: string;
  description: string;
  notes: string;
};

const blankProjectForm: ProjectForm = {
  name: "",
  code: "",
  type: "zeb_charging",
  phase: "planning",
  status: "on_track",
  priority: "normal",
  location: "",
  contractor: "",
  budget: "",
  spent: "",
  percentComplete: "0",
  startDate: "",
  targetDate: "",
  description: "",
  notes: "",
};

function projectToForm(p: Project): ProjectForm {
  return {
    name: p.name,
    code: p.code,
    type: p.type,
    phase: p.phase,
    status: p.status,
    priority: p.priority,
    location: p.location,
    contractor: p.contractor,
    budget: p.budget ? String(p.budget) : "",
    spent: p.spent ? String(p.spent) : "",
    percentComplete: String(p.percentComplete),
    startDate: p.startDate,
    targetDate: p.targetDate,
    description: p.description,
    notes: p.notes,
  };
}

function ProjectsView({ data }: { data: Workspace }) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectForm>(blankProjectForm);
  const [error, setError] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const set = (k: keyof ProjectForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const payload = () => ({
    name: form.name.trim(),
    code: form.code.trim(),
    type: form.type,
    phase: form.phase,
    status: form.status,
    priority: form.priority,
    location: form.location.trim(),
    contractor: form.contractor.trim(),
    budget: Number(form.budget) || 0,
    spent: Number(form.spent) || 0,
    percentComplete: Math.max(
      0,
      Math.min(100, Math.round(Number(form.percentComplete) || 0)),
    ),
    startDate: form.startDate,
    targetDate: form.targetDate,
    description: form.description.trim(),
    notes: form.notes.trim(),
  });

  const save = useMutation({
    mutationFn: async () =>
      editing
        ? await api.updateProject({ id: editing.id, ...payload() })
        : await api.createProject(payload()),
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setForm(blankProjectForm);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => await api.deleteProject({ id }),
    onSuccess: invalidate,
  });

  const filtered = data.projects.filter(
    (p) =>
      (phaseFilter === "all" || p.phase === phaseFilter) &&
      (typeFilter === "all" || p.type === typeFilter),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">
          Projects{" "}
          <span className="font-mono text-sm font-normal text-[var(--dim)]">
            {filtered.length} of {data.projects.length}
          </span>
        </h2>
        <span className="ml-auto inline-flex flex-wrap gap-2">
          <select
            aria-label="Filter by phase"
            className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            style={{ borderRadius: "var(--radius)" }}
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
          >
            <option value="all">All phases</option>
            {PHASES.map((ph) => (
              <option key={ph} value={ph}>
                {PHASE_LABELS[ph]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by project type"
            className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            style={{ borderRadius: "var(--radius)" }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All types</option>
            {(Object.keys(TYPE_LABELS) as Project["type"][]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <PrimaryButton
            onClick={() => {
              setEditing(null);
              setForm(blankProjectForm);
              setError(null);
              setShowForm((s) => !s);
            }}
          >
            {showForm && !editing ? "Close form" : "+ New project"}
          </PrimaryButton>
        </span>
      </div>

      {showForm && (
        <form
          className="grid gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:grid-cols-2"
          style={{ borderRadius: "var(--radius)" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) {
              setError("Give the project a name first.");
              return;
            }
            save.mutate();
          }}
        >
          <Field label="Project name *">
            <input className={inputCls} style={inputStyle} value={form.name} onChange={set("name")} placeholder="e.g. Depot charging infrastructure — Phase 1" />
          </Field>
          <Field label="Project code">
            <input className={inputCls} style={inputStyle} value={form.code} onChange={set("code")} placeholder="e.g. ZEB-2026-01" />
          </Field>
          <Field label="Type">
            <select aria-label="Project type" className={inputCls} style={inputStyle} value={form.type} onChange={set("type")}>
              {(Object.keys(TYPE_LABELS) as Project["type"][]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="Lifecycle phase">
            <select aria-label="Lifecycle phase" className={inputCls} style={inputStyle} value={form.phase} onChange={set("phase")}>
              {PHASES.map((ph) => (
                <option key={ph} value={ph}>{PHASE_LABELS[ph]}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select aria-label="Project status" className={inputCls} style={inputStyle} value={form.status} onChange={set("status")}>
              {(Object.keys(STATUS_LABELS) as Project["status"][]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select aria-label="Priority" className={inputCls} style={inputStyle} value={form.priority} onChange={set("priority")}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </Field>
          <Field label="Site / location">
            <input className={inputCls} style={inputStyle} value={form.location} onChange={set("location")} placeholder="Facility or site name" />
          </Field>
          <Field label="Contractor">
            <input className={inputCls} style={inputStyle} value={form.contractor} onChange={set("contractor")} placeholder="Prime contractor" />
          </Field>
          <Field label="Budget (USD)">
            <input type="number" className={inputCls} style={inputStyle} value={form.budget} onChange={set("budget")} placeholder="0" />
          </Field>
          <Field label="Spent to date (USD)">
            <input type="number" className={inputCls} style={inputStyle} value={form.spent} onChange={set("spent")} placeholder="0" />
          </Field>
          <Field label="Percent complete">
            <input type="number" className={inputCls} style={inputStyle} value={form.percentComplete} onChange={set("percentComplete")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" className={inputCls} style={inputStyle} value={form.startDate} onChange={set("startDate")} />
            </Field>
            <Field label="Target completion">
              <input type="date" className={inputCls} style={inputStyle} value={form.targetDate} onChange={set("targetDate")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Scope / description">
              <textarea aria-label="Scope / description" maxLength={2000} className={inputCls} style={inputStyle} rows={3} value={form.description} onChange={set("description")} placeholder="Scope of work, deliverables, systems to integrate…" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Engineer's notes">
              <textarea aria-label="Engineer's notes" maxLength={2000} className={inputCls} style={inputStyle} rows={2} value={form.notes} onChange={set("notes")} placeholder="Risks, design issues, utility coordination, compliance notes…" />
            </Field>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <PrimaryButton submit disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Create project"}
            </PrimaryButton>
            <FormError message={error} />
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <EmptyState>
          {data.projects.length === 0
            ? "No projects yet. Use “+ New project” to add the first one — ZEB charging, microgrid, electrical, or facility work."
            : "No projects match these filters."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => {
            const pct = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
            const over = p.budget > 0 && p.spent > p.budget;
            const inspCount = data.inspections.filter((i) => i.projectId === p.id).length;
            const coCount = data.changeOrders.filter((c) => c.projectId === p.id && c.status === "pending").length;
            return (
              <li
                key={p.id}
                className="border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                style={{ borderRadius: "var(--radius)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold">{p.name}</h3>
                  {p.code && <span className="font-mono text-xs text-[var(--dim)]">{p.code}</span>}
                  <Badge label={STATUS_LABELS[p.status]} color={statusColor(p.status)} />
                  <Badge label={PHASE_LABELS[p.phase]} />
                  {p.priority === "high" || p.priority === "critical" ? (
                    <Badge label={`${p.priority} priority`} color="var(--red)" />
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[var(--dim)]">
                  {TYPE_LABELS[p.type]}
                  {p.location ? ` · ${p.location}` : ""}
                  {p.contractor ? ` · Contractor: ${p.contractor}` : ""}
                </p>
                {p.description && <p className="mt-2 text-sm">{p.description}</p>}
                <div className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-3">
                  <span>
                    Budget {money(p.budget)} · Spent{" "}
                    <span style={over ? { color: "var(--red)", fontWeight: 700 } : undefined}>
                      {money(p.spent)} ({pct}%)
                    </span>
                  </span>
                  <span>Complete {p.percentComplete}%</span>
                  <span>
                    {fmtDate(p.startDate)} → {fmtDate(p.targetDate)}
                  </span>
                </div>
                <div
                  className="mt-2 h-2 w-full border border-[var(--border)]"
                  role="progressbar"
                  aria-valuenow={p.percentComplete}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Percent complete for ${p.name}`}
                  style={{ borderRadius: 2 }}
                >
                  <div className="h-full" style={{ width: `${p.percentComplete}%`, background: "var(--accent)" }} />
                </div>
                {p.notes && (
                  <p className="mt-2 border-l-2 border-[var(--amber)] pl-2 text-sm text-[var(--dim)]">
                    {p.notes}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--dim)]">
                  <span>{inspCount} inspection(s)</span>
                  <span>· {coCount} pending change order(s)</span>
                  <span className="ml-auto inline-flex gap-1">
                    <GhostButton
                      ariaLabel={`Edit project ${p.name}`}
                      onClick={() => {
                        setEditing(p);
                        setForm(projectToForm(p));
                        setError(null);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </GhostButton>
                    <DeleteControl
                      label={`Delete project ${p.name}`}
                      pending={remove.isPending}
                      onDelete={() => remove.mutate(p.id)}
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Inspections ----------

function InspectionsView({ data }: { data: Workspace }) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  const [showForm, setShowForm] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [type, setType] = useState<Inspection["type"]>("site_visit");
  const [date, setDate] = useState(todayStr());
  const [inspector, setInspector] = useState("");
  const [result, setResult] = useState<Inspection["result"]>("pending");
  const [findings, setFindings] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      await api.createInspection({
        projectId,
        type,
        date,
        inspector: inspector.trim(),
        result,
        findings: findings.trim(),
        followUp: followUp.trim(),
      }),
    onSuccess: () => {
      setFindings("");
      setFollowUp("");
      setError(null);
      setShowForm(false);
      invalidate();
    },
    onError: (e) => setError(e.message),
  });
  const toggleFollowUp = useMutation({
    mutationFn: async (args: { id: number; done: boolean }) =>
      await api.setInspectionFollowUp(args),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => await api.deleteInspection({ id }),
    onSuccess: invalidate,
  });

  const openFollowUps = data.inspections.filter(
    (i) => i.followUp.trim() !== "" && !i.followUpDone,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">
          Site inspections &amp; field verification{" "}
          <span className="font-mono text-sm font-normal text-[var(--dim)]">
            {data.inspections.length} logged · {openFollowUps} open follow-up(s)
          </span>
        </h2>
        <span className="ml-auto">
          <PrimaryButton onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close form" : "+ Log inspection"}
          </PrimaryButton>
        </span>
      </div>

      {showForm && (
        <form
          className="grid gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:grid-cols-2"
          style={{ borderRadius: "var(--radius)" }}
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <ProjectPicker projects={data.projects} value={projectId} onChange={setProjectId} />
          <Field label="Inspection type">
            <select aria-label="Inspection type" className={inputCls} style={inputStyle} value={type} onChange={(e) => setType(e.target.value as Inspection["type"])}>
              {(Object.keys(INSP_TYPE_LABELS) as Inspection["type"][]).map((t) => (
                <option key={t} value={t}>{INSP_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className={inputCls} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Inspector">
            <input className={inputCls} style={inputStyle} value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="Your name or team" />
          </Field>
          <Field label="Result">
            <select aria-label="Inspection result" className={inputCls} style={inputStyle} value={result} onChange={(e) => setResult(e.target.value as Inspection["result"])}>
              {(Object.keys(RESULT_LABELS) as Inspection["result"][]).map((r) => (
                <option key={r} value={r}>{RESULT_LABELS[r]}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Findings — does the work match the drawings & specs?">
              <textarea className={inputCls} style={inputStyle} rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="What you verified, deviations found, measurements, photo references…" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Follow-up action">
              <input className={inputCls} style={inputStyle} value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="e.g. Contractor to re-submit conduit layout by Friday" />
            </Field>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <PrimaryButton submit disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Save inspection"}
            </PrimaryButton>
            <FormError message={error} />
          </div>
        </form>
      )}

      {data.inspections.length === 0 ? (
        <EmptyState>
          No inspections logged yet. Site visits, milestone inspections, and
          field condition assessments you record will appear here.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.inspections.map((i) => (
            <li
              key={i.id}
              className="border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              style={{ borderRadius: "var(--radius)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{i.projectName || "Unlinked inspection"}</span>
                <Badge label={INSP_TYPE_LABELS[i.type]} />
                <Badge label={RESULT_LABELS[i.result]} color={statusColor(i.result)} />
                <span className="ml-auto font-mono text-xs text-[var(--dim)]">
                  {fmtDate(i.date)}
                  {i.inspector ? ` · ${i.inspector}` : ""}
                </span>
              </div>
              {i.findings && <p className="mt-2 text-sm">{i.findings}</p>}
              {i.followUp && (
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`Mark follow-up done for inspection on ${fmtDate(i.date)}`}
                    className="mt-1 h-4 w-4"
                    checked={i.followUpDone}
                    onChange={(e) =>
                      toggleFollowUp.mutate({ id: i.id, done: e.target.checked })
                    }
                  />
                  <span style={i.followUpDone ? { textDecoration: "line-through", color: "var(--dim)" } : undefined}>
                    <strong>Follow-up:</strong> {i.followUp}
                  </span>
                </label>
              )}
              <div className="mt-2 text-right">
                <DeleteControl
                  label={`Delete inspection on ${fmtDate(i.date)}`}
                  pending={remove.isPending}
                  onDelete={() => remove.mutate(i.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Procurement ----------

function ProcurementView({ data }: { data: Workspace }) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [docType, setDocType] = useState<Procurement["docType"]>("SOW");
  const [stage, setStage] = useState<Procurement["stage"]>("draft");
  const [dueDate, setDueDate] = useState("");
  const [vendor, setVendor] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      await api.createProcurement({
        projectId,
        title: title.trim(),
        docType,
        stage,
        dueDate,
        vendor: vendor.trim(),
        value: Number(value) || 0,
      }),
    onSuccess: () => {
      setTitle("");
      setVendor("");
      setValue("");
      setDueDate("");
      setError(null);
      setShowForm(false);
      invalidate();
    },
    onError: (e) => setError(e.message),
  });
  const setStageMut = useMutation({
    mutationFn: async (args: { id: number; stage: Procurement["stage"] }) =>
      await api.setProcurementStage(args),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => await api.deleteProcurement({ id }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">
          Procurement — SOW · RFP · RFQ{" "}
          <span className="font-mono text-sm font-normal text-[var(--dim)]">
            {data.procurements.length} item(s)
          </span>
        </h2>
        <span className="ml-auto">
          <PrimaryButton onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close form" : "+ New procurement"}
          </PrimaryButton>
        </span>
      </div>

      {showForm && (
        <form
          className="grid gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:grid-cols-2"
          style={{ borderRadius: "var(--radius)" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) {
              setError("Give the procurement a title first.");
              return;
            }
            create.mutate();
          }}
        >
          <Field label="Title *">
            <input className={inputCls} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. RFP — DC fast charger supply & install" />
          </Field>
          <ProjectPicker projects={data.projects} value={projectId} onChange={setProjectId} />
          <Field label="Document type">
            <select aria-label="Document type" className={inputCls} style={inputStyle} value={docType} onChange={(e) => setDocType(e.target.value as Procurement["docType"])}>
              <option value="SOW">SOW — Scope of Work</option>
              <option value="RFP">RFP — Request for Proposals</option>
              <option value="RFQ">RFQ — Request for Qualifications</option>
            </select>
          </Field>
          <Field label="Stage">
            <select aria-label="Procurement stage" className={inputCls} style={inputStyle} value={stage} onChange={(e) => setStage(e.target.value as Procurement["stage"])}>
              {(Object.keys(STAGE_LABELS) as Procurement["stage"][]).map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" className={inputCls} style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Vendor / awardee">
            <input className={inputCls} style={inputStyle} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Selected vendor, if awarded" />
          </Field>
          <Field label="Estimated / awarded value (USD)">
            <input type="number" className={inputCls} style={inputStyle} value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2">
            <PrimaryButton submit disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create procurement"}
            </PrimaryButton>
            <FormError message={error} />
          </div>
        </form>
      )}

      {data.procurements.length === 0 ? (
        <EmptyState>
          No procurements yet. Track every SOW, RFP, and RFQ here — from
          drafting through bid evaluation to award.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.procurements.map((p) => (
            <li
              key={p.id}
              className="border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              style={{ borderRadius: "var(--radius)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.title}</span>
                <Badge label={p.docType} />
                <Badge label={STAGE_LABELS[p.stage]} color={statusColor(p.stage)} />
              </div>
              <p className="mt-1 font-mono text-xs text-[var(--dim)]">
                {p.projectName ? `${p.projectName} · ` : ""}
                due {fmtDate(p.dueDate)}
                {p.vendor ? ` · ${p.vendor}` : ""}
                {p.value > 0 ? ` · ${money(p.value)}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Stage for ${p.title}`}
                  className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                  style={{ borderRadius: "var(--radius)" }}
                  value={p.stage}
                  onChange={(e) =>
                    setStageMut.mutate({
                      id: p.id,
                      stage: e.target.value as Procurement["stage"],
                    })
                  }
                >
                  {(Object.keys(STAGE_LABELS) as Procurement["stage"][]).map((s) => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
                <span className="ml-auto">
                  <DeleteControl
                    label={`Delete procurement ${p.title}`}
                    pending={remove.isPending}
                    onDelete={() => remove.mutate(p.id)}
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Finance (change orders + payments) ----------

function FinanceView({ data }: { data: Workspace }) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace"] });

  // change order form
  const [showCO, setShowCO] = useState(false);
  const [coTitle, setCoTitle] = useState("");
  const [coProject, setCoProject] = useState<number | null>(null);
  const [coDesc, setCoDesc] = useState("");
  const [coCost, setCoCost] = useState("");
  const [coDays, setCoDays] = useState("0");
  const [coBy, setCoBy] = useState("");
  const [coDate, setCoDate] = useState(todayStr());
  const [coError, setCoError] = useState<string | null>(null);

  const createCO = useMutation({
    mutationFn: async () =>
      await api.createChangeOrder({
        projectId: coProject,
        title: coTitle.trim(),
        description: coDesc.trim(),
        costImpact: Number(coCost) || 0,
        scheduleDays: Math.round(Number(coDays) || 0),
        status: "pending",
        requestedBy: coBy.trim(),
        date: coDate,
      }),
    onSuccess: () => {
      setCoTitle("");
      setCoDesc("");
      setCoCost("");
      setCoDays("0");
      setCoBy("");
      setCoError(null);
      setShowCO(false);
      invalidate();
    },
    onError: (e) => setCoError(e.message),
  });
  const setCOStatus = useMutation({
    mutationFn: async (args: { id: number; status: ChangeOrder["status"] }) =>
      await api.setChangeOrderStatus(args),
    onSuccess: invalidate,
  });
  const removeCO = useMutation({
    mutationFn: async (id: number) => await api.deleteChangeOrder({ id }),
    onSuccess: invalidate,
  });

  // payment form
  const [showPay, setShowPay] = useState(false);
  const [payProject, setPayProject] = useState<number | null>(null);
  const [payPayee, setPayPayee] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payPeriod, setPayPeriod] = useState("");
  const [payDate, setPayDate] = useState(todayStr());
  const [payError, setPayError] = useState<string | null>(null);

  const createPay = useMutation({
    mutationFn: async () =>
      await api.createPayment({
        projectId: payProject,
        payee: payPayee.trim(),
        amount: Number(payAmount) || 0,
        period: payPeriod.trim(),
        status: "submitted",
        date: payDate,
      }),
    onSuccess: () => {
      setPayPayee("");
      setPayAmount("");
      setPayPeriod("");
      setPayError(null);
      setShowPay(false);
      invalidate();
    },
    onError: (e) => setPayError(e.message),
  });
  const setPayStatus = useMutation({
    mutationFn: async (args: { id: number; status: Payment["status"] }) =>
      await api.setPaymentStatus(args),
    onSuccess: invalidate,
  });
  const removePay = useMutation({
    mutationFn: async (id: number) => await api.deletePayment({ id }),
    onSuccess: invalidate,
  });

  const approvedCOValue = data.changeOrders
    .filter((c) => c.status === "approved")
    .reduce((s, c) => s + c.costImpact, 0);
  const paidTotal = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const awaitingTotal = data.payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-8">
      <section aria-label="Change orders">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold">
            Change orders{" "}
            <span className="font-mono text-sm font-normal text-[var(--dim)]">
              approved net {money(approvedCOValue)}
            </span>
          </h2>
          <span className="ml-auto">
            <PrimaryButton onClick={() => setShowCO((s) => !s)}>
              {showCO ? "Close form" : "+ New change order"}
            </PrimaryButton>
          </span>
        </div>

        {showCO && (
          <form
            className="mt-3 grid gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:grid-cols-2"
            style={{ borderRadius: "var(--radius)" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!coTitle.trim()) {
                setCoError("Give the change order a title first.");
                return;
              }
              createCO.mutate();
            }}
          >
            <Field label="Title *">
              <input className={inputCls} style={inputStyle} value={coTitle} onChange={(e) => setCoTitle(e.target.value)} placeholder="e.g. Add two depot chargers — utility upgrade" />
            </Field>
            <ProjectPicker projects={data.projects} value={coProject} onChange={setCoProject} />
            <Field label="Cost impact (USD, negative = credit)">
              <input type="number" className={inputCls} style={inputStyle} value={coCost} onChange={(e) => setCoCost(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Schedule impact (days, + = later)">
              <input type="number" className={inputCls} style={inputStyle} value={coDays} onChange={(e) => setCoDays(e.target.value)} />
            </Field>
            <Field label="Requested by">
              <input className={inputCls} style={inputStyle} value={coBy} onChange={(e) => setCoBy(e.target.value)} placeholder="Contractor or County staff" />
            </Field>
            <Field label="Date">
              <input type="date" className={inputCls} style={inputStyle} value={coDate} onChange={(e) => setCoDate(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description / justification">
                <textarea className={inputCls} style={inputStyle} rows={2} value={coDesc} onChange={(e) => setCoDesc(e.target.value)} placeholder="Scope change, reason, contract reference…" />
              </Field>
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <PrimaryButton submit disabled={createCO.isPending}>
                {createCO.isPending ? "Saving…" : "Create change order"}
              </PrimaryButton>
              <FormError message={coError} />
            </div>
          </form>
        )}

        {data.changeOrders.length === 0 ? (
          <div className="mt-3">
            <EmptyState>No change orders yet. Scope, schedule, and cost adjustments will be tracked here.</EmptyState>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.changeOrders.map((c) => (
              <li
                key={c.id}
                className="border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                style={{ borderRadius: "var(--radius)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.title}</span>
                  <Badge label={c.status} color={statusColor(c.status)} />
                  <span className="ml-auto font-mono text-sm">
                    {c.costImpact >= 0 ? "+" : ""}
                    {money(c.costImpact)} · {c.scheduleDays >= 0 ? "+" : ""}
                    {c.scheduleDays}d
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--dim)]">
                  {c.projectName ? `${c.projectName} · ` : ""}
                  {fmtDate(c.date)}
                  {c.requestedBy ? ` · requested by ${c.requestedBy}` : ""}
                </p>
                {c.description && <p className="mt-1 text-sm">{c.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {c.status === "pending" && (
                    <>
                      <GhostButton ariaLabel={`Approve change order ${c.title}`} onClick={() => setCOStatus.mutate({ id: c.id, status: "approved" })}>
                        Approve
                      </GhostButton>
                      <GhostButton ariaLabel={`Reject change order ${c.title}`} onClick={() => setCOStatus.mutate({ id: c.id, status: "rejected" })}>
                        Reject
                      </GhostButton>
                    </>
                  )}
                  {c.status !== "pending" && (
                    <GhostButton ariaLabel={`Reopen change order ${c.title}`} onClick={() => setCOStatus.mutate({ id: c.id, status: "pending" })}>
                      Reopen
                    </GhostButton>
                  )}
                  <span className="ml-auto">
                    <DeleteControl label={`Delete change order ${c.title}`} pending={removeCO.isPending} onDelete={() => removeCO.mutate(c.id)} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Progress payments">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold">
            Progress payments{" "}
            <span className="font-mono text-sm font-normal text-[var(--dim)]">
              {money(paidTotal)} paid · {money(awaitingTotal)} in process
            </span>
          </h2>
          <span className="ml-auto">
            <PrimaryButton onClick={() => setShowPay((s) => !s)}>
              {showPay ? "Close form" : "+ New payment"}
            </PrimaryButton>
          </span>
        </div>

        {showPay && (
          <form
            className="mt-3 grid gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:grid-cols-2"
            style={{ borderRadius: "var(--radius)" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!payPayee.trim() && !payProject) {
                setPayError("Add a payee or link a project first.");
                return;
              }
              createPay.mutate();
            }}
          >
            <ProjectPicker projects={data.projects} value={payProject} onChange={setPayProject} />
            <Field label="Payee">
              <input className={inputCls} style={inputStyle} value={payPayee} onChange={(e) => setPayPayee(e.target.value)} placeholder="Contractor or vendor" />
            </Field>
            <Field label="Amount (USD)">
              <input type="number" className={inputCls} style={inputStyle} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Period / pay application">
              <input className={inputCls} style={inputStyle} value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} placeholder="e.g. Pay App #3 — October" />
            </Field>
            <Field label="Date">
              <input type="date" className={inputCls} style={inputStyle} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <PrimaryButton submit disabled={createPay.isPending}>
                {createPay.isPending ? "Saving…" : "Record payment"}
              </PrimaryButton>
              <FormError message={payError} />
            </div>
          </form>
        )}

        {data.payments.length === 0 ? (
          <div className="mt-3">
            <EmptyState>No progress payments recorded yet.</EmptyState>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                style={{ borderRadius: "var(--radius)" }}
              >
                <span className="font-semibold">{p.payee || p.projectName || "Payment"}</span>
                <Badge label={p.status} color={statusColor(p.status)} />
                <span className="font-mono text-sm">{money(p.amount)}</span>
                <span className="text-xs text-[var(--dim)]">
                  {p.projectName && p.payee ? `${p.projectName} · ` : ""}
                  {p.period ? `${p.period} · ` : ""}
                  {fmtDate(p.date)}
                </span>
                <span className="ml-auto inline-flex items-center gap-1">
                  <select
                    aria-label={`Payment status for ${p.payee || p.period || "payment"}`}
                    className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                    style={{ borderRadius: "var(--radius)" }}
                    value={p.status}
                    onChange={(e) =>
                      setPayStatus.mutate({ id: p.id, status: e.target.value as Payment["status"] })
                    }
                  >
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                  </select>
                  <DeleteControl label={`Delete payment ${p.payee || p.period}`} pending={removePay.isPending} onDelete={() => removePay.mutate(p.id)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- Stakeholders ----------

function StakeholdersView({ data }: { data: Workspace }) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Stakeholder | null>(null);
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [role, setRole] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [contact, setContact] = useState("");
  const [lastContact, setLastContact] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setOrg("");
    setRole("");
    setProjectId(null);
    setContact("");
    setLastContact("");
    setNotes("");
    setEditing(null);
    setError(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        org: org.trim(),
        role: role.trim(),
        projectId,
        contact: contact.trim(),
        lastContact,
        notes: notes.trim(),
      };
      return editing
        ? await api.updateStakeholder({ id: editing.id, ...body })
        : await api.createStakeholder(body);
    },
    onSuccess: () => {
      reset();
      setShowForm(false);
      invalidate();
    },
    onError: (e) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => await api.deleteStakeholder({ id }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">
          Stakeholders &amp; engagement log{" "}
          <span className="font-mono text-sm font-normal text-[var(--dim)]">
            {data.stakeholders.length} contact(s)
          </span>
        </h2>
        <span className="ml-auto">
          <PrimaryButton
            onClick={() => {
              reset();
              setShowForm((s) => !s);
            }}
          >
            {showForm && !editing ? "Close form" : "+ Add stakeholder"}
          </PrimaryButton>
        </span>
      </div>

      {showForm && (
        <form
          className="grid gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:grid-cols-2"
          style={{ borderRadius: "var(--radius)" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              setError("Add the stakeholder's name first.");
              return;
            }
            save.mutate();
          }}
        >
          <Field label="Name *">
            <input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Organization">
            <input className={inputCls} style={inputStyle} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="County, utility, contractor, agency…" />
          </Field>
          <Field label="Role">
            <input className={inputCls} style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Utility interconnection lead" />
          </Field>
          <ProjectPicker projects={data.projects} value={projectId} onChange={setProjectId} />
          <Field label="Contact (email / phone)">
            <input className={inputCls} style={inputStyle} value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label="Last contact">
            <input type="date" className={inputCls} style={inputStyle} value={lastContact} onChange={(e) => setLastContact(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea className={inputCls} style={inputStyle} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What they own, open commitments, alignment notes…" />
            </Field>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <PrimaryButton submit disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Add stakeholder"}
            </PrimaryButton>
            <FormError message={error} />
          </div>
        </form>
      )}

      {data.stakeholders.length === 0 ? (
        <EmptyState>
          No stakeholders logged yet. Add County staff, contractors, utility
          partners, agencies, and community contacts as you engage them.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.stakeholders.map((s) => (
            <li
              key={s.id}
              className="border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              style={{ borderRadius: "var(--radius)" }}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{s.name}</span>
                {s.role && <span className="text-sm text-[var(--dim)]">{s.role}</span>}
                {s.org && <Badge label={s.org} />}
              </div>
              <p className="mt-1 font-mono text-xs text-[var(--dim)]">
                {s.projectName ? `${s.projectName} · ` : ""}
                {s.contact ? `${s.contact} · ` : ""}
                last contact {fmtDate(s.lastContact)}
              </p>
              {s.notes && <p className="mt-1 text-sm">{s.notes}</p>}
              <div className="mt-2 flex gap-1">
                <GhostButton
                  ariaLabel={`Edit stakeholder ${s.name}`}
                  onClick={() => {
                    setEditing(s);
                    setName(s.name);
                    setOrg(s.org);
                    setRole(s.role);
                    setProjectId(s.projectId);
                    setContact(s.contact);
                    setLastContact(s.lastContact);
                    setNotes(s.notes);
                    setError(null);
                    setShowForm(true);
                  }}
                >
                  Edit
                </GhostButton>
                <DeleteControl label={`Delete stakeholder ${s.name}`} pending={remove.isPending} onDelete={() => remove.mutate(s.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Role brief ----------

const CLUSTERS: { title: string; points: string[]; tab: Tab; tabLabel: string }[] = [
  {
    title: "Project Management & Coordination",
    points: ["Coordinate all project phases — planning, scheduling, resource allocation, site access", "Manage project timelines, priorities, and safety protocols"],
    tab: "dashboard",
    tabLabel: "Dashboard tasks",
  },
  {
    title: "Stakeholder Engagement",
    points: ["Liaison between County staff, contractors, agencies, and community stakeholders", "Facilitate communication and alignment across all participants"],
    tab: "stakeholders",
    tabLabel: "Stakeholders",
  },
  {
    title: "Operational Oversight",
    points: ["Establish and monitor work plans and performance metrics", "Ensure quality control and support team coordination"],
    tab: "dashboard",
    tabLabel: "Dashboard metrics",
  },
  {
    title: "Site Inspection & Verification",
    points: ["Conduct site visits, inspections, and field evaluations", "Verify construction aligns with engineering design and specifications", "Participate in milestone inspections and field condition assessments"],
    tab: "inspections",
    tabLabel: "Inspections",
  },
  {
    title: "Project Planning & Development",
    points: ["Define project scope, develop budgets, and create schedules", "Prepare Scopes of Work (SOW), RFPs, and RFQs", "Manage contractor procurement and selection; oversee design documentation, bids, and proposal evaluations"],
    tab: "procurement",
    tabLabel: "Procurement",
  },
  {
    title: "Project Execution & Oversight",
    points: ["Manage contractor performance and construction activities", "Ensure compliance with local, state, and federal regulations", "Coordinate engineering, safety, environmental, and quality teams; align with utilities and external partners"],
    tab: "projects",
    tabLabel: "Projects",
  },
  {
    title: "Contract & Financial Management",
    points: ["Monitor budgets, cost controls, and change orders", "Evaluate financial impacts and approve progress payments", "Support negotiations on scope, schedule, and cost; ensure contract compliance"],
    tab: "finance",
    tabLabel: "Finance",
  },
  {
    title: "Reporting & Closeout",
    points: ["Prepare project status reports and updates", "Lead project closeout — inspections, documentation, final deliverables", "Support warranty follow-up and post-construction activities"],
    tab: "dashboard",
    tabLabel: "Status report",
  },
];

function RoleBrief() {
  return (
    <div className="space-y-6">
      <section
        className="border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
        style={{ borderRadius: "var(--radius)" }}
      >
        <h2 className="text-base font-bold">The role, as posted</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold text-[var(--dim)]">Employer</dt><dd>Gallant Business Solutions, supporting Prince George's County DPW&amp;T — Office of Transportation</dd></div>
          <div><dt className="font-semibold text-[var(--dim)]">Compensation</dt><dd className="font-mono">$114,000 / year</dd></div>
          <div><dt className="font-semibold text-[var(--dim)]">Location &amp; schedule</dt><dd>Onsite in Largo, MD · Full-time, Monday–Friday · Limited telework 1 day/week (not Wednesdays)</dd></div>
          <div><dt className="font-semibold text-[var(--dim)]">Term</dt><dd>Long-term contract, 1 year, with potential for permanent placement</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold text-[var(--dim)]">Primary focus</dt><dd>The County's Zero-Emission Bus (ZEB) program — charging infrastructure and microgrid development — across the full lifecycle: design, procurement, construction, system integration, testing, and closeout.</dd></div>
        </dl>
      </section>

      <section aria-label="Responsibility clusters">
        <h2 className="mb-2 text-base font-bold">Responsibilities → where they live in this workspace</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {CLUSTERS.map((c) => (
            <article
              key={c.title}
              className="border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              style={{ borderRadius: "var(--radius)" }}
            >
              <h3 className="font-semibold">{c.title}</h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-[var(--dim)]">
                {c.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
              <p className="mt-2 font-mono text-xs" style={{ color: "var(--accent)" }}>
                → {c.tabLabel}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
        style={{ borderRadius: "var(--radius)" }}
      >
        <h2 className="text-base font-bold">Qualifications</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Bachelor's degree in Engineering — Civil, Electrical, Mechanical, or related field (required)</li>
          <li>5–8+ years of experience in engineering, construction, or infrastructure project management</li>
          <li>Experience with public works, transportation, or infrastructure projects (preferred)</li>
          <li>Knowledge of construction processes, procurement, and contract management</li>
          <li>Strong communication and stakeholder management skills</li>
          <li>Ability to manage multiple complex projects simultaneously</li>
        </ul>
        <h2 className="mt-4 text-base font-bold">You'll thrive here if…</h2>
        <p className="mt-1 text-sm text-[var(--dim)]">
          You enjoy seeing projects move from drawings to completed
          construction, review technical plans — including electrical
          drawings — with a critical eye, and stay detail-oriented without
          losing sight of the bigger picture. When something doesn't look
          right, you investigate it, ask questions, and work toward a
          solution.
        </p>
      </section>
    </div>
  );
}
