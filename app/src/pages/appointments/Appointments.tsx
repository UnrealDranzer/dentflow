import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarDays,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

import { formatTime, formatDate } from '@/lib/formatters';
import type { NormalizedAppointment } from '@/lib/normalizers';
import { normalizeAppointments } from '@/lib/normalizers';

// Using NormalizedAppointment instead of fragile inline interface


const Appointments = () => {
  const [appointments, setAppointments] = useState<NormalizedAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter, dateFilter]);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      
      const response = await appointmentsAPI.getAll(params);
      
      // SYSTEM-WIDE NORMALIZATION: payload = res.data?.data || res.data || {}
      const payload = response.data?.data || response.data || {};
      const appts = payload.appointments || (Array.isArray(payload) ? payload : []);
      setAppointments(normalizeAppointments(appts));
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAppointments = appointments.filter(appointment =>
    (appointment.patient_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (appointment.service_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (appointment.patient_phone || '').includes(searchQuery)
  );

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
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500">Manage your clinic appointments</p>
        </div>
        <Button asChild className="h-11 sm:h-9">
          <Link to="/appointments/new">
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by patient or service..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle>All Appointments ({filteredAppointments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No appointments found</p>
              <Button asChild className="mt-4">
                <Link to="/appointments/new">Schedule Appointment</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((appointment) => (
                <div
                  key={appointment.appointment_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors w-full overflow-hidden"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="w-14 h-14 rounded-lg flex flex-col items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: appointment.color_code || '#3B82F6' }}
                    >
                      <span className="text-xs font-medium">
                        {formatDate(appointment.appointment_date)}
                      </span>
                      <span className="text-sm font-bold">
                        {formatTime(appointment.appointment_time)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{appointment.patient_name || '—'}</h4>
                      <p className="text-sm text-gray-500 truncate">{appointment.service_name || '—'}</p>
                      <p className="text-xs text-gray-400">{appointment.duration_mins || 0} minutes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    {getStatusBadge(appointment.status || 'scheduled')}
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
    </div>
  );
};

export default Appointments;
