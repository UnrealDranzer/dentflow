import { useEffect, useState, useCallback } from 'react';
import { billingAPI } from '@/services/api';

export interface SubscriptionInfo {
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'free';
  plan: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  days_remaining: number | null;
  is_trial: boolean;
  is_active: boolean;
}

const DEFAULT: SubscriptionInfo = {
  status: 'free',
  plan: null,
  trial_ends_at: null,
  current_period_end: null,
  days_remaining: null,
  is_trial: false,
  is_active: false,
};

export const useSubscription = () => {
  const [subscription, setSubscription] = useState<SubscriptionInfo>(DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await billingAPI.getStatus();
      if (res.data.success) {
        setSubscription(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load subscription info');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const daysLeft = subscription.is_trial && subscription.trial_ends_at
    ? Math.max(0, Math.ceil(
        (new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : null;

  return {
    subscription,
    isLoading,
    error,
    refresh: fetchSubscription,
    daysLeft,
    isTrial: subscription.is_trial,
    isActive: subscription.is_active,
    isPastDue: subscription.status === 'past_due',
  };
};
