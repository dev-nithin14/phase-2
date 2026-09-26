import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { JobsPage } from './pages/jobs/JobsPage';
import { JobDetailPage } from './pages/jobs/JobDetailPage';

// Candidate Portal
import { CandidateDashboard } from './pages/candidate/CandidateDashboard';
import { CandidatePassportPage } from './pages/candidate/CandidatePassportPage';
import { CandidateProfilePage } from './pages/candidate/CandidateProfilePage';
import { CandidateSkillsPage } from './pages/candidate/CandidateSkillsPage';
import { CandidateProjectsPage } from './pages/candidate/CandidateProjectsPage';
import { CandidateApplicationsPage } from './pages/candidate/CandidateApplicationsPage';
import { CandidateAssessmentsPage } from './pages/candidate/CandidateAssessmentsPage';

// Recruiter Portal
import { RecruiterDashboard } from './pages/recruiter/RecruiterDashboard';
import { RecruiterJobCandidatesPage } from './pages/recruiter/RecruiterJobCandidatesPage';
import { CandidateDetailViewPage } from './pages/recruiter/CandidateDetailViewPage';
import { CreateJobPage } from './pages/recruiter/CreateJobPage';
import { RecruiterAssessmentsPage } from './pages/recruiter/RecruiterAssessmentsPage';
import { RecruiterCompanyPage } from './pages/recruiter/RecruiterCompanyPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          <Navbar />
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-otp" element={<LoginPage />} />
            <Route path="/onboarding" element={<CandidateProfilePage />} />

            {/* Jobs */}
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />

            {/* Candidate Portal */}
            <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
            <Route path="/candidate/passport" element={<CandidatePassportPage />} />
            <Route path="/candidate/profile" element={<CandidateProfilePage />} />
            <Route path="/candidate/skills" element={<CandidateSkillsPage />} />
            <Route path="/candidate/projects" element={<CandidateProjectsPage />} />
            <Route path="/candidate/applications" element={<CandidateApplicationsPage />} />
            <Route path="/candidate/assessments" element={<CandidateAssessmentsPage />} />
            <Route path="/candidate/assessments/:id" element={<CandidateAssessmentsPage />} />
            <Route path="/candidate/notifications" element={<CandidateDashboard />} />

            {/* Recruiter Portal */}
            <Route path="/recruiter/dashboard" element={<RecruiterDashboard />} />
            <Route path="/recruiter/company" element={<RecruiterCompanyPage />} />
            <Route path="/recruiter/jobs" element={<RecruiterDashboard />} />
            <Route path="/recruiter/jobs/new" element={<CreateJobPage />} />
            <Route path="/recruiter/jobs/:id" element={<JobDetailPage />} />
            <Route path="/recruiter/jobs/:id/candidates" element={<RecruiterJobCandidatesPage />} />
            <Route path="/recruiter/candidates/:id" element={<CandidateDetailViewPage />} />
            <Route path="/recruiter/assessments" element={<RecruiterAssessmentsPage />} />
            <Route path="/recruiter/assessments/new" element={<RecruiterAssessmentsPage />} />
            <Route path="/recruiter/assessments/:id" element={<RecruiterAssessmentsPage />} />
            <Route path="/recruiter/applications" element={<RecruiterDashboard />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
