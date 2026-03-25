import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI, appointmentsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      const [overviewRes, todayRes] = await Promise.all([
        analyticsAPI.getDashboardOverview(),
        appointmentsAPI.getToday()
      ]);

      if (overviewRes.data.success) {
        setStats(overviewRes.data.data);
      }

      if (todayRes.data.success) {
        setTodayAppointments(todayRes.data.data.appointments);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

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

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

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
            {/* Safe access and fallback to monthlyStats.total if today is missing to prevent crash */}
            <div className="text-2xl font-bold">
              {(stats as any)?.today?.total_appointments ?? (stats as any)?.monthlyStats?.total ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {(stats as any)?.today?.scheduled ?? 0} scheduled, {(stats as any)?.today?.completed ?? 0} completed
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
              {stats?.upcoming_appointments ?? (stats as any)?.upcomingCount ?? 0}
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
              {stats?.new_patients_this_month ?? (stats as any)?.totalPatients ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Monthly Revenue</CardTitle>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.monthly_revenue ?? (stats as any)?.monthlyStats?.revenue ?? 0)}
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
            <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
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
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold"
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
