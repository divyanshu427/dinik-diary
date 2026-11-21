# Dinik Diary — Build Plan

Step-by-step plan for building the app described in [plan.md](plan.md).

- Each build phase is small enough to finish in one or two sittings.
- Each phase has: **Goal**, **Tasks**, **Tests**, **Done when** (what I can see/do at the end).
- Don't start the next phase until the current one's tests pass and "Done when" is true.
- To start a phase, say: **"Start Build Phase N"** (or "next phase").

> Build phases (software) are different from **habit phases** (Phase 1 Foundation, Phase 2 Fitness…).

> **Updated 2026-11-20:** added the screen layout system and **Build Phase 5.5** (wider two-column layout and a richer Habits screen), based on the Today, Habits, Phases and Day log reference mock-ups. Later phases now describe their screens using those references. The references are a guide, not a pixel-exact spec.

---

## Overview

| Stage | # | Build phase | Main result | Status |
|---|---|---|---|---|
| **1. Frontend only** (no accounts) | 0 | Project setup | Empty app runs, lint + tests work | ✅ Done |
| | 1 | Brand and theme | Dinik Diary look (green theme), light/dark, `/brand` page | ✅ Done |
| | 2 | App shell and navigation | All screens reachable on laptop and phone | ✅ Done |
| | 3 | Data layer | Browser database, seed data, export/import | ✅ Done |
| | 4 | Core logic | Day boundary, scoring, streaks (tested) | ✅ Done |
| | 5 | Habits and phases editor | Add/edit/move/delete any habit or phase; collapsible phases; drag and drop | ✅ Done |
| | 5.5 | Layout and Habits refresh | Dashboard layout; Habits tiles, filters, 14-day history, detail panel; part of day | ✅ Done |
| | 6 | Today screen | Tick my day: summary tiles, checklist by part of day, notes, rest days | ✅ Done |
| | 7 | Categories and activities | Activities dashboard, log/edit/copy entries, category manager, "What you did today" | ✅ Done |
| | **8** | **Metrics and timeline** | Steps, sleep, water…; day timeline; "fill the gap" | ✅ Done |
| | 9 | Report engine | All report numbers + per-habit insights + demo data | ✅ Done |
| | 10 | Reports screen | Week / Month / All-time report like the mock-up | ✅ Done |
| | 11 | Phase manager | Phases screen like the mock-up: readiness, enable/repeat/pause | ✅ Done |
| | 12 | Health | Health issues (pain, symptoms, concerns), daily check-in, plan for the next few days | ✅ Done |
| | 12.5 | Health reports | Upload reports, key values and trends | ✅ Done |
| | 13 | PWA and backups | Installable on phone, offline, backup reminder | ✅ Done (phone install after Deploy) |
| | ★ | **Milestone: use it for 14 days** | Fix what annoys me before Stage 2 | |
| **2. Backend, bot, AI** (accounts needed) | 14 | Deploy | GitHub + Vercel, app online | |
| | 14.5 | AI health advisor | Describe what's wrong in my words; AI suggests the plan (moved up from the coach) | |
| | 15 | Supabase and sync | Same data on laptop and phone | |
| | 16 | Telegram bot basics | Messages saved, `/today`, quick-tick buttons | |
| | 17 | Reminders and scheduler | 9:30 PM reminder, nudge, per-habit reminders | |
| | 18 | AI parsing + Day log screen | Message → habits + activities; web chat like the mock-up | |
| | 19 | Review and corrections | "What it understood" panel: approve/fix unsure items | |
| | 20 | Voice input | Speak my day (Telegram + mic button) | |
| | 21 | AI coach | "Focus for next week" card | |
| | 22 | Extras | PDF export, share link, photos, integrations | |

---

## Screen layout system (applies to every screen)

From the reference mock-ups: screens use the whole width with a main column and a side column, instead of one narrow column with empty space on both sides.

**Page frame**
- Sidebar (240 px) on the left from tablet width up; bottom tab bar on phones.
- Content uses the available width up to about **1600 px**, with 24–32 px side padding. No large empty margins at 1280–1920 px.
- **Page header:** small "eyebrow" line above the title (a date or a summary, e.g. "Wednesday, 18 November" or "10 active habits, 30 more waiting in later phases"), the title, and chips/actions on the right (e.g. "Phase 1 · Foundation", "Add habit").

**Dashboard grid (laptop)**
- Every screen is a dashboard: cards side by side in rows on a 12-column grid. A card spans 3, 4, 5, 6, 7, 8 or 12 columns depending on its content (a number tile is narrow, a checklist or chart is wide).
- Most screens open with a **row of 4 summary tiles** (like the brand page: "74%", "11 days", …).
- One card style everywhere: white, rounded, title + small subtitle + optional action in the top-right corner.
- Tablet: 2 cards per row. Phone: 1 per row, most important first; summary tiles 2 × 2.

```
TODAY     [ Done 5/8 ][ Streak ][ Phase: day 9 of 14 ][ Left before bed ]
          [ Checklist (8) ......................... ][ What you did today (4) ]
          [ Steps · Water · Sleep ][ This week ][ Today's timeline ........ ]
HABITS    [ Active ][ 14-day avg ][ Best streak ][ Weakest ]
          [ filter chips (12) ]
          [ Phase table: 14-day dots · streak · % (8) ][ Habit detail (4) ]
PHASES    [ Active phase card (8) .................... ][ 14-day chart (4)     ]
          [ Phase 2 ][ Phase 3 ][ Phase 4 ]              [ How a phase unlocks  ]
REPORTS   [ 4 stat tiles ] → [ donut (7) ][ heatmap (5) ] → [ drill-down ][ insights ][ ranking ]
DAY LOG   [ Chat (7) ................................ ][ What it understood (5) ]
SETTINGS  [ Appearance (7) ][ Back up and restore (5) ] → [ Your data (8) ][ More settings (4) ]
```
Reports follow the `/brand` preview page.

**Layouts**
| Pattern | Used by | Wide screens (≥ 1280 px) | Phone |
|---|---|---|---|
| Main + side panel | Today, Habits, Phases, Day log, Settings | main column + 340–380 px side column | side column stacks below, or opens as a sheet |
| Card grid | Locked phase cards, stat tiles, report cards | 2–3 columns (stat tiles 4) | 1 column |
| Full width | Reports | 2-column card grid | 1 column |

**Reference screens (what each will look like)**
- **Today:** summary card (progress ring "5/8", habits done, current streak, how many are left, next-phase progress bar) → checklist on the left, "What you did today" on the right.
- **Habits:** filter chips → active phase as a table (last 14 days, streak, 14-day %) → locked phases collapsed below; habit detail panel on the right.
- **Phases:** active phase card with progress to unlock, locked phase cards in a grid with "Enable early"; side column with a 14-day completion chart, the unlock rules, and history.
- **Day log (Stage 2):** chat on the left (same conversation as the Telegram bot); "What it understood" on the right.

**Navigation (updated)**
- Laptop sidebar, main group: **Today, Habits, Activities, Reports, Phases** (+ **Day log** in Stage 2). Second group: Concerns, Settings, Brand preview.
- Phone tab bar: **Today, Habits, Reports, Phases, More** (More: Activities, Concerns, Settings, Brand preview; Day log joins the tab bar in Stage 2).

---

## Folder structure

```
src/
  app/(app)/                Next.js routes inside the app shell
    page.tsx                Today
    habits/ activities/ reports/ phases/ concerns/ settings/ brand/ more/
  brand/                    brand.config.ts, fonts
  theme/                    tokens, presets (sage, mono), theme switching
  copy/en.ts                all user-facing text
  lib/core/                 pure logic: day, scoring, targets, schedule, streaks, day-summary,
                            habit-stats (5.5), reports, readiness, insights (later)
  data/                     schema (Zod), repositories, local (Dexie), seed, backup, habit-ops
  hooks/                    TanStack Query hooks
  stores/                   Zustand UI store
  components/               shared components (ui/ = shadcn, app-shell/, charts/)
  features/                 screen pieces: habits/ settings/ brand/ reports/ today/ …
tests/e2e/                  Playwright tests
```

---

# Stage 1 — Frontend only

## Build Phase 0 — Project setup ✅
Next.js 16 + TypeScript, Tailwind 4, shadcn/ui, ESLint + Prettier, Vitest, Playwright, README.
**Done when:** `npm run dev` works; lint, tests and e2e pass. *(Met.)*

## Build Phase 1 — Brand and theme ✅
`brand.config.ts`, Space Grotesk + Inter, token-driven Sage and Mono presets (light + dark, colour-blind-checked chart palette), flash-free theme switching, `copy/en.ts`, lint rule against hardcoded colours, `/brand` preview page.
**Done when:** renaming the app and switching theme/mode changes everything. *(Met.)*

## Build Phase 2 — App shell and navigation ✅
Sidebar (laptop) and bottom tabs (phone), More screen, page header, segmented control, empty states, Settings v1, Zustand UI store.
**Done when:** every screen is reachable on laptop and phone. *(Met. The navigation order and wider layout are updated in 5.5.)*

## Build Phase 3 — Data layer ✅
Zod schemas, repository interfaces, Dexie store, TanStack Query hooks, starter data (5 phases, 40 habits, 15 categories, settings), theme saved in settings, backup download/restore/reset with validation.
**Done when:** export → reset → import brings everything back. *(Met.)*

## Build Phase 4 — Core logic ✅
4 AM day boundary, scoring (done + partial progress), target history, schedules, streaks (rest days skipped, weekly streaks for "N times a week"), day summary.
**Done when:** all the build-plan cases pass in `npm test`. *(Met.)*

## Build Phase 5 — Habits and phases editor ✅
Add/edit/archive/restore/delete habits; target changes keep history; measurement locked once check-ins exist; add/rename/reorder/delete phases; **collapsible phases** (remembered per device); **drag and drop** with mouse, touch and keyboard, between phases only into unlocked ones.
**Done when:** any habit can be added, removed or moved between phases. *(Met.)*

---

## Build Phase 5.5 — Layout and Habits refresh ✅
**Goal:** screens use the full width with a main and side column, and the Habits screen becomes a list + detail view like the reference.

Tasks: layout (all screens)
- Content width up to ~1600 px with 24–32 px padding (remove the narrow centred column)
- `PageLayout` component: main + side column on wide screens, stacked on phones
- Page header: eyebrow line, title, right-side chips/actions
- Navigation order as in "Navigation (updated)" above (Habits moves into the main group and phone tabs; Activities moves to More on phones)
- Settings in two columns (Appearance + Backup | Your data)

Tasks: habit data
- New habit field **part of day**: Any time / Morning / Afternoon / Evening / Night (in the form; starter habits get sensible values, e.g. Brush teeth — night → Night)
- Database upgrade (version 2) that adds it to existing habits; old backup files still import (missing field = Any time)
- `habit-stats.ts` (pure logic): per-day state for the last N days (done / partial / missed / not due / rest), current + best streak, % over the period

Tasks: Habits screen
- Eyebrow summary: "10 active habits, 30 more waiting in later phases"
- Filter chips: All, part of day (Morning, Evening, Night…), and categories that have habits
- Unlocked phases shown as a table: habit (name + category · part of day), **last 14 days** dots, **streak**, **14-day %**; weakest habit highlighted; keeps drag handles, ⋯ menu, collapsing
- Locked phases stay collapsed rows ("Locked · 7 habits")
- Click a habit → **detail panel** on the right (on phones: opens as a full-screen sheet):
  - name, phase and category chips, Edit button
  - target, schedule, part of day
  - current streak, best streak, last-14-days %
  - **last 30 days** heatmap (dark = done, light = partial)
  - target history ("5,000 until 19 Nov · 8,000 from 20 Nov")
- With no check-ins yet, the history shows empty dots and "No check-ins yet". Phase 6 fills it with real data.

Later phases, not 5.5 (listed so nothing is lost)
- Quick entry on the habit panel (+500, +1,000, Enter total) → Phase 6
- Per-habit insight text ("You hit this most on weekends…") → Phase 9
- "Active · day 9 of 14 · 76%" on the phase header, and "becomes 8,000 in Phase 2" → Phase 11
- Per-habit reminder time → Phase 17; "Auto-tick from bot messages" → Phase 18

Tests
- Unit: habit-stats (rest days, not-due days, partial days, streaks); database upgrade adds part of day; old backup without it imports
- E2E: at 1440 and 1920 px wide, content fills the width (no big empty sides); at 1280 px the Habits list and detail panel sit side by side; at 375 px everything stacks with no sideways scroll
- E2E: filter chips filter the list; clicking a habit opens its detail; part of day saves and shows

Done when
- On a wide screen nothing looks stranded in the middle; the Habits screen shows the list with 14-day history and a detail panel, close to the reference.

---

## Build Phase 6 — Today screen ✅
**Goal:** I can log my habits every day. **This is the first version I actually use.** (Reference: Today mock-up.)

Tasks
- Header: date as the eyebrow ("Wednesday, 18 November"), title, active phase chip
- **Summary card:** progress ring ("5/8"), "5 of 8 habits done", current streak, "3 left before bed"; a slot for next-phase progress (filled in Phase 11)
- **Checklist** (main column), grouped by part of day (Morning / Day / Evening / Night):
  - tap (yes/no), +/− stepper (count), minutes, number, time picker
  - right side of each row: the logged time ("8:00 AM"), a short note ("Guava"), "Tonight" for night habits not due yet, partial values in amber ("3,420 / 5,000")
- Check-in note: new optional `note` on habit check-ins
- Quick entry on number habits (+500, +1,000, Enter total), also in the Habits detail panel
- Side column: "What you did today" (empty state until Phase 7), day type (Normal / Rest / Sick / Travel)
- Date navigation (previous/next day, calendar), "today" respects 4 AM
- Scheduled habits only shown when due ("due today" label); "N times a week" shows "2 of 3 this week"
- Optimistic updates (instant tick); the Habits 14-day history now shows real data

Tests
- E2E: tick 3 habits, reload, still ticked; ring shows the right numbers
- E2E: log yesterday from the date picker; partial value shows in amber
- E2E: mark a rest day; streak doesn't break

Done when
- I can tick my day on laptop and phone, and it survives reload.

---

## Build Phase 7 — Categories and activities ✅
**Goal:** log the variable things of the day as separate entries.

Tasks
- Categories: add, rename, recolour (theme token or custom), archive, merge, subcategories
- Activity form: title, category, subcategory, date, start/end or duration, place, people, notes, mood, energy, spend, tags
- Activities screen: list by day, filter by category/tag, edit, delete
- Today side column **"What you did today"**: time, title, category, duration; "duration?" in amber when missing; quick-add button
- "Same as yesterday" / duplicate an entry

Tests
- E2E: log "Visited the fort" under Travel and exploration; it shows on Today and under the filter
- Unit: merging two categories moves all their activities

Done when
- I can log a trip as its own entry and see it on Today and in Activities.

---

## Build Phase 8 — Metrics and timeline ✅
**Goal:** track numbers (sleep, steps, water…) and see the day as a timeline.

Tasks
- Metrics entry on Today: steps, water, weight, bed time, wake time, screen time, reels minutes, mood, energy
- Sleep from bed time → wake time (crosses midnight)
- Number habits read from metrics (steps habit uses the steps metric, no double entry)
- Day timeline: blocks coloured by category, unlogged gaps shown
- Gap prompt on Today: "Nothing logged between 2 PM and 5 PM" → **Fill the gap** (opens quick add with those times)
- Overlap warning with a "fix" action (shorter entry wins)

Tests
- Unit: overlap resolution; sleep split across days; gap detection
- E2E: bed 23:30 / wake 07:30 → 8 h sleep block; a 3-hour gap shows the prompt

Done when
- My day shows as a timeline with sleep, activities and gaps.

How it was built (decisions)
- **Your numbers** card on Today (4 columns), **Timeline** card beside it (8 columns).
- Sleep: "Last night's sleep" asks *Went to bed* (saved on the day before) and *Woke up* (today). Sleep hours are saved on the waking day; typed sleep hours are kept when there's no bed/wake pair.
- Linked habits work both ways: typing steps scores "Daily steps", and the habit's +500 updates the steps number. Same for wake time, bed time, sleep, water, screen time, reels.
- Timeline runs 4 AM → 4 AM: a 24-hour bar plus a list. Entries without a start time are listed under it, not placed.
- Gaps are looked for between wake time and bed time (the wake-up/bedtime habit targets when not logged; today stops at "now"). Gaps of **2 hours or more** are shown.
- Overlap **Fix**: the longer entry is trimmed, split in two around the shorter one, or removed if both cover exactly the same time. Always asks first.

---

## Build Phase 9 — Report engine ✅
**Goal:** every number on the reports and habit panels computed by tested code.

Tasks
- `reports.ts` for any period: average progress, days fully done, streaks, time allocation + Unlogged (24 h / waking), category totals with entries, heatmap values, comparison with the previous period, reels minutes, best/worst day
- `insights.ts`: rule-based insights, including **per-habit** ones for the Habits panel ("You hit this most on weekends and miss it Tuesday to Thursday")
- **Demo data generator**: 60 days of realistic data in a separate demo profile

Tests
- Time allocation sums to 100%; comparison maths; insights only fire on real patterns

Done when
- The engine gives sensible numbers on demo data.

How it was built (decisions)
- Engine: `src/lib/core/reports.ts` (any period: week, month, all time) and `src/lib/core/insights.ts`. Pure functions, tested.
- Averages use finished days only: today joins once everything is done, so a half-done day doesn't drag the numbers down. Rest, sick and travel days are left out of averages and best/worst.
- Time allocation: 24 h view and waking-time view, sleep from bed → wake time, overlaps resolved (shorter wins), entries with only a duration fill free time, the rest is **Unlogged**. Shares always add up to exactly 100%.
- Comparisons: progress in points; category time **per day** (so a half-finished month compares fairly with a full one); numbers as % change.
- Insights fire only with enough days and a clear difference. "Skipped together" compares like with like per weekday, so two habits that are simply weaker on weekdays aren't reported as linked.
- Per-habit insight on the Habits detail panel (last 8 weeks): "You hit this most on weekends and miss it Tuesday to Thursday", or a clear change over the last two weeks.
- **Demo profile**: Settings → Demo data opens 60 days of made-up data in a separate browser database (a banner shows while it's open; "Back to my data" returns). "Rebuild demo data" brings it up to today.
- Reports page shows the engine's numbers (tiles, time table, insights, habits, numbers) so they can be checked; Build Phase 10 turns it into the full report with charts.

---

## Build Phase 10 — Reports screen ✅
**Goal:** the report page from the November report mock-up.

Tasks
- Week / Month / All time switch, period picker
- Stat tiles (4 across on wide screens), time donut + legend, daily completion heatmap, category drill-down, insights card, habit ranking, trend lines
- Two-column card grid on wide screens
- CSV export of the period

Tests
- E2E with demo data: every card renders and matches the engine; visual check in both themes, light/dark, laptop/phone

Done when
- The monthly report looks like the mock-up and shows my real data.

How it was built (decisions)
- Layout (laptop): 4 tiles → **time donut (7) + daily completion calendar (5)** → **categories drill-down (7) + insights (5)** → **habit consistency (5) + trends (7)**. Tablet 2 per row, phone 1.
- Tiles follow the brand page: habit completion (vs last period), longest habit streak, reels per day (vs last period), the category with the most time (entries and hours).
- Donut: 24 h or waking time; categories without their own colour fold into one "Other" slice so no two slices look alike; Unlogged is always shown. Legend lists every slice with time and %.
- Calendar: a month calendar for week/month; "All time" becomes a compact weeks × weekdays grid. Rest days dashed, today ringed.
- Categories: open one to see every entry (date, title, place, time, duration).
- Habit consistency: top 5 and bottom 5 (split in half when there are 10 or fewer).
- Trends: one measure at a time (habit completion, sleep, steps, reels, screen time, water, weight, mood, energy) with the linked habit's target as a dashed line.
- **Export CSV**: one row per day — habits done/due, average, sleep and minutes per category, unlogged, and every number. Text that could run as a spreadsheet formula is made safe.

---

## Build Phase 11 — Phase manager ✅
**Goal:** habit phases unlock based on my real progress. (Reference: Phases mock-up.)

Tasks
- `readiness.ts`: 14-day window, ≥ 80% average progress, ≥ 10 logged days, rest/paused days excluded (values from settings)
- **Active phase card:** habit count, start date, progress bar to the 80% target (with a marker), "Day 9 of 14", strongest and weakest habits, **Enable Phase 2 / Repeat this phase / Pause**
- **Locked phase cards** in a 2–3 column grid: first habits listed, "+4 more habits", **Enable early**
- "Add a custom phase" card
- Side column: **daily completion chart** for the window (bars with the 80% line), **How a phase unlocks** (rules, editable in Settings), **History** ("5 Nov: Phase 1 started")
- **Phase target upgrades:** a phase can raise an existing habit's target when it's enabled (e.g. Daily steps 5,000 → 8,000 with Phase 2); shown on the habit panel as "becomes 8,000 in Phase 2"
- Today summary card and Habits phase header show "Day 9 of 14 · 76%"; a "Ready for Phase 2" banner on Today

Tests
- Unit: 9 vs 10 logged days, 79% vs 80%, paused days, scheduled habits, target upgrade applies on enable
- E2E: enable Phase 2 → its habits appear on Today and the steps target becomes 8,000

Done when
- I can enable Phase 2 from the app and see new habits and the new target.

How it was built (decisions)
- Rule (`src/lib/core/readiness.ts`): the last 14 **finished** days of the current phase (today is shown but judged from tomorrow), skipping rest, sick, travel and paused days. Ready when the window is full, it has ≥ 10 logged days, and the **average of the logged days** reaches 80%. The window restarts when a phase starts or is repeated. All three numbers are editable in **Settings → Phase unlock rule**.
- Phases stack: enabling a phase makes the one before it **Completed**; its habits stay on Today.
- Each phase keeps a **history** (started / started early / repeated / paused / resumed / completed / turned off) and its **target changes** ("When it starts: Daily steps 5,000 → 8,000"). The starter Phase 2 raises steps to 8,000; any locked phase can get target changes ("Change a target").
- **Turn this phase off** (manual override): its habits leave Today, its target changes are undone from today, and the phase before it becomes active again.
- Paused days count like rest days everywhere: the unlock window, streaks and reports.
- Today: the "Next phase" tile shows the rule's average and "Day 9 of 14"; a "You're ready for Phase N" banner links to Phases. Habits: the current phase header shows "Day 9 of 14 · 76%"; a habit's panel shows "becomes 8,000 steps in Phase 2".
- Database version 3: existing phases get a history from their start date, and the starter Phase 2 gets its steps change.

---

## Build Phase 12 — Health: issues, check-ins and a plan for the next few days ✅
**Goal:** track anything health-related (pain, symptoms, long-term concerns) and let it adjust my habits for a few days, with my OK. "Concerns" becomes **Health**.

Tasks
- **Health issues** (concerns are part of this): I only say what it is and how bad (**0–10**); kind, body area, what helps or makes it worse, and which habits matter are worked out by the app (editable under "More details")
- **Daily check-in on Today**: 0–10 per active issue + a short note; one general health note for the day
- **Health screen**: plan card, issue cards (latest level, 14-day trend, check-in history), journal of notes, safety note
- **Plan for the next few days** (rules, no AI), applied only when I approve:
  - high pain/symptom for 2 days → lighten habits that may make it worse for 5 days (lower target, or pause a yes/no habit); they go back automatically
  - add a helpful habit (opens the habit form, prefilled from "what helps")
  - mark today as a Sick day (streaks and the phase window aren't hurt)
  - feeling better (≤ 3 twice) → end the changes early
  - 8+ or worse 3 check-ins in a row → **"See a doctor"** and no exercise suggestions
- Habits can be **paused for a date range** (paused days are "not due": no streak or average penalty)
- Weekly pattern per issue: "Pain was 2 points lower on days you did Stretching"

Tests
- Unit: suggestion rules (thresholds, see-a-doctor, back to normal), temporary target starts and ends, paused days not counted
- E2E: add back pain linked to Workout → check in 7 two days → approve "lighten Workout" → Today shows 15 min → end early → 30 min again

Done when
- I can log back pain each day and the app lightens my workout for a few days when it's bad, after I agree.

How it was built (decisions)
- Menu: **Health** replaces Concerns (old `/concerns` links open Health). Concerns like hair fall are health issues of kind "Concern": they get helpful additions, but the routine is never cut back for them.
- **I only say what's wrong and how bad (0–10)**, plus an optional note. The form shows "What the app understood"; everything else is under "More details (optional)" to correct it.
- **Health advisor** (`src/lib/core/health.ts`, `health-library.ts`): looks at **every habit on the checklist**, today's targets and my history:
  - what usually holds for 13 kinds of issue (back, neck, joints, headache, eyes, stomach, cold/fever, tiredness, sleep, stress, hair, skin, other pain), matched to my habits **by name**, so my own habits work too; "No …" habits always count as helping;
  - my own data: higher pain on days **after** a habit → may make it worse; lower on days I **did** it → helps (3+ days each way, 1.5+ points; if both show up it's unclear and ignored);
  - my own word in "More details" beats both.
- Suggestions, each with its **reasons**, applied only with my OK (one by one or "Apply all"): **lighten** (half, rounded: 30 → 15 min, 5,000 → 2,500 steps), **cut down** an "at most" limit (screen time 180 → 120 min), **a little more** of what helps (water 3 → 3.5 L), **pause** yes/no habits, **add a helpful habit** (form prefilled), **Sick day**, **back to normal**. All changes last 5 days and go back by themselves; "End now" restores from today; ticks and % are scored against each day's target.
- Thresholds: cut back at 6+ two check-ins in a row (cold/fever 5+); raise/add from 3+; **8+ or worse 3 times in a row → see a doctor first**, no new exercise; Sick day at 7+ today; back to normal at ≤ 3 twice; check-ins older than 2 days don't trigger anything.
- Stage 2: an AI advisor can return the same suggestions (with its own reasons, and reading uploaded reports).
- Paused habit days are "not due": no penalty in averages, streaks, reports or the phase window. Today lists them as "paused until …".
- Today: a **Health check-in** card (tap 0–10, optional note, a day note), with a link when the plan has suggestions.
- Database version 4: habits gained `pauses`; concerns gained kind, body area, what helps / makes it worse, plan changes.

---

## Build Phase 12.5 — Health reports ✅
**Goal:** keep medical reports with the rest of my health data.

Tasks
- Upload reports (photo or PDF): date, type (blood test, prescription, scan…), doctor/lab, notes, linked issue
- Key values typed in by hand (e.g. Vitamin D 18 ng/mL, normal 30–100) with a trend chart per value
- Reports included in the backup file (bigger backups, nothing lost)
- Later (AI, Stage 2): read values from a report for me to confirm

Done when
- My reports and their key values are in the app, by date, and survive a backup/restore.

How it was built (decisions)
- **Health → Reports and values** (tabs at the top of both Health pages). Tiles: reports, values tracked, out of range, files.
- A report: title, type (blood test / prescription / scan / doctor's note / other), date, doctor or lab, notes, linked health issues, **photos or PDFs** (up to 10 MB each, stored in this browser as part of the data, and in backups), and **values typed in** with the normal range printed on the report.
- Values are grouped by name across reports (any capitalisation): latest, Low / Normal / High against the report's own range, change since last time, history, and a trend chart with the normal range shaded. A value used before fills in its unit and range from my own earlier entry (no fixed list).
- **Add a value** without a report (e.g. blood pressure at home); those can be deleted from their history.
- Deleting a report deletes its files and values. The Health overview lists values out of range.
- Database version 5 / backup version 6: three new tables (`healthReports`, `reportFiles`, `labValues`); older backups import with them empty. Also fixed: deleting a habit now unlinks it from health issues (backups stay valid).
- Later (Phase 14.5, AI): read a report and offer the values it found, for me to confirm.

---

## Build Phase 13 — PWA and backups ✅
**Goal:** installable on my phone and safe from data loss.

Tasks
- Manifest + icons from `brand.config.ts`, offline app shell, install prompt
- Weekly "download a backup" reminder
- Settings: week start, day start hour, time zone, unlock rule values, units
- Accessibility + performance pass

Tests
- E2E: loads offline after the first visit; Lighthouse PWA/accessibility checks pass

Done when
- Dinik Diary is installed on my phone and works offline.

How it was built (decisions)
- **Manifest and icons from `brand.config.ts`** and the default theme (monogram on the primary colour; rounded, maskable and Apple icons generated at build time). Browser bar uses the theme colour.
- **Offline:** a small hand-written service worker (`public/sw.js`, production builds only): every screen is cached on the first visit; pages are fetched fresh when online and served from the cache when offline; built files are cached for good. All data is already in the browser, so the whole app works offline.
- **Install:** Settings → "Install the app" shows an Install button when the browser offers it, "Share → Add to Home Screen" on iPhone, and "Works offline on this device" once ready. **On the phone this needs the app online over HTTPS (Phase 14 Deploy)**; on the laptop it works now with `npm run preview` (port 3200).
- **Backup reminder:** the date of the last download is remembered; after 7 days (Settings: never / 3 / 7 / 14 / 30) Today shows "Download backup" or "Remind me tomorrow". Settings shows "Last backup: … ago". Not shown in the demo profile.
- **Settings → Day, time and units:** day start hour, week start, time zone (checked against the browser's list; "use this device's"), units.
- **Accessibility:** axe-core (WCAG 2.1 A/AA) runs on every screen with demo data, light and dark, as an e2e test; fixed three contrast/focus issues it found.
- **Performance:** first load of Today ≈ 0.3 s locally; moved a helper so Today no longer loads the drag-and-drop code. Later idea: a lighter validation library to shrink the biggest chunk.

---

## ★ Milestone — Use it for 14 days
- Use Phase 1 habits daily, log activities, check the weekly report.
- Write down what's annoying or missing. Fix the top items before Stage 2.
- Collect **20–30 real "my day" messages** (as I'd type them to the bot) for Build Phase 18.

---

# Stage 2 — Backend, bot and AI

> Details here are lighter on purpose. They'll be planned in detail when Stage 1 is done, using what I learn from real use.

## Build Phase 14 — Deploy
- Create GitHub repo + Vercel account; deploy the Stage 1 app
- **Done when:** Dinik Diary opens from a public URL (still local data).

## Build Phase 14.5 — AI health advisor
Moved up from the AI coach (decided 2026-11-21): the AI needs the server part from Deploy to keep its key secret, and two weeks of real data to be useful.
- I describe what's going on in my own words (and can attach reports); the AI suggests the plan for the next few days with reasons, using all running habits, targets, history, check-ins and report values
- Same suggestions and screens as the rule-based advisor (Phase 12): approve one by one or "Apply all"; nothing changes without my OK
- Safety rules stay fixed in the app (8+ or worsening → see a doctor first, no new exercise); the AI can't switch them off
- Reads uploaded reports and offers the values it found for me to confirm (Phase 12.5 values)
- Falls back to the rule-based advisor when offline, over the free limit, or AI is switched off; health data is sent only with my permission
- **Done when:** I write "lower back hurts since the gym" and get a sensible, explained plan I can approve.

## Build Phase 15 — Supabase and sync
- Supabase project, Postgres tables, RLS, magic-link auth
- `SupabaseRepository` with the same interfaces; import my JSON backup
- **Done when:** laptop and phone show the same data.

## Build Phase 16 — Telegram bot basics
- Bot token, webhook endpoint, my chat ID only, secret token check
- Raw messages saved, `/today`, `/habits` quick-tick buttons, `/undo`, `/help`
- Discuss here: serverless time limits, webhook vs polling
- **Done when:** a message I send is saved and `/today` replies with my checklist.

## Build Phase 17 — Reminders and scheduler
- 9:30 PM "How was your day?", one nudge, weekly summary message
- **Per-habit reminder time** (e.g. Daily steps at 6:30 PM), shown on the habit panel
- Discuss here: Vercel Cron vs Supabase pg_cron vs GitHub Actions, free-tier limits
- **Done when:** I get the nightly reminder on time for 3 days in a row.

## Build Phase 18 — AI parsing + Day log screen
- Gemini provider interface, prompt, Zod schema (plan.md §7); golden test set from my messages
- **Day log screen** (reference: Day log mock-up), in the main navigation:
  - chat on the left, **same conversation as the Telegram bot**; the bot asks "How was your day?" and follow-ups ("What were you doing 2–5 PM?") with quick-reply chips
  - "Tell me about your day" box with a send button
- **"Log your day"** card on Today (sends to the same chat)
- Per-habit setting **"Auto-tick from bot messages"** (on/off)
- **Done when:** my sample days parse correctly with minimal corrections.

## Build Phase 19 — Review and corrections
- **"What it understood"** panel beside the Day log chat: habits ticked (chips), activities with duration and a confidence label ("Sure" / "You told it" / "Check this"), "Edit anything that is wrong"
- **"New category?"** card: keep in a suggested category or make a new one
- "Your original message" note (raw text is always kept for re-reading later)
- The same approve/fix buttons in Telegram
- **Done when:** nothing uncertain is saved without my OK.

## Build Phase 20 — Voice input
- Telegram voice notes → transcription → parser; mic button on Day log and Today
- **Done when:** I can speak my day and get it logged.

## Build Phase 21 — AI coach
- Weekly/monthly summary, "Coach: focus for next week" (max 3), phase advice, concern-aware tips with dermatologist note
- **Done when:** the Sunday report shows 3 sensible suggestions.

## Build Phase 22 — Extras (pick as needed)
- PDF report export, read-only share link, private concern photos
- Automated backups, AI daily cap, monitoring
- Telegram Mini App, Google Fit / Apple Health, calendar import, Hindi/Hinglish UI
