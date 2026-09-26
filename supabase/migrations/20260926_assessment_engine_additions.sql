-- Additive assessment-engine support. Existing assessment records are preserved.
ALTER TABLE public.assessment_questions
    ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'CODING',
    ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'assessment_questions_question_type_check'
    ) THEN
        ALTER TABLE public.assessment_questions
            ADD CONSTRAINT assessment_questions_question_type_check
            CHECK (question_type IN ('MCQ', 'CODING'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.assessment_question_keys (
    question_id UUID PRIMARY KEY REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    correct_option TEXT,
    hidden_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assessment_question_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'assessment_question_keys_recruiter_access'
          AND tablename = 'assessment_question_keys'
    ) THEN
        CREATE POLICY assessment_question_keys_recruiter_access
        ON public.assessment_question_keys
        FOR ALL
        USING (
            EXISTS (
                SELECT 1
                FROM public.assessment_questions q
                JOIN public.assessments a ON a.id = q.assessment_id
                WHERE q.id = assessment_question_keys.question_id
                  AND a.creator_id = auth.uid()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1
                FROM public.assessment_questions q
                JOIN public.assessments a ON a.id = q.assessment_id
                WHERE q.id = assessment_question_keys.question_id
                  AND a.creator_id = auth.uid()
            )
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.submit_assessment_attempt(p_attempt_id UUID, p_answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    attempt_row public.assessment_attempts%ROWTYPE;
    assessment_row public.assessments%ROWTYPE;
    question_row RECORD;
    selected_option TEXT;
    expected_option TEXT;
    question_score NUMERIC;
    maximum_score NUMERIC := 0;
    earned_score NUMERIC := 0;
    skill_rows JSONB := '[]'::jsonb;
    final_score NUMERIC;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'JOB_SEEKER') THEN
        RAISE EXCEPTION 'A candidate profile is required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO attempt_row
    FROM public.assessment_attempts
    WHERE id = p_attempt_id AND candidate_id = auth.uid() AND status = 'IN_PROGRESS'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'An active assessment attempt was not found.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO assessment_row
    FROM public.assessments
    WHERE id = attempt_row.assessment_id AND status = 'PUBLISHED';
    IF NOT FOUND OR NOT EXISTS (
        SELECT 1 FROM public.assessment_invitations
        WHERE assessment_id = attempt_row.assessment_id
          AND candidate_id = auth.uid()
          AND status IN ('PENDING', 'ACCEPTED')
    ) THEN
        RAISE EXCEPTION 'Candidate is not eligible for this published assessment.' USING ERRCODE = '42501';
    END IF;

    FOR question_row IN
        SELECT q.id, q.skill_id, q.question_type, q.points, s.name AS skill_name
        FROM public.assessment_questions q
        LEFT JOIN public.skills s ON s.id = q.skill_id
        WHERE q.assessment_id = assessment_row.id
        ORDER BY q.order_index
    LOOP
        maximum_score := maximum_score + question_row.points;
        IF question_row.question_type = 'MCQ' THEN
            selected_option := p_answers ->> question_row.id::text;
            SELECT correct_option INTO expected_option
            FROM public.assessment_question_keys
            WHERE question_id = question_row.id;
            IF expected_option IS NULL THEN
                RAISE EXCEPTION 'Question % has no answer key.', question_row.id;
            END IF;
            question_score := CASE WHEN selected_option = expected_option THEN question_row.points ELSE 0 END;
            UPDATE public.submissions
            SET code = COALESCE(selected_option, ''),
                tests_passed = CASE WHEN question_score > 0 THEN 1 ELSE 0 END,
                total_tests = 1,
                score = question_score,
                submitted_at = now()
            WHERE attempt_id = attempt_row.id AND question_id = question_row.id AND language = 'mcq';
            IF NOT FOUND THEN
                INSERT INTO public.submissions (attempt_id, question_id, language, code, tests_passed, total_tests, score, test_results)
                VALUES (attempt_row.id, question_row.id, 'mcq', COALESCE(selected_option, ''),
                        CASE WHEN question_score > 0 THEN 1 ELSE 0 END, 1, question_score, '[]'::jsonb);
            END IF;
        ELSE
            SELECT COALESCE(MIN(score), 0) INTO question_score
            FROM public.submissions
            WHERE attempt_id = attempt_row.id AND question_id = question_row.id AND language <> 'mcq';
            question_score := LEAST(question_row.points, question_score);
        END IF;
        earned_score := earned_score + question_score;
    END LOOP;

    final_score := CASE WHEN maximum_score > 0 THEN ROUND(earned_score / maximum_score * 100) ELSE 0 END;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'skill_id', grouped.skill_id,
        'skill_name', COALESCE(grouped.skill_name, 'Unassigned'),
        'earned', grouped.earned,
        'maximum', grouped.maximum,
        'percentage', CASE WHEN grouped.maximum > 0 THEN ROUND(grouped.earned / grouped.maximum * 100) ELSE 0 END
    )), '[]'::jsonb)
    INTO skill_rows
    FROM (
        SELECT q.skill_id, s.name AS skill_name, SUM(
            CASE
                WHEN q.question_type = 'MCQ' AND aqk.correct_option = p_answers ->> q.id::text THEN q.points
                WHEN q.question_type = 'CODING' THEN LEAST(q.points, COALESCE((
                    SELECT MIN(sub.score) FROM public.submissions sub
                    WHERE sub.attempt_id = attempt_row.id AND sub.question_id = q.id AND sub.language <> 'mcq'
                ), 0))
                ELSE 0
            END
        ) AS earned,
        SUM(q.points) AS maximum
        FROM public.assessment_questions q
        LEFT JOIN public.skills s ON s.id = q.skill_id
        LEFT JOIN public.assessment_question_keys aqk ON aqk.question_id = q.id
        WHERE q.assessment_id = assessment_row.id
        GROUP BY q.skill_id, s.name
    ) grouped;

    UPDATE public.assessment_attempts
    SET status = 'EVALUATED',
        submitted_at = now(),
        technical_score = final_score,
        score_breakdown = jsonb_build_object(
            'correctness', final_score,
            'efficiency', 0,
            'code_quality', 0,
            'test_coverage', 0,
            'time_performance', 0,
            'total_score', final_score,
            'skill_breakdown', skill_rows
        )
    WHERE id = attempt_row.id;

    UPDATE public.assessment_invitations
    SET status = 'COMPLETED'
    WHERE assessment_id = assessment_row.id AND candidate_id = auth.uid();

    UPDATE public.applications
    SET status = 'ASSESSMENT_COMPLETED', updated_at = now()
    WHERE candidate_id = auth.uid() AND job_id = assessment_row.job_id;

    INSERT INTO public.assessment_scores (
        attempt_id, overall_score, correctness_score, efficiency_score,
        quality_score, test_coverage_score, time_performance_score, details
    ) VALUES (
        attempt_row.id, final_score, final_score, 0, 0, 0, 0,
        jsonb_build_object('skill_breakdown', skill_rows)
    );

    INSERT INTO public.skill_evidence (profile_id, skill_id, evidence_type, source_id, score, evidence_details)
        SELECT auth.uid(), (skill.value->>'skill_id')::uuid, 'ASSESSMENT', assessment_row.id,
            (skill.value->>'percentage')::numeric,
            jsonb_build_object('assessment_title', assessment_row.title, 'earned', skill.value->'earned', 'maximum', skill.value->'maximum')
    FROM jsonb_array_elements(skill_rows) AS skill(value)
    WHERE NULLIF(skill.value->>'skill_id', 'unassigned') IS NOT NULL;

    RETURN jsonb_build_object(
        'attempt_id', attempt_row.id,
        'score', final_score,
        'maximum', maximum_score,
        'earned', earned_score,
        'skill_breakdown', skill_rows
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_assessment_attempt(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_assessment_attempt(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_job_assessment(p_assessment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    assessment_row public.assessments%ROWTYPE;
    question_count INTEGER;
    total_marks INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
    END IF;

    SELECT a.* INTO assessment_row
    FROM public.assessments a
        JOIN public.jobs j ON j.id = a.job_id
        JOIN public.profiles p ON p.id = a.creator_id
    WHERE a.id = p_assessment_id
      AND a.creator_id = auth.uid()
      AND j.recruiter_id = auth.uid()
            AND p.role = 'RECRUITER'
      AND a.status = 'DRAFT'
    FOR UPDATE OF a;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draft assessment or owned job was not found.' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*), COALESCE(SUM(points), 0)::INTEGER
    INTO question_count, total_marks
    FROM public.assessment_questions
    WHERE assessment_id = assessment_row.id;
    IF question_count = 0 THEN
        RAISE EXCEPTION 'Add at least one question before publishing.';
    END IF;

    UPDATE public.assessments
    SET status = 'PUBLISHED', total_points = total_marks, updated_at = now()
    WHERE id = assessment_row.id;

    INSERT INTO public.assessment_invitations (assessment_id, application_id, candidate_id, invited_by, status)
    SELECT assessment_row.id, application.id, application.candidate_id, auth.uid(), 'PENDING'
    FROM public.applications application
    WHERE application.job_id = assessment_row.job_id
      AND NOT EXISTS (
          SELECT 1 FROM public.assessment_invitations existing
          WHERE existing.assessment_id = assessment_row.id
            AND existing.candidate_id = application.candidate_id
      );

        UPDATE public.applications
        SET status = 'ASSESSMENT_INVITED', updated_at = now()
        WHERE job_id = assessment_row.job_id
        AND EXISTS (
            SELECT 1 FROM public.assessment_invitations invitation
            WHERE invitation.assessment_id = assessment_row.id
            AND invitation.application_id = applications.id
            AND invitation.status IN ('PENDING', 'ACCEPTED')
        );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_job_assessment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_job_assessment(UUID) TO authenticated;