import React from 'react';
import { VerificationStatus, IntegrityStatus } from '../../types';
import { ShieldCheck, AlertTriangle, AlertCircle, FileCheck, Award, CheckCircle } from 'lucide-react';

interface VerificationBadgeProps {
  status: VerificationStatus;
  score?: number;
  showScore?: boolean;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({ status, score, showScore = true }) => {
  switch (status) {
    case 'FULLY_VERIFIED':
      return (
        <span className="badge badge-verified" title="Validated by both verified technical assessment and project evidence">
          <ShieldCheck size={12} />
          Fully Verified {showScore && score ? `(${score}/100)` : ''}
        </span>
      );
    case 'ASSESSMENT_BACKED':
      return (
        <span className="badge badge-verified" title="Validated through platform technical assessment">
          <Award size={12} />
          Assessment-Backed {showScore && score ? `(${score}/100)` : ''}
        </span>
      );
    case 'EVIDENCE_BACKED':
      return (
        <span className="badge badge-accent" title="Demonstrated in public project code repository">
          <FileCheck size={12} />
          Evidence-Backed
        </span>
      );
    case 'LINK_VERIFIED':
      return (
        <span className="badge badge-neutral" title="Project repository link active and verified">
          <CheckCircle size={12} />
          Link-Verified
        </span>
      );
    case 'SELF_DECLARED':
    default:
      return (
        <span className="badge badge-neutral" title="Declared by candidate; unverified assessment">
          Self-Declared
        </span>
      );
  }
};

interface IntegrityBadgeProps {
  status: IntegrityStatus;
}

export const IntegrityBadge: React.FC<IntegrityBadgeProps> = ({ status }) => {
  switch (status) {
    case 'VERIFIED':
    case 'NORMAL':
      return (
        <span className="badge badge-verified" title="Assessment integrity appears consistent based on collected signals.">
          <ShieldCheck size={12} />
          VERIFIED
        </span>
      );
    case 'MINOR_FLAGS':
    case 'REVIEW_REQUIRED':
      return (
        <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: '#f59e0b' }} title="Assessment requires recruiter review due to integrity signals.">
          <AlertTriangle size={12} />
          REVIEW REQUIRED
        </span>
      );
    case 'HIGH_RISK':
      return (
        <span className="badge badge-danger" title="Multiple high-priority integrity signals detected.">
          <AlertCircle size={12} />
          HIGH RISK
        </span>
      );
    default:
      return (
        <span className="badge badge-neutral">
          {status}
        </span>
      );
  }
};
