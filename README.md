# ZEB Project Engineer Workspace

A working prototype for a Project Engineer supporting infrastructure and
transportation projects for Gallant Business Solutions, for Prince George's
County Department of Public Works and Transportation (DPW&T), Office of
Transportation, Largo, MD.

Primary focus: the County's Zero-Emission Bus (ZEB) program — charging
infrastructure and microgrid development — across the full lifecycle:
design, procurement, construction, system integration, testing, and
closeout.

## What it does

- **Dashboard** — active projects, portfolio budget vs. spent, at-risk /
  delayed projects, pending change orders, coordination tasks with overdue
  highlighting, and a copy-ready project status report.
- **Projects** — ZEB charging, microgrid, electrical, facility, and transit
  projects through the 6-phase lifecycle (Planning, Design, Procurement,
  Construction, Integration, Testing, Closeout, Complete), with budget,
  spent, percent complete, status, priority, contractor, and dates.
- **Inspections** — site visits, milestone, field condition, safety, and
  quality inspections, with findings, results, and follow-up actions.
- **Procurement** — SOW, RFP, and RFQ items from draft through evaluation
  to award and close.
- **Finance** — change orders with cost and schedule impact
  (approve / reject / reopen) and progress payments
  (submitted / approved / paid).
- **Stakeholders** — engagement log for County staff, contractors, utility
  partners, agencies, and community contacts.
- **Role brief** — the role as posted (Gallant Business Solutions,
  $114,000/year, onsite Largo MD, 1-year contract) and all 8 responsibility
  clusters mapped to the workspace section that handles them.

## Data

There is no server and no seeded data. The workspace starts completely
empty. Everything you enter is saved in your browser's localStorage
(`zeb-project-engineer-workspace-v1`) and persists across visits in the
same browser. It is not shared with other people or devices — each person
using the deployed link keeps their own copy in their own browser.

## Run locally

```bash
npm install
npm run dev
```

Then open the address shown in the terminal (usually
http://localhost:5173).

## Build

```bash
npm install
npm run build
```

This produces a static `dist/` folder.

## Deploy on Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, import the repository. Vercel detects the Vite framework
   automatically; `vercel.json` in this repo also sets the build command
   (`npm run build`) and output directory (`dist`).
3. Deploy. No environment variables are needed.

The deployed site is a static site with no server, so it serves the same
way on any static host.
