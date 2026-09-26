# 🚀 Beyond the Resume — HackMysuru 1.0 Phase 2

> **"Don't just claim your skills. Prove them."**  
> An evidence-backed technical hiring platform connecting developers and recruiters through verified technical assessments, code repository evidence, deterministic matching, and dynamic Skill Passports.

---

## 🌟 The Core Differentiator

Traditional platforms (LinkedIn, Indeed) rely primarily on subjective text claims on a resume. **Beyond the Resume** grounds technical hiring in verifiable evidence:

```text
Skills + Projects + Technical Assessments + Assessment Evidence + Skill Matching + Candidate Ranking = Skill Passport
```

### Complete Product Flow:
```text
DISCOVER → MATCH → CONNECT → ASSESS → VERIFY → PROVE → HIRE
```

---

## 🏗️ System Architecture

1. **Frontend Architecture**:
   - Modern React 19 + TypeScript on Vite.
   - Design System: Custom tokens, glassmorphism borders, electric violet/cyan accents (`#6366F1`, `#06B6D4`), verified emerald indicators (`#10B981`).
   - Integrated Monaco Editor (`@monaco-editor/react`) supporting JavaScript & Python coding challenges.
   - Proctoring & Telemetry engine tracking fullscreen exits, tab switching, and clipboard activity with humane review recommendations.

2. **Backend & Database Architecture**:
   - Supabase PostgreSQL with 19 normalized, secure tables.
   - Row Level Security (RLS) enabled on every exposed table.
   - Deterministic Matching Engine implementing weighted skill overlap, verified scores, and repository proof.
   - Deterministic Scoring Engine based on Correctness (50%), Efficiency (20%), Code Quality (15%), Test Coverage (10%), and Time Performance (5%).
   - Sandboxed execution abstraction with timeouts and memory caps.

3. **AI Agent Suite**:
   - **Agent 1 (Skill Matching)**: Produces transparent match rationales without altering deterministic scores.
   - **Agent 2 (Assessment Generator)**: Drafts coding problems tailored to target engineering roles for recruiter approval.
   - **Agent 3 (Evaluation Agent)**: Highlights technical strengths and observations from objective test outputs.
   - **Agent 4 (Integrity Analysis Agent)**: Analyzes telemetry signals into balanced human-review recommendations.

---

## 🗄️ Database Tables (Supabase PostgreSQL)

- `profiles` — Developer and Recruiter professional profiles
- `skills` — Standardized technical competencies (React, Python, SQL, DSA, etc.)
- `profile_skills` — Self-declared vs assessed levels & verification status
- `projects` — Code repositories and live application evidence
- `project_skills` — Demonstrable skills mapped to project code
- `companies` — Verified employer profiles
- `jobs` — Opportunities with weighted required skills
- `job_skills` — Skill weight distribution (validating to 100%)
- `applications` — Multi-stage application lifecycle tracker
- `job_matches` — Transparent deterministic compatibility scores
- `notifications` — In-app notification center
- `assessments` — Technical coding assessments
- `assessment_questions` — Coding problems with starter code & test suites
- `assessment_invitations` — Candidate assessment access tokens
- `assessment_attempts` — Candidate assessment sessions
- `submissions` — Code submissions and test execution results
- `integrity_events` — Timestamped telemetry audit logs
- `assessment_scores` — Objective score breakdowns
- `skill_evidence` — Verified evidence records powering the Skill Passport

---

## 🚀 Quick Setup & Run Locally

### 1. Prerequisites
- Node.js v18+ (tested on Node v24)
- npm v9+

### 2. Installation
```bash
git clone https://github.com/dev-nithin14/phase-2.git
cd phase-2
npm install
```

### 3. Environment Variables
Create `.env` based on `.env.example`:
```env
VITE_SUPABASE_URL=https://ogqxjsbzwmrxnitewvdx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing the Complete Hackathon Flow

The platform includes a **Hackathon Quick-Switch Test Bar** at the top of the screen:

1. **Candidate Discovery & Match**:
   - Explore jobs at `/jobs`.
   - See your live deterministic match score (e.g., **91% Match** for Samarth M N on *Senior Frontend Developer*).
   - Click **View & Apply** to see the transparent skill breakdown and AI Agent 1 rationale.

2. **Skill Passport Credential**:
   - Navigate to `/candidate/passport`.
   - Inspect the **Verified Skill Passport** with verified assessment scores (React 91/100, JavaScript 88/100), repository links, and print view.

3. **Take a Coding Challenge**:
   - Navigate to `/candidate/assessments` and launch a challenge.
   - Review transparent privacy disclosures and consent.
   - Write code in the **Monaco Editor** in JavaScript or Python.
   - Run tests against the sandbox runner.
   - Submit to receive a deterministic breakdown (Correctness, Efficiency, Quality, Coverage, Time).

4. **Recruiter Command Center**:
   - Click **Recruiter View** in the top test bar.
   - Visit `/recruiter/dashboard` to see active jobs, candidate rankings, and the live integrity telemetry audit stream.
   - Inspect job-specific rankings at `/recruiter/jobs/job_frontend_cloudscale/candidates`.
   - Shortlist candidates, invite them to assessments, or move them directly to interview.
