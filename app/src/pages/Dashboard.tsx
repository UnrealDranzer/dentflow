import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI, appointmentsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarDays,
  Users,
  Stethoscope,
  TrendingUp,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

import { formatTime, formatDate, formatCurrency } from '@/lib/formatters';
import { normalizeAppointments } from '@/lib/normalizers';

interface DashboardStats {
  today: {
    total_appointments: number;
    scheduled: number;
    completed: number;
    cancelled: number;
  };
  upcoming_appointments: number;
  new_patients_this_month: number;
  total_patients: number;
  monthly_revenue: number;
  recent_appointments: any[];
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revenueFilter, setRevenueFilter] = useState<string>('monthly');
  const [isRevenueLoading, setIsRevenueLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      const [overviewRes, todayRes] = await Promise.all([
        analyticsAPI.getDashboardOverview({ range: revenueFilter }),
        appointmentsAPI.getToday()
      ]);

      // SYSTEM-WIDE NORMALIZATION: payload = res.data?.data || res.data || {}
      const statsPayload = overviewRes.data?.data || overviewRes.data || {};
      const todayPayload = todayRes.data?.data || todayRes.data || {};
      
      // Prefer nested 'stats' if available
      setStats(statsPayload.stats || statsPayload);

      // Prefer nested 'appointments' or the array itself
      const rawAppts = todayPayload.appointments || todayPayload.today_appointments || (Array.isArray(todayPayload) ? todayPayload : []);
      setTodayAppointments(normalizeAppointments(rawAppts));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        setIsRevenueLoading(true);
        const overviewRes = await analyticsAPI.getDashboardOverview({ range: revenueFilter });
        const statsPayload = overviewRes.data?.data || overviewRes.data || {};
        const newStats = statsPayload.stats || statsPayload;
        setStats(prev => prev ? { ...prev, ...newStats, monthly_revenue: newStats.monthly_revenue } : newStats);
      } catch (error) {
        console.error('Failed to update revenue:', error);
      } finally {
        setIsRevenueLoading(false);
      }
    };
    if (stats !== null) {
      fetchRevenue();
    }
  }, [revenueFilter]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      scheduled: { variant: 'default', icon: Clock },
      confirmed: { variant: 'default', icon: CheckCircle },
      completed: { variant: 'secondary', icon: CheckCircle },
      cancelled: { variant: 'destructive', icon: XCircle },
      no_show: { variant: 'outline', icon: AlertCircle }
    };

    const config = variants[status] || variants.scheduled;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };
  // ENHANCED SAFETY: Defensive extraction to prevent "total_appointments" crash.
  // We use local variables and multiple fallbacks to ensure zero-risk rendering.
  const rawStats = stats || {};
  const todayObj = (rawStats as any).today || (rawStats as any).stats?.today || {};
  const monthlyObj = (rawStats as any).monthlyStats || (rawStats as any).stats?.monthlyStats || {};

  const safeStats = {
    today_total: todayObj?.total_appointments ?? monthlyObj?.total ?? 0,
    today_scheduled: todayObj?.scheduled ?? 0,
    today_completed: todayObj?.completed ?? 0,
    upcoming: stats?.upcoming_appointments ?? (stats as any)?.upcomingCount ?? 0,
    new_patients: stats?.new_patients_this_month ?? (stats as any)?.totalPatients ?? 0,
    revenue: stats?.monthly_revenue ?? monthlyObj?.revenue ?? 0,
  };


  console.log("[DentFlow] Dashboard rendering with safety lockdown v4", { hasStats: !!stats });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="w-10 h-10 rounded-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-24" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg w-full">
                  <div className="flex items-center gap-4 flex-1">
                    <Skeleton className="rounded-lg h-10 w-[85px]" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="w-8 h-8 mb-4 rounded-full" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48 mb-4" />
                <Skeleton className="h-9 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ENHANCED SAFETY: Defensive extraction to prevent "total_appointments" crash.
  // We use local variables and multiple fallbacks to ensure zero-risk rendering.
  const rawStats = stats || {};
  const todayObj = (rawStats as any).today || (rawStats as any).stats?.today || {};
  const monthlyObj = (rawStats as any).monthlyStats || (rawStats as any).stats?.monthlyStats || {};

  const safeStats = {
    today_total: todayObj?.total_appointments ?? monthlyObj?.total ?? 0,
    today_scheduled: todayObj?.scheduled ?? 0,
    today_completed: todayObj?.completed ?? 0,
    upcoming: stats?.upcoming_appointments ?? (stats as any)?.upcomingCount ?? 0,
    new_patients: stats?.new_patients_this_month ?? (stats as any)?.totalPatients ?? 0,
    revenue: stats?.monthly_revenue ?? monthlyObj?.revenue ?? 0,
  };


  console.log("[DentFlow] Dashboard rendering with safety lockdown v4", { hasStats: !!stats });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/appointments">
              View All Appointments
            </Link>
          </Button>
          <Button asChild>
            <Link to="/appointments/new">
              <Plus className="w-4 h-4 mr-2" />
              New Appointment
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Today's Appointments</CardTitle>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeStats.today_total}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {safeStats.today_scheduled} scheduled, {safeStats.today_completed} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Upcoming (7 days)</CardTitle>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeStats.upcoming}
            </div>
            <p className="text-xs text-gray-500 mt-1">Next 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">New Patients</CardTitle>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeStats.new_patients}
            </div>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Select value={revenueFilter} onValueChange={setRevenueFilter}>
              <SelectTrigger className="w-[110px] h-7 text-sm font-medium text-gray-500 border-none bg-transparent hover:bg-gray-100 shadow-none p-1 focus:ring-0 -ml-1">
                <SelectValue placeholder="Revenue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold transition-opacity duration-200 ${isRevenueLoading ? 'opacity-50' : 'opacity-100'}`}>
              {formatCurrency(safeStats.revenue)}
            </div>
            <p className="text-xs text-gray-500 mt-1">From completed appointments</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Today's Schedule</CardTitle>
            <p className="text-sm text-gray-500">{formatDate(new Date().toISOString())}</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/appointments">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No appointments scheduled for today</p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/appointments/new">Schedule Appointment</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((appointment) => (
                <div
                  key={appointment.appointment_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="rounded-lg flex items-center justify-center text-white font-bold text-sm px-3 py-2 min-w-[85px] whitespace-nowrap"
                      style={{ backgroundColor: appointment.color_code || '#3B82F6' }}
                    >
                      {formatTime(appointment.appointment_time)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{appointment.patient_name}</h4>
                      <p className="text-sm text-gray-500">{appointment.service_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(appointment.status)}
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/appointments/${appointment.appointment_id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <Stethoscope className="w-8 h-8 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Manage Services</h3>
            <p className="text-blue-100 text-sm mb-4">Add or update your dental services and pricing</p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/services">Manage Services</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-6">
            <Users className="w-8 h-8 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Patient Database</h3>
            <p className="text-purple-100 text-sm mb-4">View and manage your patient records</p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/patients">View Patients</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="pt-6">
            <TrendingUp className="w-8 h-8 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analytics</h3>
            <p className="text-green-100 text-sm mb-4">View detailed reports and insights</p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/analytics">View Analytics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
