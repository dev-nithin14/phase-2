import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';

// Pages
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
import { CandidateAssessmentWorkspacePage } from './pages/candidate/CandidateAssessmentWorkspacePage';
import { PhoneCameraPage } from './pages/candidate/PhoneCameraPage';

// Recruiter Portal
import { RecruiterDashboard } from './pages/recruiter/RecruiterDashboard';
import { RecruiterJobCandidatesPage } from './pages/recruiter/RecruiterJobCandidatesPage';
import { CandidateDetailViewPage } from './pages/recruiter/CandidateDetailViewPage';
import { CreateJobPage } from './pages/recruiter/CreateJobPage';
import { RecruiterAssessmentBuilderPage } from './pages/recruiter/RecruiterAssessmentBuilderPage';
import { RecruiterAssessmentResultsPage } from './pages/recruiter/RecruiterAssessmentResultsPage';
import { RecruiterCompanyPage } from './pages/recruiter/RecruiterCompanyPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';

const workspacePath = (role?: string) => {
  if (role === 'RECRUITER') return '/recruiter/dashboard';
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'JOB_SEEKER') return '/candidate/dashboard';
  return '/candidate/dashboard';
};

const AuthEntry: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="main-content">Restoring your session...</div>;
  return user ? <Navigate to={workspacePath(user.role)} replace /> : <>{children}</>;
};

const ProtectedRoute: React.FC<{ role: 'JOB_SEEKER' | 'RECRUITER' | 'ADMIN'; children: React.ReactNode }> = ({ role, children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="main-content">Restoring your session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={workspacePath(user.role)} replace />;
  return <>{children}</>;
};

const HomeRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="main-content">Restoring your session...</div>;
  return <Navigate to={user ? workspacePath(user.role) : '/login'} replace />;
};

const UnsupportedRoleRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="main-content">Restoring your session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={workspacePath(user.role)} replace />;
};

const ConditionalFooter: React.FC = () => {
  const { pathname } = useLocation();
  if (pathname === '/login' || pathname === '/register' || pathname === '/verify-otp' || pathname === '/assessment/phone-camera') return null;
  return <Footer />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          <Navbar />
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/unsupported-role" element={<UnsupportedRoleRoute />} />
            <Route path="/login" element={<AuthEntry><LoginPage /></AuthEntry>} />
            <Route path="/register" element={<AuthEntry><RegisterPage /></AuthEntry>} />
            <Route path="/verify-otp" element={<AuthEntry><LoginPage /></AuthEntry>} />
            <Route path="/assessment/phone-camera" element={<PhoneCameraPage />} />
            <Route path="/admin/dashboard" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute role="JOB_SEEKER"><CandidateProfilePage /></ProtectedRoute>} />

            {/* Candidate job discovery */}
            <Route path="/jobs" element={<ProtectedRoute role="JOB_SEEKER"><JobsPage /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute role="JOB_SEEKER"><JobDetailPage /></ProtectedRoute>} />

            {/* Candidate Portal */}
            <Route path="/candidate/dashboard" element={<ProtectedRoute role="JOB_SEEKER"><CandidateDashboard /></ProtectedRoute>} />
            <Route path="/candidate/passport" element={<ProtectedRoute role="JOB_SEEKER"><CandidatePassportPage /></ProtectedRoute>} />
            <Route path="/candidate/profile" element={<ProtectedRoute role="JOB_SEEKER"><CandidateProfilePage /></ProtectedRoute>} />
            <Route path="/candidate/skills" element={<ProtectedRoute role="JOB_SEEKER"><CandidateSkillsPage /></ProtectedRoute>} />
            <Route path="/candidate/projects" element={<ProtectedRoute role="JOB_SEEKER"><CandidateProjectsPage /></ProtectedRoute>} />
            <Route path="/candidate/applications" element={<ProtectedRoute role="JOB_SEEKER"><CandidateApplicationsPage /></ProtectedRoute>} />
            <Route path="/candidate/assessments" element={<ProtectedRoute role="JOB_SEEKER"><CandidateAssessmentWorkspacePage /></ProtectedRoute>} />
            <Route path="/candidate/assessments/:id" element={<ProtectedRoute role="JOB_SEEKER"><CandidateAssessmentWorkspacePage /></ProtectedRoute>} />
            <Route path="/candidate/notifications" element={<ProtectedRoute role="JOB_SEEKER"><CandidateDashboard /></ProtectedRoute>} />

            {/* Recruiter Portal */}
            <Route path="/recruiter/dashboard" element={<ProtectedRoute role="RECRUITER"><RecruiterDashboard /></ProtectedRoute>} />
            <Route path="/recruiter/company" element={<ProtectedRoute role="RECRUITER"><RecruiterCompanyPage /></ProtectedRoute>} />
            <Route path="/recruiter/jobs" element={<ProtectedRoute role="RECRUITER"><RecruiterDashboard /></ProtectedRoute>} />
            <Route path="/recruiter/jobs/new" element={<ProtectedRoute role="RECRUITER"><CreateJobPage /></ProtectedRoute>} />
            <Route path="/recruiter/jobs/:id" element={<ProtectedRoute role="RECRUITER"><JobDetailPage /></ProtectedRoute>} />
            <Route path="/recruiter/jobs/:id/candidates" element={<ProtectedRoute role="RECRUITER"><RecruiterJobCandidatesPage /></ProtectedRoute>} />
            <Route path="/recruiter/candidates/:id" element={<ProtectedRoute role="RECRUITER"><CandidateDetailViewPage /></ProtectedRoute>} />
            <Route path="/recruiter/assessments" element={<ProtectedRoute role="RECRUITER"><RecruiterAssessmentBuilderPage /></ProtectedRoute>} />
            <Route path="/recruiter/assessments/new" element={<ProtectedRoute role="RECRUITER"><RecruiterAssessmentBuilderPage /></ProtectedRoute>} />
            <Route path="/recruiter/assessments/create" element={<ProtectedRoute role="RECRUITER"><RecruiterAssessmentBuilderPage /></ProtectedRoute>} />
            <Route path="/recruiter/assessments/ai" element={<ProtectedRoute role="RECRUITER"><RecruiterAssessmentBuilderPage /></ProtectedRoute>} />
            <Route path="/recruiter/assessments/:id/results" element={<ProtectedRoute role="RECRUITER"><RecruiterAssessmentResultsPage /></ProtectedRoute>} />
            <Route path="/recruiter/assessments/:id" element={<ProtectedRoute role="RECRUITER"><RecruiterAssessmentBuilderPage /></ProtectedRoute>} />
            <Route path="/recruiter/applications" element={<ProtectedRoute role="RECRUITER"><RecruiterDashboard /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ConditionalFooter />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
