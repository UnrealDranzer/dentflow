import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { appointmentsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Stethoscope,
  Phone,
  Mail,
  Edit,
  XCircle
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Appointment {
  appointment_id: number;
  patient_id: number;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  service_id: number;
  service_name: string;
  service_price: number;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  notes?: string;
  reminder_sent: boolean;
  source: string;
  color_code: string;
  created_at: string;
}

const AppointmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string | undefined>(undefined);
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    if (id) {
      fetchAppointment();
    }
  }, [id]);

  const fetchAppointment = async () => {
    try {
      setIsLoading(true);
      const response = await appointmentsAPI.getById(Number(id));
      
      // SYSTEM-WIDE NORMALIZATION: payload = res.data?.data || res.data || {}
      const payload = response.data?.data || response.data || {};
      const apptData = payload.appointment || payload;

      if (apptData) {
        setAppointment(apptData);
      }
    } catch (error) {
      console.error('Failed to fetch appointment:', error);
      toast.error('Failed to load appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    try {
      const response = await appointmentsAPI.update(Number(id), {
        status: newStatus as 'confirmed' | 'completed' | 'no_show',
        notes: statusNotes || appointment?.notes
      });

      if (response.data.success) {
        toast.success(`Appointment ${newStatus}`);
        setIsUpdateDialogOpen(false);
        fetchAppointment();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update appointment');
    }
  };

  const handleCancel = async () => {
    try {
      const response = await appointmentsAPI.delete(Number(id));
      if (response.data.success) {
        toast.success('Appointment cancelled');
        navigate('/appointments');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel appointment');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
      scheduled: { variant: 'default', color: 'bg-blue-100 text-blue-800' },
      confirmed: { variant: 'default', color: 'bg-green-100 text-green-800' },
      completed: { variant: 'secondary', color: 'bg-gray-100 text-gray-800' },
      cancelled: { variant: 'destructive', color: 'bg-red-100 text-red-800' },
      no_show: { variant: 'outline', color: 'bg-yellow-100 text-yellow-800' }
    };

    const config = variants[status] || variants.scheduled;

    return (
      <Badge className={config.color}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  if (!appointment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Appointment not found</p>
        <Button asChild className="mt-4">
          <Link to="/appointments">Back to Appointments</Link>
        </Button>
      </div>
    );
  }

  const canUpdateStatus = ['scheduled', 'confirmed'].includes(appointment.status);
  const canCancel = ['scheduled', 'confirmed'].includes(appointment.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Appointment Details</h1>
            <p className="text-gray-500">ID: #{appointment.appointment_id}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {canUpdateStatus && (
            <Button onClick={() => setIsUpdateDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Update Status
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={() => setIsCancelDialogOpen(true)}>
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: appointment.color_code || '#3B82F6' }}
                  >
                    <Stethoscope className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{appointment.service_name}</h2>
                    <p className="text-gray-500">{formatCurrency(appointment.service_price)}</p>
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(appointment.status)}
                  <p className="text-sm text-gray-500 mt-1">
                    {appointment.reminder_sent ? 'Reminder sent' : 'No reminder sent'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date & Time */}
          <Card>
            <CardHeader>
              <CardTitle>Date & Time</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span>{formatDate(appointment.appointment_date)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <span>
                  {formatTime(appointment.appointment_time)} ({appointment.duration_minutes} minutes)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {appointment.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{appointment.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle>Patient Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold">{appointment.patient_name}</p>
                  <Button asChild variant="link" className="p-0 h-auto text-sm">
                    <Link to={`/patients/${appointment.patient_id}`}>View Profile</Link>
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <span>{appointment.patient_phone}</span>
              </div>
              {appointment.patient_email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span>{appointment.patient_email}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointment Info */}
          <Card>
            <CardHeader>
              <CardTitle>Appointment Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Source</span>
                <span className="capitalize">{appointment.source.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{formatDate(appointment.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reminder</span>
                <span>{appointment.reminder_sent ? 'Sent' : 'Pending'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Update Status Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Appointment Status</DialogTitle>
            <DialogDescription>
              Change the status of this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add any notes about this status change..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={!newStatus}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
              Keep Appointment
            </Button>
            <Button variant="destructive" onClick={handleCancel}>
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentDetail;
