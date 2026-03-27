import { Link } from 'react-router-dom';
import { AlertTriangle, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useState } from 'react';

export const TrialBanner = () => {
  const { isTrial, daysLeft, isPastDue, isLoading } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed) return null;

  // Past due — always show, can't dismiss
  if (isPastDue) {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">
          Your subscription payment failed. Upgrade now to restore full access.
        </span>
        <Button asChild size="sm" variant="secondary" className="flex-shrink-0 h-7 text-xs">
          <Link to="/billing">Fix Now</Link>
        </Button>
      </div>
    );
  }

  // Trial period
  if (isTrial && daysLeft !== null) {
    const isUrgent = daysLeft <= 3;
    return (
      <div
        className={`${
          isUrgent ? 'bg-amber-500' : 'bg-blue-600'
        } text-white px-4 py-2.5 flex items-center gap-3 text-sm`}
      >
        <Zap className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">
          {daysLeft === 0
            ? 'Your trial expires today. '
            : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left on your trial. `}
          Upgrade to keep full access.
        </span>
        <Button asChild size="sm" variant="secondary" className="flex-shrink-0 h-7 text-xs">
          <Link to="/billing">Upgrade</Link>
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
};
