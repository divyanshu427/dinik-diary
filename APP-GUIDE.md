# Dinik Diary: everything built so far

*Dinik Diary means "daily diary". This guide describes the app as it stands on 2026-11-21: what it does, what every page is for, and what changes what. It is written in plain language for the owner and for anyone who is shown the app.*

- Live app: https://dinik-diary.vercel.app
- Code: https://github.com/divyanshu427/dinik-diary
- Plans: [plan.md](plan.md) (the idea and rules) and [build-plan.md](build-plan.md) (the build phases)

---

## 1. What it is, in one minute

Dinik Diary is a personal life tracker that runs in the browser and installs on a phone like an app.

You do three kinds of thing in it:

1. **Tick habits** each day (brush teeth, steps, water, bed on time…). Habits come in **phases**, so you start with a few and add more when you're ready.
2. **Log what you did** that isn't a daily habit (a trip, a movie, an interview, lunch) as **activities** with a time and a length.
3. **Say how you feel** when something hurts or bothers you (**Health**). The app suggests a plan for the next few days; you decide.

Everything you enter feeds **Reports**: where your time went, how consistent you were, and patterns the app noticed.

**Where your data lives:** only on your own device, in the browser's database. Nothing is sent to a server (there is no backend yet). Each person who opens the app gets their own empty copy.

---

## 2. Where the project stands

| Part | Status |
|---|---|
| Habits, phases, today checklist | Done |
| Activities, categories, day timeline | Done |
| Numbers (steps, water, weight, sleep, mood…) | Done |
| Reports and charts | Done |
| Phase manager (unlock, repeat, pause) | Done |
| Health issues, check-ins, rule-based advisor | Done |
| Health reports (photos, PDFs, lab values) | Done |
| Installable app (PWA), offline, backups | Done |
| Hosted online (Vercel), installable on phone | Done |
| Phone-first redesign of every page | Done |
| One logo row + ⓘ page tours on every page | Done |
| Water goal moved into Phase 1 | Done |
| Choose which habits to start, and when (first run and each phase) | Done |
| Sign in and sync between laptop and phone (Supabase) | Done (Phase 15) |
| AI features (health advisor, day log chat, voice) | Not built (planned) |
| Phone notifications and reminders | Not built (planned) |

There is **no Telegram bot** in the plan any more. The in-app Day log and phone notifications replace it (decided 2026-11-21).

---

## 3. How the pieces fit together

```
You tick / type
      │
      ▼
   TODAY ───────────────► HABITS (streaks, 14-day dots, % per habit)
      │                          │
      │                          ▼
 ACTIVITIES               PHASES (14-day average decides when
 (what you did)            the next phase can start)
      │                          │
      └──────────┬───────────────┘
                 ▼
             REPORTS  ◄──────── HEALTH (check-ins, plan, reports and values)
```

- **Today** is where daily input happens.
- **Habits** holds the habits and shows how each one is going.
- **Phases** decides which habits are on your checklist.
- **Activities** holds everything that isn't a habit.
- **Reports** reads all of it and never changes anything.
- **Health** adjusts habit targets for a few days, only when you say yes.

---

## 4. Words used in the app

| Word | Meaning |
|---|---|
| **Habit** | Something you do regularly, like "Brush teeth — morning". Nothing is hardcoded; you can add, edit, move, pause, archive or delete any habit. |
| **Phase** | A group of habits. Only habits in **unlocked** phases appear on Today. Locked phases hold habits for later. |
| **Target** | What counts as done: 5,000 steps, 3 L water, "by 07:30". |
| **Done** | The target was fully met that day. Used for ticks and streaks. |
| **Progress** | How much of the target was met (0–100%). 2,100 of 8,000 steps is not done, but progress is 26%. Used for averages and phase unlocking. |
| **Streak** | Days in a row a habit was done. Rest, sick, travel and paused days don't break it. |
| **Day type** | Normal, Rest, Sick or Travel. The last three protect your streak and don't count against a phase. |
| **Pause (habit)** | Makes a habit not due for 3, 7 or 14 days. |
| **Start date** | When a habit starts counting. Before it, the habit isn't due and its days are never "missed". |
| **Waiting** | A habit in a running phase that you haven't started yet ("Not started"), or that starts on a later day ("Starts 25 Nov"). It isn't on Today and isn't in the phase average. |
| **Pause (phase)** | Stops the phase clock; paused days don't count against you. |
| **Archive** | Hides a habit but keeps its history. **Delete** removes it and all its check-ins. |
| **Activity** | A thing you did: title, category, time, length, place, people, notes, mood, spend, tags. |
| **Category** | A group for activities (Work, Meals, Travel…). 14 come built in; you can rename, recolour, merge and archive them. |
| **Unlogged** | Time in the day you haven't recorded. It is not "wasted time". |
| **Check-in** | A 0–10 rating of a health issue on a day. |
| **Backup** | A file with all your data, so you can restore it. |
| **Demo data** | Sample data in a separate database, so you can look around safely. |

---

## 4b. Starting habits a few at a time

You don't have to take on every habit in a phase at once.

- **The first time you open the app** it asks **"Which habits do you want to start with?"** for Phase 1 (four easy ones are ticked as a suggestion). Pick a few, or tap **Start all 11 instead**. Step 2 offers the Today tour. The habits you didn't pick wait in Phase 1.
- **Enabling a phase** (Phases page) opens **Start Phase 2 · …**: tick the habits to begin with ("we suggest 2 to 3"), choose whether to apply the phase's target change (e.g. Daily steps 5,000 → 8,000), and pick **Today, In 4 days or a date**. The rest of the phase waits.
- **Starting the rest later:** on the Phases page (the current phase card lists Started, Starts later and Not started, each with a **Start** button, plus **Choose more habits**), or on the Habits page (the **Waiting to start** group in each phase, with **Start** and a ⋮ menu: Start now, Pick a start date (Tomorrow, In a week, Other date…), Don't start yet).
- **What a start date changes:** the habit joins Today, its streak and the phase average **from that day**. Earlier days don't count and are never shown as missed. A habit started in the last week shows **New · day N**.
- **Today** shows "Only started habits count. N more are waiting." and lists waiting habits under **Not due today** with **Not started** or **Starts Wed 25 Nov**, and a **Start more from Phases** link.

---

## 5. Getting around

**On a phone** (below 768 px wide)
- A bottom bar: **Today · Habits · Activities · Reports · More**.
- **More** opens a sheet with every page: Today, Habits, Activities, Reports, Phases, Health, Settings, Brand preview.
- At the top of every page: the **logo row** (DD Dinik Diary) with the **ⓘ** button at its right end.
- Menus open as **bottom sheets** with a short description under each choice. Popups (forms, check-ins) slide up from the bottom.
- The phone's **back gesture** closes the habit details page.

**On a laptop**
- A sidebar on the left: **Today, Habits, Activities, Reports, Phases**, then **Health, Settings, Brand preview**.
- Every page is a **dashboard**: cards side by side on a 12-column grid.
- The **ⓘ** button sits at the top right of each page, after the page's own buttons.

---

## 6. Page by page

### 6.1 Today

**What it's for:** your checklist for the day. This is where most of the app starts.

**Top of the page**
- The date and the title (**Today**, or **Yesterday**).
- A small control **‹ 📅 ›** to open an earlier day. Days that haven't happened yet can't be opened. **Back to today** appears when you are on an older day.

**The cards**

| Card | What it shows and does |
|---|---|
| **Summary** | A ring ("8/17") and "8 of 17 habits done". "9 left before bed" and "Next: …" say what's still to do. Two small tiles: **Current streak** (days at 80% or more) and **Next phase** (14-day average with a marker at the target, and "Day 14 of 14"). On a laptop there are four tiles, with "Left before bed" as the fourth. |
| **Checklist** | Your habits grouped as **Morning, Any time, Afternoon, Evening, Night**, each with a count like 6/7. Tap a group's header to fold it. Evening and Night start folded until their time comes. |
| **Day type** | Normal / Rest / Sick / Travel. Rest, sick and travel days protect streaks. |
| **Your numbers** | Steps, water, weight, screen time, reels, plus last night's sleep (bed and wake time), and Mood and Energy as 1–5 buttons. Saved when you leave a box. |
| **Your day** | A timeline of the day: sleep, activities and gaps. Shows "Nothing logged between 8:00 AM and 4:07 PM" with **Fill the gap**. Has a **+ Log** button, **Repeat yesterday**, and **See all activities**. A 24-hour bar sits above the list. |
| **Health today** | If you have health issues, a small card to check in from Today. |
| **Backup reminder** | A reminder card when it's been a while since your last backup. |

**How the checklist rows work**
- **Yes/no habit** (Bath): tap the round box. Tap again to untick.
- **Amount habit** (Daily steps 8,000, Water goal 3 L): shows `2,100 / 8,000 steps` with a thin progress bar. Use **+500 / +1,000** (or the habit's quick amounts) or **Enter total**. A partly done habit shows a ring that fills as you go.
- **Count habit** (Protein with each meal, 3): a **– 1 / 3 meals +** stepper.
- **Duration habit** (Workout 30 min): quick **+5 / +15** buttons and **Enter total**.
- **Time habit** (Wake up on time, By 07:30): pick a time or tap **Now**. It shows "On time" or "110 min late". Up to 15 minutes late counts as half.
- **Note:** after a habit is ticked, a small note icon lets you add a note ("Guava").
- **Linked numbers:** Steps, Water, Wake up and In bed fill the matching habit from **Your numbers**, and the habit fills the number. Typing in either place gives the same result.

**What changes what**
- Ticking feeds the streaks in Habits, progress in Phases, and everything in Reports.
- Un-ticking removes that day's check-in.
- Nothing here changes a habit's target. That's done in Habits.

**Tour:** ⓘ → 6 steps (summary, another day, checklist, day type, your numbers, your day).

---

### 6.2 Habits

**What it's for:** all your habits, grouped into phases. This is where you add, edit and organise them.

**Top of the page:** big **Add habit** and **Add phase** buttons.

**Summary tiles:** Active habits (and how many wait in locked phases), 14-day average, Best current streak (and which habit), Needs attention (the weakest habit, if below 80%).

**Filter chips:** All, then parts of the day (Morning, Night…) and categories (Sleep, Meals…). While a filter is on, dragging is switched off.

**Phases**
- Each phase is a card you open and close (the open state is remembered on that device). It shows the phase name, how many habits, and a status: **Active, Completed, Paused, Locked**.
- A habit row shows: name, a line of details (target, schedule, part of day, category), the **last 14 days as dots** (filled = done, light = partly, outline = missed), the **streak**, the **%** over 14 days, and **WEAKEST** for the lowest one under 80%.
- **Phone:** the row shows name and % at the top, details, the 14 dots, then the streak; drag handles stay hidden until you choose **Reorder habits** from the phase's menu (with a **Done** button).
- **Laptop:** a table with columns (Habit, Last 14 days, Streak, %), drag handles always visible, and a **habit details panel** beside the list.
- **Waiting to start:** habits you haven't started are in their own group at the bottom of the phase ("2 of 7 started" in the phase header), each with **Start** or a **Starts 25 Nov** label.

**A habit's ⋮ menu**

| Choice | What it does |
|---|---|
| Start now / Pick a start date / Don't start yet | Only for habits that haven't started (see 4b) |
| Open details | Streaks, 30-day history, target history |
| Edit habit | Name, target, how often, category, part of day, phase |
| Move to another phase | Only into **unlocked** phases (locked ones are greyed out) |
| Reorder | Move up or down within the phase |
| Pause habit | For 3 days, a week or 2 weeks. It leaves Today and its streak stays safe. A paused habit shows "Paused until …" and the menu offers **Resume habit**. |
| Archive habit | Hidden from lists, history kept. Restore from "Archived habits". |
| Delete habit | Removes it and all its check-ins (asks first) |

**A phase's ⋯ menu:** Add habit to this phase, Edit phase (name and description), Reorder habits, Move phase up or down, Delete phase (only when it has no habits, archived ones included).

**Habit details** (a full page on phones, a side panel on laptops): the target, how often, current and best streak, last 14 days %, an **insight** ("You hit this most on weekdays"), a 30-day grid (Done / Partial / Missed / Not due), and **target history**.

**The habit form**
- **Name**, **Phase**, **Category**, **How it's measured** (yes/no, time, count, duration, number), **Goal** (higher or lower is better), **Target**, **Unit**, **Target time** and grace minutes, **How often** (every day, chosen weekdays, N times a week, every N days), **Part of day**, a short description.
- **Editing a target:** "This changes from today. Past days keep the old target." (Past days are always scored against the target active on that day.)
- The measurement type is locked once a habit has check-ins.

**Drag and drop:** reorder inside a phase, or drag a habit to another phase **if that phase is unlocked**. Keyboard dragging works too (Space to lift, arrows to move).

**Tour:** ⓘ → 5 steps (add your own, how you're doing, filters, phases, one habit).

---

### 6.3 Activities

**What it's for:** logging what you did that isn't a daily habit.

**Phone:** three tabs under the title, **Entries · Breakdown · Categories**, a full-width **This week / This month / All time** switch, and a floating **+ Log activity** button above the bottom bar.
**Laptop:** all three sections on one dashboard.

**Entries**
- Category chips (and `#tags`) filter the list.
- One card per day, newest first: the date, "5 entries · 6 h", then each entry with its **time**, a coloured dot, **title**, **category · subcategory · place · people**, and **length**.
- The ⋮ menu: **Edit**, **Copy to today** (on other days), **Delete**.
- An entry without a length shows "duration?" in amber.

**Breakdown**
- Four tiles: **Entries**, **Time logged**, **Top category**, **Spend**.
- **Time by category:** each category's share of logged time, with bars. **Tap a category name** to jump to Entries filtered to it.

**Categories** (14 built in)
Sleep and rest · Meals and food · Work and job search · Travel and exploration · Learning and study · Entertainment · Fitness and exercise · Social and family · Grooming and hygiene · Mind and wellness · Chores and errands · Hobbies and creative · Finance and admin · Health and appointments (plus Other).
- **In use** and **Not used yet** groups with entry counts (a category counts as "in use" if an activity **or a habit** uses it).
- Each has a ⋮ menu: **Edit** (name and colour, including a custom colour), **Merge into…** (moves all its entries to another), **Archive / Restore**, **Delete** (only when nothing uses it).

**The activity form:** What did you do, Category, Subcategory (free text with suggestions), Date, Start, End, Duration (start and end fill it in), Place, With (people), Notes, Mood, Energy, Spent (₹), Tags.

**Rules:** an entry that crosses the day boundary is split between the two days. If two entries overlap, the shorter one keeps the shared time and the app offers **Fix** (trim, split or remove, always asking first).

**Tour:** ⓘ → up to 6 steps (three views, log, filters, entries by day, where the time went, categories).

---

### 6.4 Reports

**What it's for:** how your time went and how consistent you were. Reports only read your data; fix a number on Today or Activities.

**Top:** a **CSV** button (downloads the period as a spreadsheet), then **Week / Month / All time** with round **‹ ›** buttons to go to earlier periods.

**Phone section chips:** **Overview · Time · Days · Habits · Trends** (Overview shows everything; the others show one part). On phones the cards are in this order: tiles, insights, daily completion, time, habit consistency, trends, categories.

**The cards**

| Card | What it shows |
|---|---|
| **Tiles** | Habit completion (and change from last period), Longest habit streak, Reels and social media per day, and your top category by entries and time |
| **Insights** | Patterns the app found, for example "You skipped Face wash on 6 of the 7 days you skipped Water" or "Days after bed by 11:30 averaged 87% against 56%". Only shown when clear. |
| **Daily completion** | A calendar where darker days are more complete; rest days are dashed. **Tap a day to open it on Today.** Best and Weakest day shown as two boxes. |
| **Where your time went** | A donut of your time by category, switchable between **24 hours** and **Waking time**. Slices without their own colour fold into "Other"; **Unlogged** is shown separately. |
| **Habit consistency** | The most consistent and the habits needing attention (top and bottom 5, with streaks), and "See all N habits" |
| **Trends** | A line chart, one measure at a time (habit completion, sleep, steps, reels, screen time, water, weight, mood, energy) with the target as a dashed line and the average |
| **Categories** | Time and entries per category; open one to see each entry |

**Tour:** ⓘ → up to 9 steps.

---

### 6.5 Phases (More → Phases on a phone)

**What it's for:** introduce habits a few at a time so you don't take on too much.

**The idea:** the current phase is judged over a window of days (default **14**). When your **average progress reaches the target (default 80%)** and **at least 10 of those days** have something logged, the next phase is offered. Rest, sick, travel and paused days don't count. Not there yet? **Repeat** the phase for another round, no penalty. Feeling ready? **Enable the next phase early**.

**Current phase card** (highlighted)
- Badges: **Active**, **Day 14 of 14**. Name and "Active since 25 Oct · 17 habits on your checklist".
- **"2 of 7 habits started"** with a small bar (filled = started, dashed = starts later, grey = not started). While some wait, it lists **Started** (since when), **Starts later** (the date) and **Not started** (a **Start** button each), and **Choose more habits**.
- **14-day average** (big %), "14 logged days · 10 needed · target 80%", a progress bar with the target marked, and a **0% · 80% · 100%** scale.
- A coloured message: **amber** when the window ended short ("The 14 days are up: 72%, so 8 points short…"), **green** when ready, **grey** while in progress, with a **How unlocking works** link.
- Buttons: the most useful step is the filled one (**Repeat this phase** when short, **Enable Phase N** when ready), plus **Pause / Resume** and a **⋯** menu (**Edit habits**, **Turn this phase off**).
- **Strongest** and **Weakest** habits of the window.

**Other cards**
- **Daily completion chart:** one bar per day of the window, with the target line.
- **Up next:** locked phases. Each shows 3 habits and "+N more", the **target changes** that start with it (for example "Daily steps: 5,000 → 8,000"), and two buttons: **Change a target** and **Enable early**.
- **Completed** phases.
- **How a phase unlocks** (the rules in plain words, with a link to change them in Settings) and **History** (started, completed, repeated, paused…).
- **Custom phase** (a button beside the title) adds your own phase.

**What changes what:** enabling a phase opens **Start Phase N**: the habits you pick join Today from the day you choose (the rest wait), and the phase's target changes apply from today if you keep them ticked. Turning a phase off takes its habits off Today and keeps their history.

**Tour:** ⓘ → 7 steps.

---

### 6.6 Health (More → Health on a phone)

**What it's for:** you say what's wrong and how bad (0–10). The app uses **all your running habits, their targets and your history** to suggest a plan for the next few days. **You approve every change.**

**Top:** tabs **Overview | Reports and values**, and a big **+ Add health issue**.

**Adding an issue:** a name (or pick one the app knows), a kind (**pain, symptom, concern**), where on the body, when it started, how bad (0–10), and optional: what makes it worse, what helps, what you've tried, notes, and habits that help or strain it. The app knows 12 kinds: Back pain, Neck or shoulder pain, Knee or joint pain, Headache, Eye strain, Acidity or stomach trouble, Cold or fever, Tiredness, Poor sleep, Stress or low mood, Hair fall, Skin or acne. Anything else is still tracked.

**Overview cards**
- **Tiles:** Active issues (and how many are improving), **Checked in today** (with a **Check in ›** shortcut), **Highest this week**, and **Plan changes running** (amber, with "N waiting for your OK", which jumps to the plan).
- **Plan for the next few days:** suggestions, each with reasons and two buttons (for example **Add habit / Not now**, **Yes, do it / Not now**, or **Apply all**). Types: lighten a habit, cut down a limit, do a little more of what helps, pause a habit, add a helpful habit, sick day, see a doctor. Changes last **5 days** and then **go back by themselves**; you can **End now**. Hidden suggestions can be shown again.
- **Each issue:** latest number and its meaning, a 14-day bar chart, the trend ("about 5 this week", "down from 6 to 4"), patterns from your own data ("4/10 on days you did Stretching, 6.5/10 otherwise"), details, a big **Check in** button, check-in history, and a ⋮ menu (**Edit, Mark as improving, Mark as resolved, Delete**).
- **Not medical advice:** when to see a doctor, and a red box: "Get help immediately for chest pain, trouble breathing or fainting."
- **Notes** (your check-in notes and day notes) and **Resolved** issues.

**The check-in sheet:** "How is it right now?" with big **0–10** buttons (None / Mild / Moderate / Severe), a line comparing with last time ("5 · Moderate. Same as your last check-in" or "2 better…"), a note, and the day (so you can log an earlier day). **Save check-in**.

**Safety rules (fixed in the app):** at **8 or more**, or **worsening three check-ins in a row**, the plan says **see a doctor first** and suggests **no new exercise**. These cannot be switched off. The app never diagnoses.

**Tour:** ⓘ → up to 6 steps.

---

### 6.7 Reports and values (Health → Reports and values)

**What it's for:** keep medical reports and the numbers from them, and watch them over time.

- **Add report:** title, type (blood test, prescription, scan…), date, doctor or lab, notes, linked health issues, **photos or PDFs** (up to **10 MB each**), and **values** (name, number, unit, normal low and high). The app remembers a value's unit and range from last time.
- **Add a value:** a measurement without a report, like blood pressure at home.
- **Tiles:** reports, values tracked, **out of range**, files.
- **Reports list:** each report with its files (tap to open in a new tab) and values marked **Low / Normal / High**.
- **Values over time:** each value's latest reading, change since last time, and a small chart.
- **Rules:** deleting a report deletes its files and values; values you added yourself stay. Everything is stored on this device and travels in backups. Out-of-range values also appear on the Health overview.

**Tour:** ⓘ → up to 5 steps.

---

### 6.8 Settings

| Card | What it does |
|---|---|
| **Account and sync** | Sign in with your email (a **Sign in** link arrives by email). Then shows **Synced · just now**, **Offline** or **Sync failed**, with **Sync now** and **Sign out** (keep the data here, or remove it from this device). The first time, if this device and the account both have data, it asks **which to keep**. See section 10b. |
| **Appearance** | Theme (**Sage** is the default, **Mono** is the other) and **Light / Dark / System** |
| **Back up and restore** | **Download backup**, **Restore** from a file (replaces what's on this device), **Reset to starter data**. Shows the last backup and a **Remind me every N days** choice. |
| **Your data** | A count of what's stored (habits, phases, check-ins…) and the starter data |
| **Demo data** | **Open demo data** switches to a separate database full of sample data, so you can look around safely. **Back to my data** returns. Your own data isn't touched. |
| **Day, time and units** | When your day starts (default **4 AM**), week starts on Monday or Sunday, time zone, and metric or imperial |
| **Install the app** | Add Dinik Diary to the home screen so it opens like an app, even offline |
| **Phase unlock rule** | The target %, the window in days, and the minimum logged days |

**Tour:** ⓘ → 7 steps.

---

### 6.9 More and Brand preview

- **More** (phones): the sheet with every page.
- **Brand preview** (`/brand`): a page that shows the colours, text styles and sample charts used everywhere. It is for the owner, to check a theme change.

---

## 7. The ⓘ help button and page tours

- Every page has an **icon-only ⓘ** (no word "Help"). On phones it is at the right end of the logo row; on a laptop it is at the top right of the page.
- Tapping it starts a **spotlight tour**: the page dims, one part is framed, and a card explains it with **Step 1 of 6**, progress dots, **Skip tour**, **Back**, **Next** and **Done**.
- The page scrolls to each part by itself. **Esc** ends the tour; the arrow keys move between steps.
- If a part isn't on screen (for example an empty card), its step is skipped.
- Tours exist for **Today (6), Habits (5), Activities (up to 6), Reports (up to 9), Phases (7), Health (up to 6), Reports and values (up to 5), Settings (6)**.

---

## 8. The starter data

These are the defaults loaded the first time you open the app. Nothing is fixed; you can change all of it.

### Phase 1 · Foundation (starts active): 11 habits
Wake up on time (by 07:30, 15 min grace) · Water first thing in the morning · **Water goal (3 L)** · Healthy breakfast · Bath · Brush teeth — morning · Brush teeth — night · Face wash — morning · Face wash — night · Daily steps (5,000) · In bed on time (by 23:30, 15 min grace)

### Phase 2 · Fitness and grooming (locked)
Workout or yoga (30 min) · Stretching (10 min) · Moisturiser and sunscreen · Hair care routine (3 times a week) · Floss · Protein with each meal (3) · No sugary drinks
*When it starts, Daily steps goes from 5,000 to 8,000.*

### Phase 3 · Sleep and mind (locked)
Enough sleep (7 h) · No phone 30 minutes before bed · Meditation or breathing (10 min) · Screen time limit (180 min) · Reels limit (30 min) · Fruits and vegetables · No late-night junk food

### Phase 4 · Work and growth (locked)
Top 3 priorities done · Learning time (60 min) · Work or job-search block (60 min) · Shutdown ritual · Journaling · Expenses logged · Plan tomorrow

### Phase 5 · Life and finishing touches (locked)
Call family · Quality time with partner · Hobby time (30 min) · Beard trim and nails (every 10 days) · Clean clothes ready · Posture check · Weekly weight check (Saturdays) · Read (20 min)

Lunch and dinner are **not** habits. You log them as activities under "Meals and food", so they appear on the timeline and in time allocation.

**Linked numbers:** Wake up ↔ wake time, In bed ↔ bed time, Daily steps ↔ steps, Water goal ↔ water, Enough sleep ↔ sleep hours, Screen time limit ↔ screen time, Reels limit ↔ reels minutes.

---

## 9. The rules in one place

- **A day runs from 4:00 AM to 4:00 AM.** Anything logged before 4 AM belongs to the day before. Time zone defaults to Asia/Kolkata.
- **Two numbers per habit per day:** `done` (target fully met) and `progress` (0–100%). Streaks use `done`; averages and phase unlocking use `progress`.
- **Time habits:** on time = done; up to the grace window late = 50%; later = missed.
- **Target history:** changing a target applies from today. Past days keep the target they had.
- **"N times a week" habits** are judged against the weekly quota, not each day.
- **Rest, Sick, Travel days and paused days** are skipped by streaks and by the phase window.
- **Phase ready** when the window is full, at least 10 days are logged, and the average reaches the target (80%). Defaults are editable in Settings.
- **Sleep** is worked out from last night's bed time to this morning's wake time.
- **Overlapping activities:** the shorter one keeps the shared time.
- **Health changes** last 5 days and revert themselves. Nothing changes without your OK. At 8/10 or worsening, see a doctor first.

---

## 10. Your data, privacy and offline use

- **Stored on your device first** in the browser's database (IndexedDB), so the app is fast and works offline. **Signing in** (Settings → Account and sync) also keeps a copy in your private Supabase account and syncs it to your other devices (section 10b). Without signing in, nothing leaves the device.
- **Two databases:** yours, and a separate **demo** one. Switching is in Settings.
- **Backup file** contains everything: habits, phases, check-ins, activities, metrics, health issues and reports (with their photos and PDFs). Older backups still restore.
- **Clearing browser data deletes this device's copy.** If you're signed in, sign in again and it all comes back; if not, it's gone, so back up now and then. The app reminds you after a set number of days (default 7).
- **Offline:** after the first visit every page opens without internet.
- **Installing:** Android Chrome → ⋮ → **Install app**; iPhone Safari → Share → **Add to Home Screen**.
- **Different devices share data only when signed in** with the same email.
- **Updates:** when new code is pushed to GitHub, the live app updates in 1–3 minutes and reaches an installed app the next time it's opened (sometimes after reopening it once more).

---

## 10b. Sign in and sync (Build Phase 15)

**Setting it up (done once, 2026-11-28):** a free Supabase project (Mumbai region). Its table and access rules are in `supabase/schema.sql` (run in Supabase's SQL Editor; safe to run again). The app reads two public values, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, from `.env.local` on the laptop (never committed) and from Vercel's Environment Variables (type **Config**). Without them the app works as before, on the device only. The Supabase **secret / service_role key and database password are never used** by the app and must never be put in the project.

**Signing in:** Settings → Account and sync → your email → **Send sign-in email** → tap **Sign in** in the email. No password. Free Supabase sends only a few sign-in emails per hour, and its email template can't be changed without your own email server, so the email is Supabase's standard "Your sign-in link".

**What syncs:** everything: phases, habits, targets, check-ins, day types, activities, categories, numbers, health issues and check-ins, reports and their values, settings (including the theme). Report photos and PDFs go to private file storage. The demo profile never syncs.

**When it syncs:** about 1.5 seconds after a change; immediately when another device changes something (live); when the app comes back online or to the front; and once a minute.

**How it stays consistent**
- Every change is saved on the device first. Each sync compares every record with its fingerprint from the last sync, so nothing is missed (bulk edits, restoring a backup, resetting, or the app closing mid-sync).
- **The newer edit wins**, on the device and in the cloud (the cloud refuses an older edit).
- **Deletes reach every device.** Deleting a habit also deletes its targets and check-ins everywhere, even ones another device logged in the meantime.
- **An edit beats a delete it didn't know about:** if one device deletes something while the other edits it, the edit survives (nothing is lost unseen).
- **Both devices log the same habit (or number) on the same day offline:** they settle on one entry, the newer. Two new habits with the same name keep both; the older gets a slightly different internal key.
- **First sign-in on a device:** if the account is empty, this device's data goes up. If this device has only the starter data, it takes the account's data. If both have real data, it asks: **Use my account's data** or **Use this device's data** (with a backup button first). Two sets of data are never mixed.
- **Restoring a backup or resetting while signed in** changes the account and every device too (Settings says so).
- **Sign out → keep data here:** signing in again later just carries on. **Sign out → remove data here:** this device goes back to the starter data; the account keeps everything.
- **Privacy:** row level security in the database means each person only ever reads or writes their own records; anonymous visitors get nothing.

**Code:** `src/data/sync/` (engine, table rules, fingerprints, the Supabase and in-memory clouds), `src/features/sync/` (the background runner), `src/features/settings/account-section.tsx` (the card), `src/stores/sync-store.ts` (status). The local database gained two bookkeeping tables in version 9 (not part of backups).

---

## 11. Technology and project layout

**Built with:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 and shadcn/ui, Dexie 4 (IndexedDB), Zod 4, TanStack Query, Zustand, Recharts, dnd-kit, Vitest and Playwright. Supabase (Postgres, Auth, Storage) for sign-in and sync. Hosted on Vercel; code on GitHub.

**Folders**
```
src/app/          pages (Today, habits, activities, reports, phases, health, settings, brand)
src/features/     one folder per page: its screens and parts
src/components/   shared parts: app shell, dashboard cards, action menus, the tour
src/lib/core/     the rules, as plain tested functions (scoring, streaks, readiness,
                  reports, insights, health advisor, lab values…)
src/data/         the database layer, data operations, backups, starter data, demo data
src/data/sync/    sync with Supabase (engine, rules, tests)
supabase/         the cloud table and access rules (schema.sql)
src/copy/en.ts    all text shown in the app (wording changes happen here)
src/brand/        app name, logo, icon colours
src/theme/        colour themes (Sage, Mono)
tests/e2e/        end-to-end tests (laptop and phone sizes)
```

**Design rules:** nothing hardcoded (names, colours and text come from config and tokens); every laptop page is a 12-column dashboard; phones use one column, bottom sheets and a bottom bar.

---

## 12. Tests

- **384 unit tests** cover the rules (scoring, streaks, readiness, reports, health advisor, database upgrades, backups) and sync (two and three devices sharing one in-memory cloud: edits, conflicts, deletes, offline, first sign-in, backups, report files).
- **160 end-to-end tests** click through the real app on a laptop-sized and a phone-sized screen (19 more are skipped on purpose because they only make sense on one of the two sizes). A setup step answers the first-run question once ("Start all"); every other test starts from that saved state. Sign-in tests never send a real email.
- Lint, formatting and type checks run clean.

---

## 13. What was decided along the way

- **Frontend and local data first, backend later.** (Data layer is built so moving to a database later is a swap, not a rewrite.)
- **No Telegram.** Day log and notifications will live in the app (2026-11-21).
- **Concerns became Health:** you only say what's wrong and 0–10; the app proposes; you approve.
- **Tabs on phones:** Today, Habits, Activities, Reports, More. Phases and Health live under More.
- **Water goal (3 L)** now starts in Phase 1; existing devices got it moved by a one-time database upgrade.
- **Habits can only be moved into unlocked phases.**
- **One logo row** on every phone page; no "‹ More" links (the bottom bar's More does that job).
- **Sync keeps the device first (2026-11-28):** data is saved on the device and synced in the background, instead of reading straight from the cloud, so the app stays fast and works offline. One generic cloud table holds every kind of record.
- **Start habits a few at a time:** a first-run picker for Phase 1 and a picker when enabling each phase; habits have a start date and earlier days never count (2026-11-22).

---

## 14. What's next

**Small items already agreed**
- Simplify **Your numbers** on Today: show a number only if it has no habit on your checklist (so Weight, Mood, Energy, and Screen time and Reels until Phase 3), rename it **Body and mood**, and show sleep as a small line.
- A **first-time "Want a quick tour?"** card on each page, with "Got it" (Today's is part of the first-run question).
- **Warnings that show only while editing** (for example "Counts from today; past days keep the old target").
- A **day-type chip** next to the date instead of the four-button card.
- **Settings → Take the tour** and a **Show tips** switch.
- A **Send feedback** link in Settings for testers.

**Bigger steps (from build-plan.md)**
1. ★ **Use it for 14 days** (now signed in, so the data is safe) and fix what annoys you.
2. **Phase 14.5, AI health advisor:** describe what's wrong in your own words; the AI suggests the plan using the same screens and the same safety rules.
3. ~~Phase 15, Supabase sync~~ **done** (section 10b).
4. **Phase 16, phone notifications** (web push on the installed app).
5. **Phase 17, reminders and scheduler:** 9:30 PM "How was your day?", per-habit reminders.
6. **Phases 18–19, Day log:** tell the AI about your day in the app; it ticks habits and adds activities, and you review what it understood.
7. **Phase 20, voice:** a mic button.
8. **Phase 21, AI coach:** weekly "focus for next week" suggestions.
9. **Phase 22, extras:** PDF export, share link, private photos, Google Fit / Health Connect.

---

## 15. Known notes

- A browser extension (for example one that adds `jf-ext-…` attributes to buttons) can make the browser console show a "hydration mismatch" warning. It is not an app bug; open the site in a private window to confirm.
- The Settings page's backup card can show the same kind of hydration warning in development, from the "last backup" line. It fixes itself and nothing looks wrong.
- Free Supabase projects **pause after a week with no use**. Daily use keeps it awake; if it ever pauses, open supabase.com and press **Restore** (the data is kept).
- Testers each get their own data; there is no way yet for you to see how they use the app. A feedback link is planned.

---

## 16. Running it

```
npm run dev        # the app on http://localhost:3000
npm run check      # lint, format check, types and unit tests
npm run e2e        # builds and runs the end-to-end tests (port 3100)
npm run preview    # a production build on http://localhost:3200
```

Pushing to the `main` branch on GitHub deploys the live site automatically.
