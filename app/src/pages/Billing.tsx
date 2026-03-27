import { useState, useEffect } from 'react';
import { billingAPI } from '@/services/api';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle, Zap, Crown, AlertTriangle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  popular?: boolean;
}

const PLAN_ICONS: Record<string, React.FC<any>> = {
  basic: Zap,
  pro: Crown,
  enterprise: Crown,
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

const loadRazorpay = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Billing = () => {
  const { subscription, isLoading: subLoading, refresh, daysLeft } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await billingAPI.getPlans();
        if (res.data.success) setPlans(res.data.data.plans);
      } catch {
        toast.error('Failed to load plans');
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleSubscribe = async (planId: string) => {
    try {
      setPayingPlan(planId);

      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error('Failed to load payment gateway. Check your connection.');
        return;
      }

      const orderRes = await billingAPI.createOrder({ plan: planId });
      if (!orderRes.data.success) {
        toast.error(orderRes.data.message || 'Failed to create order');
        return;
      }

      const { order_id, amount, currency, key_id } = orderRes.data.data;

      const options = {
        key: key_id,
        amount,
        currency,
        order_id,
        name: 'DentFlow',
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan Subscription`,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await billingAPI.verifyPayment({
              ...response,
              plan: planId,
            });
            if (verifyRes.data.success) {
              toast.success('Payment successful! Your plan is now active.');
              refresh();
            } else {
              toast.error('Payment verification failed. Please contact support.');
            }
          } catch {
            toast.error('Payment verification error. Please contact support.');
          }
        },
        prefill: {},
        theme: { color: '#2563EB' },
        modal: { ondismiss: () => setPayingPlan(null) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Payment initiation failed');
    } finally {
      setPayingPlan(null);
    }
  };

  const getStatusBadge = () => {
    const map: Record<string, { label: string; className: string }> = {
      trial:    { label: 'Trial',    className: 'bg-blue-100 text-blue-700' },
      active:   { label: 'Active',   className: 'bg-green-100 text-green-700' },
      past_due: { label: 'Past Due', className: 'bg-red-100 text-red-700' },
      cancelled:{ label: 'Cancelled',className: 'bg-gray-100 text-gray-700' },
      free:     { label: 'Free',     className: 'bg-gray-100 text-gray-700' },
    };
    const s = map[subscription.status] || map.free;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>;
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="text-gray-500">Manage your DentFlow subscription</p>
      </div>

      {/* Current Plan Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg capitalize">
                  {subscription.plan || 'Free'} Plan
                </p>
                {getStatusBadge()}
              </div>
              {subscription.is_trial && daysLeft !== null && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {daysLeft === 0 ? 'Trial expires today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in trial`}
                </p>
              )}
              {subscription.current_period_end && !subscription.is_trial && (
                <p className="text-sm text-gray-500">
                  Renews on {new Date(subscription.current_period_end).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              )}
            </div>
            {subscription.status === 'past_due' && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Payment failed — please update your plan
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h2>
        {plansLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="w-8 h-8" />
          </div>
        ) : plans.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-gray-500">
              <p>No plans available at the moment.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const Icon = PLAN_ICONS[plan.id] || Zap;
              const isCurrent = subscription.plan === plan.id && subscription.is_active;
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${plan.popular ? 'ring-2 ring-blue-600' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <CardTitle className="capitalize">{plan.name}</CardTitle>
                    </div>
                    <div className="mt-1">
                      <span className="text-3xl font-bold">₹{plan.price.toLocaleString()}</span>
                      <span className="text-gray-500 text-sm">/{plan.interval}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-2 flex-1 mb-4">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full h-11 sm:h-9"
                      variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                      disabled={isCurrent || payingPlan === plan.id}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      {payingPlan === plan.id ? (
                        <span className="flex items-center gap-2">
                          <Spinner className="w-4 h-4" /> Processing...
                        </span>
                      ) : isCurrent ? (
                        'Current Plan'
                      ) : (
                        `Subscribe to ${plan.name}`
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Billing;
