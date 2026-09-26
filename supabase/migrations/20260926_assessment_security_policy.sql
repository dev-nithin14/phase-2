-- Add persisted assessment security policy and candidate explain-back response.
-- Existing assessments and attempts retain their data and receive safe defaults.
ALTER TABLE public.assessments
    ADD COLUMN IF NOT EXISTS security_policy JSONB NOT NULL DEFAULT '{
        "laptop_camera": false,
        "microphone": false,
        "secondary_phone_camera": false,
        "fullscreen": "OPTIONAL",
        "screen_evidence": "DISABLED",
        "screen_evidence_interval_minutes": null,
        "browser_integrity_monitoring": false,
        "network_monitoring": false,
        "explain_back": false,
        "code_similarity": false
    }'::jsonb;

ALTER TABLE public.assessment_attempts
    ADD COLUMN IF NOT EXISTS explain_back_response TEXT;