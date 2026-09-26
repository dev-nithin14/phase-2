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
    case 'NORMAL':
      return (
        <span className="badge badge-verified" title="Clean telemetry stream">
          <ShieldCheck size={12} />
          Normal
        </span>
      );
    case 'MINOR_FLAGS':
      return (
        <span className="badge badge-warning" title="Minor ambient focus change or dual monitor shift">
          <AlertTriangle size={12} />
          Minor Flags
        </span>
      );
    case 'REVIEW_REQUIRED':
      return (
        <span className="badge badge-danger" title="Multiple focus/window shifts recorded; human review recommended">
          <AlertCircle size={12} />
          Review Required
        </span>
      );
  }
};
