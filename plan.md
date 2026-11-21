# Dinik Diary — Daily Life Tracker + AI Coach — Project Plan

> **Detailed step-by-step build phases are in [build-plan.md](build-plan.md).**

A personal system to track daily habits, log "what I actually did today" (first by tapping in the app, later by messaging a bot), and get weekly/monthly reports with charts, time-allocation percentages and, later, AI suggestions.

**Core idea:** Build the plain tracker first. It works fully without AI and without a backend. Add a backend, the bot and AI later, as separate layers, only where they help.

> **Plan version:** v3 (2026-11-19)
>
> **What changed in v3**
> - App name: **Dinik Diary**.
> - Colours: green "Sage" theme taken from the report mock-up (section 10.3).
> - Phase 1: brush and skincare are **separate** morning/night habits (10 habits).
> - **No habit is hardcoded.** The phase lists below are only the first-run seed; any habit can be added, removed or moved to any phase from the app.
> - Meals: breakfast is a habit; lunch/dinner are activities by default (can be turned into habits from the app).
> - Theme switching lives in Settings.
> - Build phases split into 23 small steps in [build-plan.md](build-plan.md).
>
> **What changed in v2**
> - **Frontend-only start.** No Supabase/Vercel/GitHub/Telegram accounts yet. Data is stored in the browser (IndexedDB) behind a data-layer interface, so moving to Supabase later is a swap, not a rewrite.
> - **Theming and branding system** added (section 10). App name, colours, fonts, logo and text are all config-driven.
> - **Scoring rules** defined (section 5): partial progress is recorded (for example 37%) while the daily "done" flag stays false.
> - **Day ends at 4 AM.**
> - **State management** decided: Zustand + TanStack Query (section 11).
> - Fixes: metrics value types, target history for habits, scheduled habits in the unlock rule, overlap rule, definition of a "logged day".
> - Build phases re-ordered: frontend phases first, then a new "Backend and sync" phase, then the bot and AI.
> - Telegram webhook timeouts and scheduler choice are **deferred** until the bot phase (section 7).

---

## 1. Goals

1. Track fixed daily habits (brush, bath, breakfast, exercise, etc.) with one tap (later also with one message).
2. Record the *variable* things of each day (a trip, a new place, a movie, an interview) as individual entries.
3. Group those entries under repeating headers (Travel, Exploration, Learning, Social, Entertainment...) so weekly/monthly reports can show both totals and drill-down.
4. Show **time allocation**: "This month: 33% sleep, 12% job search, 8% entertainment..."
5. Introduce habits in **phases** so I don't overload myself. I can enable the next phase from the app when I'm ready.
6. Later: log by **messaging a bot** (Telegram) instead of filling forms.
7. Later: weekly/monthly AI suggestions, including for personal concerns (hair fall, dandruff, thin hair, dry skin patches).
8. Work on web (laptop) and phone (installable PWA).
9. Use free tiers wherever possible.
10. **Re-brandable:** name, colours, fonts, logo and wording can be changed from config without touching components.

### Non-goals (for now)
- Not a medical product. It never diagnoses. For persistent hair fall or skin issues, it reminds me to see a dermatologist.
- Not multi-user / not a public SaaS (single user first; multi-user is an optional later phase).
- No Instagram/reel automation here (that is a separate future project).

---

## 2. Guiding principles

- **Plain code first, AI second.** Checklist, streaks, charts and reports are deterministic code. AI is a parsing + coaching layer added on top later. The app must stay fully usable with AI switched off.
- **Local-first, backend later.** Start with browser storage. All reads/writes go through one data-layer interface, so the storage can be switched to Supabase without changing screens.
- **Brand-agnostic UI.** No hardcoded colours, names or user-facing text inside components. Everything comes from tokens and config.
- **Every message is saved raw** (once the bot exists). Keep the original text so AI parsing can be re-run later with a better prompt.
- **AI proposes, I confirm.** New categories, unusual entries and low-confidence parses ask for a quick confirmation.
- **Small starting set.** A checklist that is too long gets abandoned by week two. Start with ~8 habits.
- **No guilt design.** Missing a phase target means "repeat the phase", not "failed". Rest days don't break streaks.
- **One source of truth.** Bot, web and phone all read/write the same data (browser DB now, Postgres later).
- **Feature flags.** Bot, AI parsing, voice and coach can each be turned on/off independently.

---

## 3. High-level architecture

### Stage 1 — Frontend only (Build Phases 0–5)

```
 Me (Web / PWA on laptop + phone)
          |
          v
   Next.js app (client side)
   - Screens (Today, Activities, Reports, Phases, Settings)
   - Theme + brand config
          |
   Data layer interface (repositories)
          |
   LocalRepository  →  IndexedDB (via Dexie)
          |
   JSON export / import (backup + later migration)
```

Note: in Stage 1, data lives in each browser separately. Laptop and phone do **not** sync until Stage 2. Use one main device, and use export/import to move data.

### Stage 2 — Backend and integrations (Build Phase 6 onward)

```
 Me (Telegram text/voice)          Me (Web / PWA on phone)
          |                                   |
          v                                   v
   Telegram Bot API  ------>  Backend API  <------  Next.js app
                                   |          (same screens, data layer now
                                   |           uses SupabaseRepository)
                     +-------------+--------------+
                     |                            |
                 AI parser / coach           Database (Postgres)
              (Gemini, behind an interface)  habits, logs, activities, reports
                     |
             Scheduler (cron)
        nightly prompt, weekly + monthly reports
```

### Components

| Component | Stage | Responsibility |
|---|---|---|
| Dashboard (PWA) | 1 | Checklist, today view, reports, charts, phase manager, profile/concerns, settings |
| Theme + brand config | 1 | Colours, fonts, name, logo, copy text, presets |
| Data layer | 1 | Repository interface; Local (IndexedDB) now, Supabase later |
| Backend API | 2 | Auth, sync, report generation jobs, bot endpoint |
| Telegram bot | 2 | Receives my daily message (text or voice), replies with confirmation, asks follow-ups |
| AI parser | 2 | Turns free text into structured entries with time, duration, category |
| AI coach | 2 | Reads weekly/monthly stats + my concerns and writes suggestions |
| Scheduler | 2 | Nightly reminder, gap check, Sunday weekly review, month-end report, phase-readiness check |
| Database | 1 → 2 | IndexedDB now, Postgres later; same table shapes |

---

## 4. Habit phases (user-facing, enable from the app)

Phases control **which habits appear on my daily checklist**. Only the current phase(s) are shown. Each habit has a `phase` number.

> **Nothing here is hardcoded.** These lists are the **default seed** loaded on first run. From the Habits screen I can add, edit, remove, archive, reorder or move any habit to any phase, and add/rename phases.

### Phase 1 — Foundation (10 habits)
1. Wake up at target time *(time-based, default 7:30 AM)*
2. Water first thing in the morning *(boolean)*
3. Healthy breakfast *(boolean)*
4. Bath *(boolean)*
5. Brush teeth — morning *(boolean)*
6. Brush teeth — night *(boolean)*
7. Skincare — morning face wash *(boolean)*
8. Skincare — night face wash *(boolean)*
9. 5,000 steps *(numeric)*
10. In bed by fixed time *(time-based, default 11:30 PM)*

Time-based habits default to a **15-minute grace window** (up to 15 min late = 50%). Targets and grace are editable per habit.

Lunch and dinner are **not** habits by default. They are logged as activities under "Meals and food" so they appear on the timeline and in time allocation. I can add a "Lunch" habit from the app if I want.

### Phase 2 — Fitness and grooming
1. 8,000–10,000 steps (raises the Phase 1 step target; older days keep the 5,000 target, see section 5.4)
2. Workout or yoga (30 min)
3. Stretching (10 min)
4. Moisturizer + sunscreen
5. Hair care routine (wash/oil on schedule)
6. Floss
7. Protein with each meal
8. No sugary drinks

### Phase 3 — Sleep and mind
1. 7–8 hours of sleep
2. No phone in the last 30 minutes before bed
3. Meditation / breathing (10 min)
4. Screen-time limit respected
5. No doomscrolling / reel-scrolling limit
6. Fruits and vegetables
7. Water goal (about 3 L)
8. No late-night junk food

### Phase 4 — Work and growth
1. Top 3 priorities done
2. Learning time (React / Next.js or whatever I am learning)
3. Work/job-search block done (applications, interview prep)
4. Shutdown ritual at end of work
5. Journaling
6. Expenses logged
7. Plan tomorrow

### Phase 5 — Life and finishing touches
1. Call family
2. Quality time with partner
3. Hobby time
4. Beard trim / nails (scheduled, not daily)
5. Clean clothes
6. Posture check (if sitting a lot)
7. Weekly weight check
8. Read (pages or minutes)

### Phase 6+ — Custom
- I can create my own habits, assign them to any phase or category, or make a new phase.

### Habit types (so the checklist is flexible)

| Type | Example | How it is tracked | Daily progress % |
|---|---|---|---|
| Boolean | Bath | done / not done | 0% or 100% |
| Count | Brush teeth 2x, glasses of water | number vs. target | min(value / target, 1) |
| Duration | Yoga 30 min | minutes vs. target | min(minutes / target, 1) |
| Numeric | Steps, weight | value vs. target | min(value / target, 1); "lower is better" habits use the inverse |
| Scheduled | Beard trim every 10 days, hair wash 3x/week | due-date logic, not daily | scored only on due days |
| Time-based | Wake up by 7:30 | actual time vs. target | 100% if on time; optional grace window (e.g. within 15 min = 50%) |

### Phase unlock rules

Default rule (configurable in Settings):
- Evaluation window: **14 days (bi-weekly)**, not counting rest/paused days.
- Requirement: average **daily progress % >= 80%** across the current phase habits, with **>= 10 logged days** in the window.
- A **logged day** is a day with at least one habit tick/value or one activity entry.
- Scheduled habits count only on the days they are due.
- If met: the app shows "Ready for Phase N+1" and a button **Enable next phase**.
- If not met: "Repeat this phase for 2 more weeks" (no penalty), with the weakest habits highlighted.
- **Manual override always available:** I can enable or disable any phase any time from the Phase Manager screen.
- Phases stack: enabling Phase 2 keeps Phase 1 habits on the list.
- Pause a phase (vacation, illness) so the window and streaks don't punish me.

Decision: **auto-suggest + manual confirm.**

### Phase Manager screen
- List of phases with status: Locked / Active / Completed / Paused.
- For the active phase: progress bar to unlock, 14-day completion %, weakest habits, strongest habits.
- Buttons: Enable next phase, Repeat phase, Pause phase, Edit habits in phase.

---

## 5. Scoring and day rules

These rules are shared by the checklist, streaks, reports and phase unlock. They are implemented once, as pure functions with unit tests.

### 5.1 Two numbers per habit per day
- **`done`** (true/false): the target was fully met that day.
- **`progress`** (0–100%): how much of the target was met. Example: 3 of 8 glasses means `done = false`, `progress = 37.5%`.

Where each is used:
| Use | Based on |
|---|---|
| Streaks | `done` only |
| Checklist tick / ring | `done` count, with partial bars for count/numeric habits |
| Daily / weekly / monthly / yearly completion % | average `progress` (so partial effort is visible) |
| "Days fully done" stat | `done` |
| Phase unlock | average `progress` |

Reports show both: e.g. "Water: 4/7 days fully done, 78% average progress".

### 5.2 Day boundary
- **The day ends at 4:00 AM** (setting, default 4 AM). Anything logged before 4 AM belongs to the previous day.
- Timezone: Asia/Kolkata by default (setting).

### 5.3 Sleep and cross-midnight entries
- Sleep is one entry (bed time → wake time).
- For time allocation, entries that cross the day boundary are **split** between the two days.

### 5.4 Target history
- When a habit's target changes (5,000 → 8,000 steps), the old target is kept with its date range.
- Past days are always scored against the target that was active on that day.

### 5.5 Rest days
- A day can be marked **Rest / Sick / Travel**. Rest days are skipped by streaks and by the phase window.

### 5.6 Overlapping activities
- One time slot belongs to one category.
- If two entries overlap, the **shorter** entry wins the overlapping part (it is usually the more specific one), and the app shows a "fix overlap" prompt.

---

## 6. Everything that can be recorded (entry types)

### 6.1 Fixed daily habits (checklist)
Defined in the phase lists above. These are ticked by tapping (later, also auto-ticked when the bot detects them in my message, e.g. "brushed").

### 6.2 Variable activities (individual entries)
Anything I did that day that is not a fixed habit. **Each is its own entity**, even if the category repeats many times a month. Lunch and dinner go here under "Meals and food".

Fields per entry:
- `title` (e.g. "Visited a fort")
- `category` and optional `subcategory`
- `date`, `start_time`, `end_time` or `duration_minutes`
- `place` (optional), `people` (optional), `notes`
- `mood` / `energy` (optional, 1–5)
- `spend` (optional amount)
- `source` (web / bot / voice) and link to the raw message (when from the bot)
- `ai_confidence` (0–1) and `confirmed` flag (used once AI exists)

### 6.3 Categories (wrappers / headers)

Each activity belongs to a category. Reports show category totals AND a drill-down into each entry.

Starter categories:
- Sleep and rest
- Meals and food
- Fitness and exercise
- Grooming and hygiene
- Travel and exploration (trips, new places, outings)
- Work and job search (applications, interviews, calls)
- Learning and study (courses, coding, reading)
- Entertainment (movies, web series, gaming, reels/social media)
- Social and family (calls, friends, partner time, events)
- Mind and wellness (meditation, journaling, walks)
- Chores and errands
- Hobbies and creative
- Finance and admin (expenses, bills)
- Health and appointments
- Other / Uncategorized

Category rules:
- I can rename, merge, archive or recolor categories. Category colours come from the theme's chart palette by default (section 10).
- Subcategories allowed, e.g. Travel → Day trip, Weekend trip, Local exploration.
- Optional **tags** on top (e.g. #solo, #with-friends, #paid).
- Later: AI can **suggest a new category** when nothing fits; I confirm or merge it.

### 6.4 Quantitative trackers
- Steps, water (litres or glasses), weight, sleep duration, bed time, wake time
- Screen time (manual entry or daily screenshot number)
- Reel/social-media minutes
- Mood and energy (1–5), optional daily
- Expenses (amount + category)

### 6.5 Concerns and health notes (profile)
- Free-text concerns: hair fall, dandruff, thin hair, dry/white patches on skin, etc.
- Each concern has: description, start date, severity (1–5), things I've tried, notes, optional photo reference (stored privately, never sent to AI).
- Concerns can be marked Active / Improving / Resolved.
- Linked habits: e.g. hair concern ↔ hair care, scalp wash, protein, sleep.
- **Safety note shown in the app:** "These are lifestyle suggestions, not medical advice. If hair fall or skin problems persist or worsen, see a dermatologist."

### 6.6 Daily reflection (optional)
- One-line "highlight of the day" and "what to improve tomorrow".
- Gratitude / win of the day.

### 6.7 Weekly/monthly extras
- Weekly weight check, measurements
- Monthly photo check-in (hair/skin) stored privately
- Monthly goals and review notes

### 6.8 Raw message log (Stage 2)
- Every Telegram/web message stored verbatim with timestamp, so I can re-parse later and audit what the AI did.

---

## 7. Logging by message (Telegram bot flow) — Stage 2

> Built after the backend exists. **Implementation details to discuss when we reach this phase:**
> - Serverless time limits: AI parsing can take longer than a webhook request allows (reply fast, then parse in the background or via a queue).
> - Scheduler for the 9:30 PM reminder and nudge: free-tier cron limits differ by provider (Vercel Cron / Supabase pg_cron / GitHub Actions).
> - Free-tier database pausing when inactive.

### Example input
> "Woke up at 8, watched reels 30 min, brushed, ate a guava, applied for jobs for an hour, had tea, interview at 12 for 30 min, lunch at 12:30, went to the fort in the evening"

### What the system does
1. **Receive** the message (text, or voice note → transcribed).
2. **Save raw** message in the database.
3. **AI parse** into structured JSON (see schema below).
4. **Match fixed habits:** brush in the morning → tick "Brush teeth — morning"; wake time compared with target.
5. **Create activities:** reels (Entertainment, 30 min), job applications (Work, 60 min), interview (Work, 30 min), lunch (Meals, 12:30), fort visit (Travel and exploration).
6. **Detect gaps** in the timeline and ask: "Between 2 and 5 PM nothing is logged. What happened?"
7. **Reply with a confirmation**, e.g. "Logged: 3 habits ticked, 5 activities (2 h 0 m work, 30 m reels, 1 trip). Gap 2–5 PM?"
8. **Allow corrections** by reply: "reels was 45 min not 30" or `/undo`.

### Bot commands
- `/today` — today's checklist and logged entries
- `/summary` — quick stats for today / week / month
- `/week`, `/month` — report links or short text summary
- `/undo` — remove last parsed batch
- `/habits` — view and toggle habits for today
- `/phase` — current phase status and readiness
- `/remind` — set or change reminder time
- `/export` — send my data as CSV/JSON
- `/help`

### Nightly routine
- At a set time (9:30 PM) the bot asks: "How was your day? Tell me what you did."
- If no reply by a later time, one gentle nudge, then it stops (no spam).
- A "habits still unticked" quick-tick keyboard (inline buttons) as a fallback to typing.

### AI parsing output schema (target)

```json
{
  "date": "2026-11-18",
  "habits_completed": [
    { "habit_key": "brush_teeth_morning", "time": "08:15", "value": null }
  ],
  "metrics": { "wake_time": "08:00", "steps": null, "water_glasses": null },
  "activities": [
    {
      "title": "Watched reels",
      "category": "Entertainment",
      "subcategory": "Social media",
      "start_time": "08:10",
      "duration_minutes": 30,
      "place": null,
      "notes": null,
      "confidence": 0.9
    },
    {
      "title": "Lunch",
      "category": "Meals and food",
      "start_time": "12:30",
      "duration_minutes": null,
      "confidence": 0.95
    },
    {
      "title": "Visited a fort",
      "category": "Travel and exploration",
      "subcategory": "Local exploration",
      "start_time": "17:00",
      "duration_minutes": null,
      "place": "Fort",
      "confidence": 0.7
    }
  ],
  "new_category_suggestions": [],
  "clarifying_questions": ["How long were you at the fort?"],
  "unlogged_gaps": [{ "from": "14:00", "to": "17:00" }]
}
```

### Parser rules
- Never invent facts. If time/duration is missing, leave null and ask.
- Idempotent: re-sending the same message must not duplicate entries (use message ID + content hash).
- Support Hindi/Hinglish input.
- Validate AI output against a strict Zod schema before saving; reject and retry on invalid JSON.
- Low confidence (< 0.6) → ask me instead of silently saving.

---

## 8. Reports and charts

### 8.1 Daily view
- Today's checklist (current phase habits), progress ring, partial bars for count/numeric habits
- Timeline of the day (blocks by category)
- Entries list with edit/delete
- "Mark as rest day" toggle

### 8.2 Weekly report
- Average progress % overall and per category, plus "days fully done" per habit
- Streaks (current and best) per habit
- Best and worst day
- Time allocation donut: e.g. Sleep 33%, Work 15%, Entertainment 10%...
- Activities list grouped by category (drill-down)
- Reel/social minutes total and trend
- Mood/energy trend
- Rule-based insights (Stage 1); AI coach "3 things to focus on next week" (Stage 2)

### 8.3 Monthly report
- Everything in weekly, plus:
- Heatmap calendar (GitHub-style) of daily progress %
- Month vs previous month comparison for each category
- Category totals with counts, e.g. "Travel and exploration: 4 trips, 11 h", expandable to each trip
- Habit consistency ranking (top 5, bottom 5)
- Phase progress and readiness decision
- Weight/steps/sleep trend lines
- Concerns tracker: severity over time, habits correlated with improvement

### 8.4 Yearly / lifetime
- Yearly heatmap and per-habit average progress by month
- Total habit-days, longest streaks, all-time category split
- Trend lines over months
- Phase history timeline

### 8.5 Time-allocation logic
- Each activity has start/end or duration; the report sums minutes per category and divides by total minutes in the period (24 h × days).
- Days run 4 AM → 4 AM. Entries crossing the boundary are split.
- Sleep is derived from logged bed time and wake time (or a sleep entry).
- Remaining unaccounted minutes appear as an **Unlogged** slice, so the percentages are honest.
- Overlaps follow section 5.6.
- Display options: donut chart, stacked bar by week, and a table with hours and %.
- Toggle: **% of 24 h** / **% of waking time** (excludes sleep).

### 8.6 Insights (rule-based first, AI later)
Rule-based examples (Stage 1, no AI):
- "You skipped skincare on 6 of the 7 days you skipped breakfast."
- "Reels averaged 52 min/day, up 20% from last week."
- "Best completion on days you slept before 11:30 PM."

AI coach examples (Stage 2):
- Plain-language weekly summary
- Suggest next week's focus (max 3 items)
- Suggest phase move or repeat
- Relate concerns (hair, skin) to habit data, with the dermatologist caveat

### 8.7 Export and sharing
- **Stage 1:** export/import all data as JSON (backup + migration), export CSV.
- Later: PDF/PNG of weekly or monthly report; optional read-only share link (e.g. to show a dermatologist).

---

## 9. Data model

The same shapes are used in IndexedDB (Stage 1) and Postgres (Stage 2), so migration is a straight copy.
- IDs are UUIDs generated on the client.
- Every row has `created_at` and `updated_at` (needed for sync later).
- Timestamps stored in UTC; dates stored as the "logical day" (4 AM rule) in my timezone.

```
users(id, name, timezone, telegram_chat_id, created_at)

phases(id, user_id, number, name, status[locked|active|completed|paused],
       started_at, ended_at, unlock_rule_json)

categories(id, user_id, name, parent_id, color_token, icon, archived, sort_order)

habits(id, user_id, key, name, type[boolean|count|duration|numeric|scheduled|time],
       unit, direction[higher_better|lower_better], phase_id, category_id,
       schedule_rule, active, sort_order)

habit_targets(id, habit_id, target_value, target_time, grace_minutes,
              valid_from, valid_to)          -- target history (section 5.4)

habit_logs(id, user_id, habit_id, date, value, time, done, progress, note,
           source, raw_message_id, updated_at)   -- done/progress stored for fast reports,
                                                  -- recomputed if the target changes

day_status(user_id, date, type[normal|rest|sick|travel], note)

activities(id, user_id, title, category_id, subcategory, date, start_at, end_at,
           duration_minutes, place, people, notes, mood, spend, tags[],
           source, raw_message_id, ai_confidence, confirmed, created_at, updated_at)

metrics(id, user_id, date, key[steps|water|weight|sleep_hours|bed_time|wake_time|mood|energy|screen_time],
        value_num, value_time)               -- numbers and times kept in separate columns

raw_messages(id, user_id, channel[telegram|web|voice], text, audio_url, received_at,
             parsed_json, parse_status, parser_version)     -- Stage 2

concerns(id, user_id, title, description, severity, status, started_at, notes)
concern_updates(id, concern_id, date, severity, note, photo_ref)

reports(id, user_id, type[weekly|monthly|yearly], period_start, period_end,
        stats_json, ai_summary, created_at)

coach_suggestions(id, user_id, report_id, text, accepted, created_at)   -- Stage 2

settings(user_id, reminder_time, quiet_hours, unlock_threshold, window_days,
         day_start_hour, week_start, time_base[24h|waking|toggle],
         theme_preset, color_mode[light|dark|system], ai_provider, units,
         feature_flags_json)
```

Notes:
- Stage 2: use row-level security on Supabase, even for single-user.
- Keep `parser_version` so old messages can be re-parsed after improving prompts.

---

## 10. Theming and branding

Goal: change the app name, colours, fonts, logo and wording **without editing components**.

### 10.1 `brand.config.ts` (one file)
```ts
export const brand = {
  name: "Dinik Diary",               // full name
  shortName: "Dinik",                // PWA / home-screen name
  tagline: "Small steps, every day",
  logo: "/brand/logo.svg",
  icon: "/brand/icon.png",           // source for PWA icons + favicon
  fonts: { heading: "Space Grotesk", body: "Inter", mono: "JetBrains Mono" },
  radius: "0.75rem",
  defaultTheme: "sage",
  defaultMode: "system",             // light | dark | system
  botName: "Coach",                  // used later by the Telegram bot
  botTone: "friendly, short, no guilt",
};
```

### 10.2 Design tokens (CSS variables)
- All colours are CSS variables: `--background`, `--foreground`, `--surface`, `--muted`, `--primary`, `--primary-foreground`, `--accent`, `--success`, `--warning`, `--danger`, `--border`, `--ring`, `--chart-1` … `--chart-12`, `--heatmap-0` … `--heatmap-4`.
- Tailwind and shadcn/ui read these variables. Components use classes like `bg-primary` and `text-muted-foreground`, never hex codes.
- A lint rule blocks raw hex/rgb colours in component files.

### 10.3 Theme presets
- Presets live in `src/theme/presets/*.ts`, each with light and dark values.
- **Sage** (default) — taken from the report mock-up. Light values:

| Token | Value | Use |
|---|---|---|
| `--background` | `#F5F7F6` | page |
| `--card` | `#FFFFFF` | cards |
| `--muted` | `#F2F5F3` | inner tiles, inactive buttons |
| `--border` | `#E4EBE8` | card borders, dividers |
| `--foreground` | `#171717` | main text |
| `--muted-foreground` | `#5F6A65` | secondary text |
| `--primary` | `#2F6F62` | active button, links |
| `--primary-foreground` | `#FFFFFF` | text on primary |
| `--accent` | `#E6F0EC` | hover / highlight background |
| `--success` | `#2F6F62` | positive change ("up 6 points") |
| `--warning` | `#9A5B12` | "up 20%" on a bad metric |
| `--destructive` | `#B0432C` | errors, delete |
| `--chart-1` … `--chart-8` | `#0A628C` `#CBA960` `#2A9784` `#B44D33` `#51B6A0` `#CE8B31` `#8059BB` `#E08AA6` | category colours: navy, mustard, green, rust, teal, ochre, violet, pink |
| `--chart-other` | `#8A9590` | categories folded into "Other" |
| `--chart-unlogged` | `#DEE5E1` | Unlogged slice |
| `--heatmap-0` … `--heatmap-4` | `#E4EBE8` `#C5DFD8` `#8CC2B5` `#3A7C6E` `#265A4F` | daily completion heatmap |

  Notes (decided in Build Phase 1):
  - The mock-up's chart colours failed a colour-blind safety check (pink and grey were hard to tell apart; several were too grey). The same hues were nudged and re-ordered until every neighbouring pair passes, in light and dark.
  - At most **8 category colours**. Extra categories fold into "Other" in charts.
  - Text colours are slightly darker than the mock-up so all text meets WCAG AA (4.5:1).
  - Dark values live in `src/theme/presets/sage.ts`; all values are checked by `src/theme/presets.test.ts`.
- **Mono** (black/white/grey) — second preset, mainly to prove switching works. More presets can be added later.
- Fonts: **Space Grotesk** for headings and big numbers, **Inter** for body text.
- Settings screen: pick preset + light/dark/system. The choice is saved in settings.
- Adding a new brand = add one theme file (+ edit `brand.config.ts`).

### 10.4 What follows the theme automatically
- Charts (donut, bars, lines) use `--chart-*`; the heatmap uses `--heatmap-*`.
- Category colours are stored as a **token name** (e.g. `chart-3`), not a hex value, so they recolour with the theme. A custom hex is allowed as an override.
- PWA manifest, theme colour, favicon and app icons are generated from `brand.config.ts`.

### 10.5 Text and wording
- All user-facing text lives in `copy/en.ts` (later `copy/hi.ts` for Hindi/Hinglish UI).
- Components import text by key. Renaming "Habits" to "Rituals", for example, is a one-line change.

### 10.6 `/brand` preview page
- Shows every component, chart and colour in the current theme (light and dark side by side), so a new brand can be checked in one screen.

---

## 11. State management and data layer

### 11.1 Decision: Zustand + TanStack Query (not Redux)
| Kind of state | Tool | Examples |
|---|---|---|
| **Data** (habits, logs, activities, reports) | **TanStack Query** | fetching, caching, refetch after a change, loading/error states |
| **UI / app state** | **Zustand** | selected date, open dialogs, theme preset, filters, feature flags |
| **Form state** | React Hook Form + Zod | habit form, activity form |
| **Server/URL state** | Next.js routing / search params | report period, selected tab |

Why not Redux Toolkit: it works, but for a single-user app it adds a lot of setup (slices, store, providers) for little gain. TanStack Query does the same job as RTK Query, and Zustand covers the small amount of global UI state with much less code. If I want to practise Redux later, only the UI store would change.

### 11.2 Repository pattern (the key to "backend later")
```
screens/components
     ↓ (hooks: useHabits, useTodayLogs, useActivities, useReport…)
TanStack Query
     ↓
Repository interface  (HabitRepo, LogRepo, ActivityRepo, MetricRepo, …)
     ↓                         ↓
LocalRepository (Dexie)    SupabaseRepository (Stage 2)
```
- Screens never touch storage directly.
- Stage 2 = write `SupabaseRepository`, import the local JSON export, flip a config switch.

### 11.3 Pure logic modules (no UI, no storage)
- `scoring` (done/progress), `streaks`, `dayBoundary`, `timeAllocation`, `phaseReadiness`, `insights`.
- Same functions run in the browser now and on the server later. All covered by unit tests.

---

## 12. Tech stack

| Area | Decision | Notes |
|---|---|---|
| Frontend | **Next.js (App Router) PWA**, TypeScript | Same codebase gets API routes in Stage 2 |
| State management | **Zustand + TanStack Query** | See section 11 |
| Forms + validation | React Hook Form + **Zod** | Zod also validates AI output later |
| UI kit | **Tailwind CSS + shadcn/ui** | Token-based theming (section 10) |
| Charts | **Recharts** | Colours from theme tokens |
| Local storage (Stage 1) | **IndexedDB via Dexie** | Behind repository interface |
| Dates | date-fns + date-fns-tz | 4 AM day boundary, Asia/Kolkata |
| Testing | **Vitest** (logic) + **Playwright** (flows) | |
| Database (Stage 2) | Supabase Postgres (free tier) | Decide at Build Phase 6 |
| Auth (Stage 2) | Supabase Auth (magic link) | |
| Hosting | Local dev now; Vercel later | |
| Messaging (Stage 2) | Telegram bot | Webhook vs polling decided at that phase |
| AI (Stage 2) | **Gemini** behind a provider interface | Groq/OpenRouter/others can be swapped in |
| Voice (Stage 2) | Telegram voice → Gemini audio; Web Speech API in PWA | |
| Scheduler (Stage 2) | Decide at Build Phase 7 | Vercel Cron / pg_cron / GitHub Actions |
| Photos (Stage 2) | Supabase Storage (private) | Never sent to AI |

---

## 13. Build phases (development roadmap)

> **Superseded by [build-plan.md](build-plan.md)**, which splits the work into 23 smaller phases (0–22) with tasks, tests and "Done when" for each. The summary below is kept for reference only.
>
> Do not confuse these with the *habit phases* above. These are the order in which I build the software.
> Each phase ends with its **Done when** check, its tests passing, and a few days of real use before the next phase.

### Stage 1 — Frontend only (no accounts needed)

#### Build Phase 0 — Setup + theme foundation
- Next.js + TypeScript, Tailwind, shadcn/ui, ESLint/Prettier, Vitest, Playwright
- `brand.config.ts`, design tokens, 4 theme presets, light/dark/system, `copy/en.ts`
- `/brand` preview page
- App shell: navigation (Today, Activities, Reports, Phases, Settings), mobile-first layout
- Local git repo (no GitHub needed yet)
- **Done when:** I can switch theme preset and light/dark in Settings and the whole app (including a sample chart) changes; renaming the app in `brand.config.ts` changes it everywhere.
- **Tests:** lint rule catches a hardcoded colour; Playwright: theme switch persists after reload.

#### Build Phase 1 — Plain habit tracker
- Dexie database + repository interface + TanStack Query hooks
- Seed habits and phases from section 4 (Phase 1 active)
- Today screen: checklist for active phases, progress ring, partial bars, date picker (go back to earlier days)
- Add/edit/archive habits, assign phase and category, target history
- Scoring (done + progress), streaks, 4 AM day boundary, rest days
- JSON export/import (backup)
- **Done when:** I can tick my day on laptop and phone, it survives reload, and export → import restores everything.
- **Tests:** unit tests for scoring, streaks (including rest days), day boundary (3:59 AM vs 4:00 AM), target history.

#### Build Phase 2 — Activities, categories and metrics
- Categories CRUD (rename, merge, archive, colour token), subcategories, tags
- Activities CRUD (title, category, time, duration, place, people, notes, mood, spend)
- Daily timeline view, overlap warning
- Metrics entry: steps, water, weight, sleep, wake/bed time, screen time, mood/energy
- **Done when:** I can log a trip as its own entry under Travel and exploration and see it on the timeline.
- **Tests:** overlap rule, cross-midnight split.

#### Build Phase 3 — Reports and charts
- Weekly, monthly and yearly reports, heatmap, category totals with drill-down
- Time-allocation donut / stacked bar with Unlogged slice; 24 h / waking-time toggle
- Rule-based insights, period comparison
- CSV export
- Demo data generator (60 days of fake data) for testing charts
- **Done when:** the monthly report shows "33% sleep, 12% job search..." from my real data and matches my sense of the month.
- **Tests:** time-allocation sums to 100%, unlogged slice correct, demo data renders all charts.

#### Build Phase 4 — Phase manager
- Phase statuses, 14-day readiness (average progress ≥ 80%, ≥ 10 logged days), enable/repeat/pause, manual override
- Weakest/strongest habits
- **Done when:** I can enable Phase 2 from the app and see new habits appear.
- **Tests:** readiness edge cases (scheduled habits, rest days, 9 vs 10 logged days).

#### Build Phase 5 — PWA polish + concerns (no AI)
- Manifest + icons generated from brand config, offline shell, install prompt
- Concerns profile with updates over time (no photos yet) and safety note
- Daily reflection fields
- **Done when:** the app installs on my phone, opens offline, and concerns can be tracked.

### Stage 2 — Backend, bot and AI (accounts needed)

#### Build Phase 6 — Backend and sync
- Create GitHub, Supabase and Vercel accounts; deploy
- Postgres tables from section 9 + RLS, Supabase Auth
- `SupabaseRepository`, import my local JSON export
- **Done when:** laptop and phone show the same data.

#### Build Phase 7 — Telegram bot (text)
- BotFather token, endpoint, whitelist (my chat ID only), webhook secret
- Raw message storage, `/today`, `/undo`, inline quick-tick buttons
- Nightly reminder (scheduler decided here)
- **Done when:** a test message arrives and is saved.

#### Build Phase 8 — AI parsing
- Gemini provider interface, prompt + Zod schema
- Confidence handling, clarifying questions, gap detection, category suggestions
- Review Inbox screen (approve/fix low-confidence items)
- Idempotency and re-parse tooling
- Golden test set from 20–30 of my real messages
- **Done when:** my sample day produces correct entries with minimal corrections.

#### Build Phase 9 — Voice input
- Telegram voice-note transcription, mic button in PWA
- **Done when:** I can speak my day into Telegram and get it logged.

#### Build Phase 10 — AI coach
- Weekly/monthly AI summaries, "next week focus", phase-readiness advice
- Concern-aware suggestions with dermatologist disclaimer (UI + prompts)
- Report delivery in app + short Telegram message
- **Done when:** the Sunday report arrives with 3 sensible suggestions.

#### Build Phase 11 — Hardening and extras (optional)
- PDF report export, read-only share link, concern photos (private storage)
- Automated backups, monitoring, rate limiting, AI daily cap
- Telegram Mini App, multi-user, Google Fit / Apple Health, calendar import

---

## 14. Quality, security and privacy

- **Privacy:** this is sensitive personal data (health, routines, location).
  - Stage 1: data stays in my browser. **Browser storage can be cleared**, so the app reminds me to export a backup weekly.
  - Stage 2: private Supabase project, RLS, API keys server-side only.
- **Telegram security:** accept messages only from my chat ID; verify the webhook secret token.
- **AI data:** Gemini free tier accepted (decision). Concern photos are never sent to AI.
- **Testing:** unit tests for scoring/streak/percentage/phase logic; golden-file tests for the parser; Playwright for key flows; manual checklist for the bot.
- **Observability:** log parse failures and low-confidence cases to improve prompts.
- **Medical safety:** coach prompts must avoid diagnosing or prescribing; always suggest a dermatologist/doctor for persistent issues.
- **Cost guard:** cap AI calls per day; fall back to saving the raw message if the AI quota is hit and parse later.

---

## 15. Decisions

| # | Decision | Answer |
|---|---|---|
| 1 | Frontend framework | Next.js PWA (TypeScript) |
| 2 | Backend | None in Stage 1; Next.js API routes in Stage 2 |
| 3 | Database | IndexedDB (Dexie) now; Supabase later |
| 4 | Auth | None in Stage 1; Supabase Auth later |
| 5 | AI provider | Gemini (free tier OK), behind an interface |
| 6 | Messaging channel | Telegram (Stage 2) |
| 7 | Telegram mode | Decide at Build Phase 7 |
| 8 | Voice input | Telegram voice + Gemini; Web Speech API in PWA (Stage 2) |
| 9 | Scheduler | Decide at Build Phase 7 |
| 10 | Reminders | Telegram (Stage 2) |
| 11 | Charts library | Recharts |
| 12 | Phase unlock | Auto-suggest + manual confirm |
| 13 | Unlock threshold | 80% average progress over 14 days, ≥ 10 logged days |
| 14 | Time-allocation base | Toggle: % of 24 h / % of waking time |
| 15 | Photos for concerns | Yes, later (private storage, never sent to AI) |
| 16 | Hosting | Local now; Vercel + Supabase later |
| 17 | Report delivery | In-app; also Telegram message in Stage 2 |
| 18 | Language of input | English + Hinglish |
| 19 | Week start day | Monday |
| 20 | Reminder time | 9:30 PM IST |
| 21 | Day boundary | 4:00 AM |
| 22 | State management | Zustand + TanStack Query |
| 23 | Partial progress | Recorded as % (e.g. 37%); `done` only when target fully met |
| 24 | Theming | Token-based presets (Sage default + Mono), light/dark/system, brand config file, switch in Settings |
| 25 | App name | Dinik Diary |
| 26 | Brush / skincare | Separate habits for morning and night |
| 27 | Meals | Breakfast = habit; lunch/dinner = activities by default; all editable |
| 28 | Habits | Seed only, nothing hardcoded; add/remove/move any habit between phases |
| 29 | Default targets | Wake 7:30 AM, bed 11:30 PM, 15-min grace (= 50%), editable |
| 30 | "Scheduled" habits | Not a separate type: any habit can have a schedule (daily, chosen weekdays, N times a week, every N days). Decided in Build Phase 3. |
| 32 | Habits screen layout | Phases are collapsible (closed by default, open state remembered per device). Habits are reordered by drag and drop (mouse, touch, keyboard) and can be dragged into another phase **only if that phase is unlocked**; the "Move to phase" menu follows the same rule. The habit form can still put a habit in any phase, to plan locked phases. |
| 33 | Dashboard layout | Every laptop screen is a dashboard: 12-column grid, cards side by side, a row of 4 summary tiles on most screens. Phone: one column. See build-plan.md "Screen layout system". |
| 34 | Navigation | Laptop: Today, Habits, Activities, Reports, Phases (+ Day log in Stage 2), then Health (was Concerns), Settings, Brand preview. Phone tabs: Today, Habits, Reports, Phases, More (Activities lives in More; Today shows "What you did today"). Day log is added to the menu only when it works (Stage 2). |
| 35 | Part of day | Every habit has a part of day (Any time, Morning, Afternoon, Evening, Night) for filters and for grouping the Today checklist. |
| 36 | Subcategories | Free text on each activity (e.g. Travel → "Local exploration"), with suggestions from earlier entries in that category. Nested categories (`parentId`) stay available for later. Decided in Build Phase 7. |
| 37 | Health (was "Concerns") | One Health section: issues of kind pain / symptom / concern, severity 0–10, a daily check-in on Today. I only say what's wrong and how bad; a rule-based **health advisor** looks at all running habits, their targets and my history, and suggests changes with reasons (lighten, cut down a limit, a little more of what helps, pause, add a helpful habit, sick day, see a doctor) for 5 days, applied only with my approval. Reports (upload + typed key values) in Build Phase 12.5. An AI advisor (Stage 2) can replace the rules with the same kind of suggestions and read reports. Not medical advice; red flags always say "see a doctor". Decided 2026-11-21. |
| 31 | Theme storage | Saved in settings (travels with backups) + a localStorage copy for flash-free loading. The latest choice on the device wins; restoring a backup applies its theme. |

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Checklist too long, I abandon it | Phased habits, start with 8 |
| Browser data cleared in Stage 1 | Weekly export reminder, JSON import |
| No laptop/phone sync in Stage 1 | Use one main device; export/import; sync arrives in Build Phase 6 |
| AI misparses my day | Confidence threshold, Review Inbox, `/undo`, raw message kept for re-parse |
| Free AI quota runs out | Provider interface, daily cap, save raw and parse later |
| Percentages look wrong due to gaps | Unlogged slice plus nightly gap questions |
| Re-branding breaks UI | Tokens only, lint rule, `/brand` preview page |
| Over-reliance on AI health advice | Disclaimer and dermatologist nudge |
| Scope creep | Ship Build Phase 1 first and use it for a week before continuing |

---

## 17. Open questions

All earlier questions are answered (section 15, rows 24–29). Remaining small items:
1. **Logo:** none yet. A simple text/monogram logo is used until one is chosen.
2. **Default wake/bed targets:** 7:30 AM / 11:30 PM are placeholders. Change them in the app.

---

## 18. Success criteria

- I use it for 14 days in a row with the Phase 1 checklist.
- Logging my day takes under 2 minutes (tapping in Stage 1, messaging in Stage 2).
- The monthly report shows category totals, drill-down trips and a time-allocation chart that matches my sense of how the month went.
- Changing the theme or brand name takes one config change and no component edits.
- At least one coach suggestion per month changes something I actually do (Stage 2).

---

## 19. Future ideas (parking lot)

- Telegram Mini App dashboard inside the chat
- Wearable/Google Fit/Apple Health import for steps and sleep
- Calendar import for meetings and interviews
- Gamification: badges for streaks, phase completion
- Accountability buddy: share the weekly report with one trusted person
- Goal tracking (monthly goals, e.g. "visit 4 new places")
- Spending insights tied to activities
- "Same as yesterday" quick log and saved day templates
- Hindi/Hinglish UI copy
- Merge with a future agent project: a manager agent coordinating parser, analyst and coach workers
