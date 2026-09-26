import { supabase } from './supabase';
import { Referral, ReferralStats, ReferralStatus } from '../types';
import { getReachableNetworkOrigin } from './networkOrigin';

/**
 * Generate a clean, unique referral code like 'SAM-7X29K'
 */
export function generateReferralCode(userName?: string, userId?: string): string {
  const prefix = (userName || 'BTR')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  const suffix = (userId ? userId.replace(/-/g, '').slice(0, 5) : Math.random().toString(36).substring(2, 7)).toUpperCase();
  return `${prefix}-${suffix}`;
}

/**
 * Get or create the candidate's personal referral code
 */
export async function getOrCreateCandidateReferralCode(userId: string, userName?: string): Promise<string> {
  try {
    // Check if user already has an active referral record with a code
    const { data: existing } = await supabase
      .from('referrals')
      .select('referral_code')
      .eq('referrer_user_id', userId)
      .limit(1)
      .maybeSingle();

    if (existing?.referral_code) {
      return existing.referral_code;
    }
  } catch (err) {
    console.warn('Error querying existing referral code:', err);
  }

  // Generate deterministic unique code
  return generateReferralCode(userName, userId);
}

/**
 * Get the full referral signup link
 */
export function getReferralUrl(referralCode: string): string {
  const origin = getReachableNetworkOrigin();
  return `${origin}/signup?ref=${encodeURIComponent(referralCode)}`;
}

/**
 * Fetch candidate's referral statistics
 */
export async function getCandidateReferralStats(userId: string): Promise<ReferralStats> {
  const defaultStats: ReferralStats = {
    invited: 0,
    joined: 0,
    completed_profile: 0,
    completed_assessment: 0,
    successful_applications: 0,
  };

  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_user_id', userId);

    if (error || !data) return defaultStats;

    const stats: ReferralStats = { ...defaultStats, invited: data.length };

    for (const ref of data) {
      if (['SIGNED_UP', 'PROFILE_COMPLETED', 'ASSESSMENT_COMPLETED', 'APPLIED', 'HIRED'].includes(ref.status)) {
        stats.joined++;
      }
      if (['PROFILE_COMPLETED', 'ASSESSMENT_COMPLETED', 'APPLIED', 'HIRED'].includes(ref.status)) {
        stats.completed_profile++;
      }
      if (['ASSESSMENT_COMPLETED', 'APPLIED', 'HIRED'].includes(ref.status)) {
        stats.completed_assessment++;
      }
      if (['APPLIED', 'HIRED'].includes(ref.status)) {
        stats.successful_applications++;
      }
    }

    return stats;
  } catch (err) {
    console.warn('Error fetching referral stats:', err);
    return defaultStats;
  }
}

/**
 * Fetch list of candidate's referrals with progress
 */
export async function getCandidateReferrals(userId: string): Promise<Referral[]> {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*, referred_user:profiles!referred_user_id(id, full_name, email)')
      .eq('referrer_user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as Referral[];
  } catch (err) {
    console.warn('Error fetching referrals list:', err);
    return [];
  }
}

/**
 * Record an invitation when a user shares or invites someone by email
 */
export async function recordReferralInvite(
  referrerUserId: string,
  referralCode: string,
  email?: string
): Promise<Referral | null> {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_user_id: referrerUserId,
        referral_code: referralCode,
        referred_email: email || null,
        status: 'INVITED',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Log referral event
    if (data?.id) {
      await supabase.from('referral_events').insert({
        referral_id: data.id,
        event_type: 'INVITED',
        metadata: { email: email || 'link_shared' },
      });
    }

    return data as Referral;
  } catch (err) {
    console.warn('Could not record referral invite:', err);
    return null;
  }
}

/**
 * Record signup when a new user registers using a referral code
 */
export async function recordReferralSignup(referralCode: string, newUserId: string): Promise<boolean> {
  try {
    if (!referralCode || !newUserId) return false;

    // 1. Try to find the referrer by matching their code
    const { data: matchedRef } = await supabase
      .from('referrals')
      .select('id, referrer_user_id, status')
      .eq('referral_code', referralCode)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let referrerId = matchedRef?.referrer_user_id;

    // If not found in referrals table, look up profiles where deterministic code matches
    if (!referrerId) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name');

      if (profiles) {
        for (const p of profiles) {
          if (generateReferralCode(p.full_name, p.id) === referralCode.toUpperCase()) {
            referrerId = p.id;
            break;
          }
        }
      }
    }

    if (!referrerId || referrerId === newUserId) {
      // Cannot refer self
      return false;
    }

    const now = new Date().toISOString();

    if (matchedRef?.id && matchedRef.status === 'INVITED') {
      // Update existing invited record
      await supabase
        .from('referrals')
        .update({
          referred_user_id: newUserId,
          status: 'SIGNED_UP',
          signup_timestamp: now,
        })
        .eq('id', matchedRef.id);

      await supabase.from('referral_events').insert({
        referral_id: matchedRef.id,
        event_type: 'SIGNED_UP',
        metadata: { referred_user_id: newUserId, timestamp: now },
      });
    } else {
      // Create new signed-up referral record
      const { data: newRef } = await supabase
        .from('referrals')
        .insert({
          referrer_user_id: referrerId,
          referral_code: referralCode,
          referred_user_id: newUserId,
          status: 'SIGNED_UP',
          signup_timestamp: now,
          created_at: now,
        })
        .select()
        .single();

      if (newRef?.id) {
        await supabase.from('referral_events').insert({
          referral_id: newRef.id,
          event_type: 'SIGNED_UP',
          metadata: { referred_user_id: newUserId, timestamp: now },
        });
      }
    }

    return true;
  } catch (err) {
    console.warn('Error recording referral signup:', err);
    return false;
  }
}

/**
 * Milestone progression precedence:
 * INVITED (0) < SIGNED_UP (1) < PROFILE_COMPLETED (2) < ASSESSMENT_COMPLETED (3) < APPLIED (4) < HIRED (5)
 */
const STATUS_PRECEDENCE: Record<ReferralStatus, number> = {
  INVITED: 0,
  SIGNED_UP: 1,
  PROFILE_COMPLETED: 2,
  ASSESSMENT_COMPLETED: 3,
  APPLIED: 4,
  HIRED: 5,
};

/**
 * Update candidate referral milestone when real platform actions occur
 */
export async function updateReferralMilestone(
  candidateUserId: string,
  milestone: 'PROFILE_COMPLETED' | 'ASSESSMENT_COMPLETED' | 'APPLIED' | 'HIRED'
): Promise<void> {
  try {
    const { data: refRow } = await supabase
      .from('referrals')
      .select('id, status')
      .eq('referred_user_id', candidateUserId)
      .maybeSingle();

    if (!refRow) return;

    const currentRank = STATUS_PRECEDENCE[refRow.status as ReferralStatus] || 0;
    const newRank = STATUS_PRECEDENCE[milestone];

    if (newRank > currentRank) {
      const now = new Date().toISOString();
      const updates: Record<string, any> = { status: milestone };

      if (milestone === 'PROFILE_COMPLETED') updates.profile_completed_at = now;
      if (milestone === 'ASSESSMENT_COMPLETED') updates.assessment_completed_at = now;
      if (milestone === 'APPLIED') updates.applied_at = now;
      if (milestone === 'HIRED') updates.hired_at = now;

      await supabase
        .from('referrals')
        .update(updates)
        .eq('id', refRow.id);

      await supabase.from('referral_events').insert({
        referral_id: refRow.id,
        event_type: milestone,
        metadata: { candidate_id: candidateUserId, timestamp: now },
      });
    }
  } catch (err) {
    console.warn(`Could not update referral milestone (${milestone}):`, err);
  }
}
