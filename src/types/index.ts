export type UserRole = 'JOB_SEEKER' | 'RECRUITER' | 'ADMIN';

export type VerificationStatus = 
  | 'SELF_DECLARED' 
  | 'LINK_VERIFIED' 
  | 'EVIDENCE_BACKED' 
  | 'ASSESSMENT_BACKED' 
  | 'FULLY_VERIFIED';

export type ProjectStatus = 
  | 'ADDED' 
  | 'LINK_VERIFIED' 
  | 'REPOSITORY_CONNECTED' 
  | 'EVIDENCE_REVIEWED';

export type ApplicationStatus = 
  | 'APPLIED' 
  | 'REVIEWING' 
  | 'SHORTLISTED' 
  | 'ASSESSMENT_INVITED' 
  | 'ASSESSMENT_COMPLETED' 
  | 'INTERVIEW' 
  | 'SELECTED' 
  | 'REJECTED' 
  | 'WITHDRAWN';

export type IntegrityStatus = 'NORMAL' | 'MINOR_FLAGS' | 'REVIEW_REQUIRED';

export type SkillCategory = 
  | 'FRONTEND' 
  | 'BACKEND' 
  | 'DATABASE' 
  | 'DEVOPS' 
  | 'CORE_CS' 
  | 'AI_ML' 
  | 'ENGINEERING';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  bio?: string;
  phone?: string;
  location?: string;
  education?: string;
  experience_years: number;
  availability: 'IMMEDIATELY' | '15_DAYS' | '1_MONTH' | 'OPEN';
  preferred_job_type: 'FULL_TIME' | 'CONTRACT' | 'INTERNSHIP';
  preferred_location: 'REMOTE' | 'HYBRID' | 'ONSITE';
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  certifications?: Array<{ name: string; issuer: string; year: number; link?: string }>;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
  icon?: string;
  created_at?: string;
}

export interface ProfileSkill {
  id: string;
  profile_id: string;
  skill_id: string;
  skill?: Skill;
  self_declared_level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  assessed_score?: number; // 0-100
  project_count: number;
  verification_status: VerificationStatus;
  verified_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  profile_id: string;
  title: string;
  description: string;
  github_url?: string;
  live_url?: string;
  screenshots?: string[];
  candidate_role?: string;
  team_size: number;
  completion_date?: string;
  verification_status: ProjectStatus;
  skills?: Skill[];
  created_at?: string;
  updated_at?: string;
}

export interface Company {
  id: string;
  recruiter_id: string;
  name: string;
  logo_url?: string;
  description?: string;
  industry?: string;
  location?: string;
  website?: string;
  company_size?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JobSkill {
  id: string;
  job_id: string;
  skill_id: string;
  skill?: Skill;
  weight: number; // 0-100 percentage
  is_required: boolean;
  min_acceptable_score: number;
}

export interface Job {
  id: string;
  company_id: string;
  recruiter_id: string;
  company?: Company;
  title: string;
  description: string;
  employment_type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';
  location: string;
  work_mode: 'REMOTE' | 'HYBRID' | 'ONSITE';
  min_experience: number;
  max_experience?: number;
  min_salary?: number;
  max_salary?: number;
  salary_currency: string;
  deadline?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  assessment_required: boolean;
  skills?: JobSkill[];
  created_at: string;
  updated_at?: string;
}

export interface JobMatch {
  id: string;
  job_id: string;
  candidate_id: string;
  candidate?: Profile;
  job?: Job;
  match_score: number; // 0-100
  skill_breakdown: Record<string, {
    weight: number;
    candidate_score: number;
    weighted_contribution: number;
    is_assessed: boolean;
    verification_status: VerificationStatus;
  }>;
  evidence_summary?: string;
  calculated_at: string;
}

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  job?: Job;
  candidate?: Profile;
  status: ApplicationStatus;
  match_score: number;
  applied_at: string;
  updated_at?: string;
  invitations?: AssessmentInvitation[];
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'MATCH' | 'APPLICATION_UPDATE' | 'ASSESSMENT_INVITE' | 'ASSESSMENT_RESULT' | 'SYSTEM';
  related_job_id?: string;
  related_application_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  explanation?: string;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  skill_id?: string;
  skill?: Skill;
  title: string;
  statement: string;
  question_type: 'MCQ' | 'CODING';
  options: Array<{ id: string; text: string }>;
  constraints?: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  starter_code: {
    javascript: string;
    python: string;
  };
  test_cases: TestCase[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  points: number;
  time_limit_sec: number;
  memory_limit_mb: number;
  order_index: number;
}

export type ScreenEvidencePolicy = 'DISABLED' | 'EVERY_5_MINUTES' | 'EVERY_10_MINUTES' | 'CUSTOM_INTERVAL';

export interface AssessmentSecurityPolicy {
  laptop_camera: boolean;
  microphone: boolean;
  secondary_phone_camera: boolean;
  fullscreen: 'REQUIRED' | 'OPTIONAL';
  screen_evidence: ScreenEvidencePolicy;
  screen_evidence_interval_minutes: number | null;
  browser_integrity_monitoring: boolean;
  network_monitoring: boolean;
  explain_back: boolean;
  code_similarity: boolean;
}

export const DEFAULT_ASSESSMENT_SECURITY_POLICY: AssessmentSecurityPolicy = {
  laptop_camera: false,
  microphone: false,
  secondary_phone_camera: false,
  fullscreen: 'OPTIONAL',
  screen_evidence: 'DISABLED',
  screen_evidence_interval_minutes: null,
  browser_integrity_monitoring: false,
  network_monitoring: false,
  explain_back: false,
  code_similarity: false,
};

export interface Assessment {
  id: string;
  job_id?: string;
  job?: Job;
  creator_id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  total_points: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  security_policy?: AssessmentSecurityPolicy;
  question_count?: number;
  questions?: AssessmentQuestion[];
  created_at: string;
  updated_at?: string;
}

export interface AssessmentInvitation {
  id: string;
  assessment_id: string;
  assessment?: Assessment;
  application_id?: string;
  application?: Application;
  candidate_id: string;
  candidate?: Profile;
  invited_by: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'COMPLETED';
  expires_at?: string;
  created_at: string;
}

export interface TestExecutionResult {
  test_id: string;
  input: string;
  expected_output: string;
  actual_output: string;
  passed: boolean;
  execution_time_ms: number;
  error?: string;
  is_hidden: boolean;
}

export interface Submission {
  id: string;
  attempt_id: string;
  question_id: string;
  language: 'javascript' | 'python' | 'mcq';
  code: string;
  tests_passed: number;
  total_tests: number;
  execution_time_ms: number;
  memory_used_mb: number;
  score: number;
  test_results: TestExecutionResult[];
  submitted_at: string;
}

export interface IntegrityEvent {
  id: string;
  attempt_id: string;
  event_type: 
    | 'FULLSCREEN_EXIT' 
    | 'TAB_SWITCH' 
    | 'COPY_ATTEMPT' 
    | 'PASTE_ATTEMPT' 
    | 'VISIBILITY_HIDDEN' 
    | 'CAMERA_DISABLED' 
    | 'MIC_DISABLED' 
    | 'MULTIPLE_FACES' 
    | 'NO_FACE'
    | 'NETWORK_OFFLINE'
    | 'NETWORK_ONLINE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface ScoreBreakdown {
  correctness: number;      // 50%
  efficiency: number;       // 20%
  code_quality: number;     // 15%
  test_coverage: number;    // 10%
  time_performance: number; // 5%
  total_score: number;      // 0-100
}

export interface AssessmentAttempt {
  id: string;
  assessment_id: string;
  assessment?: Assessment;
  invitation_id?: string;
  candidate_id: string;
  candidate?: Profile;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'EVALUATED' | 'FLAGGED';
  started_at: string;
  submitted_at?: string;
  explain_back_response?: string | null;
  camera_enabled: boolean;
  mic_enabled: boolean;
  fullscreen_confirmed: boolean;
  integrity_status: IntegrityStatus;
  integrity_summary: {
    tab_switches: number;
    fullscreen_exits: number;
    copy_attempts: number;
    paste_attempts: number;
    camera_dropouts: number;
    total_flags: number;
    status: IntegrityStatus;
  };
  technical_score?: number;
  score_breakdown?: ScoreBreakdown & {
    skill_breakdown?: Array<{
      skill_id: string;
      skill_name: string;
      earned: number;
      maximum: number;
      percentage: number;
    }>;
  };
  submissions?: Submission[];
  integrity_events?: IntegrityEvent[];
}

export interface SkillEvidence {
  id: string;
  profile_id: string;
  skill_id: string;
  skill?: Skill;
  evidence_type: 'ASSESSMENT' | 'PROJECT' | 'WORK_EXPERIENCE';
  source_id?: string;
  score?: number;
  evidence_details: {
    source_name: string;
    metrics: string;
    verified_on: string;
    url?: string;
  };
  verified_at: string;
}

export interface SkillPassport {
  candidate: Profile;
  overall_rating: number; // 0-100 aggregate
  verified_skills_count: number;
  total_assessments_taken: number;
  total_projects_verified: number;
  skills: Array<{
    name: string;
    category: SkillCategory;
    self_level: string;
    assessed_score?: number;
    project_count: number;
    verification_status: VerificationStatus;
    evidence_sources: Array<{
      type: 'ASSESSMENT' | 'PROJECT';
      title: string;
      score?: number;
      date: string;
    }>;
  }>;
  assessment_history: Array<{
    title: string;
    job_title?: string;
    score: number;
    date: string;
    integrity_status: IntegrityStatus;
  }>;
}
