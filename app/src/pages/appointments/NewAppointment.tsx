import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { patientsAPI, servicesAPI, doctorsAPI, appointmentsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Calendar, Clock, User, Stethoscope, UserRound } from 'lucide-react';
import { toast } from 'sonner';

interface Patient { patient_id: string; name: string; phone: string; }
interface Service { service_id: string; service_name: string; duration_minutes: number; price: number; }
interface Doctor  { doctor_id: string; name: string; specialization?: string; color_tag?: string; }
type SlotItem = string | { time: string; end_time?: string; available: boolean };

const NewAppointment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patient_id');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [doctors,  setDoctors]  = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotMessage,    setSlotMessage]    = useState('');

  const [formData, setFormData] = useState({
    patient_id:       preselectedPatientId || '',
    service_id:       '',
    doctor_id:        '',          // optional
    appointment_date: '',
    appointment_time: '',
    notes: ''
  });

  useEffect(() => { fetchInitialData(); }, []);

  // Re-fetch slots whenever date, service, or doctor changes
  useEffect(() => {
    if (formData.service_id && formData.appointment_date) {
      fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
      setSlotMessage('');
    }
  }, [formData.service_id, formData.appointment_date, formData.doctor_id]);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [pRes, sRes, dRes] = await Promise.all([
        patientsAPI.getAll({ limit: 200 }),
        servicesAPI.getAll(),
        doctorsAPI.getAll({ active_only: true }),
      ]);
      if (pRes.data.success) setPatients(pRes.data.data.patients);
      if (sRes.data.success) setServices(sRes.data.data.services);
      if (dRes.data.success) setDoctors(dRes.data.data.doctors);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      setIsLoadingSlots(true);
      setFormData(prev => ({ ...prev, appointment_time: '' }));
      setAvailableSlots([]);
      setSlotMessage('');

      const params: { date: string; service_id: string; doctor_id?: string } = {
        date:       formData.appointment_date,
        service_id: formData.service_id,
      };
      if (formData.doctor_id && formData.doctor_id !== 'any') params.doctor_id = formData.doctor_id;

      const res = await appointmentsAPI.getAvailableSlots(params);
      if (res.data.success) {
        setAvailableSlots(res.data.data.slots || []);
        setSlotMessage(res.data.data.message || '');
      }
    } catch {
      toast.error('Failed to load available time slots');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_id || !formData.service_id || !formData.appointment_date || !formData.appointment_time) {
      toast.error('Please fill in all required fields and select a time slot');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await appointmentsAPI.create({
        patient_id:       formData.patient_id,
        service_id:       formData.service_id,
        doctor_id:        (formData.doctor_id && formData.doctor_id !== 'any') ? formData.doctor_id : undefined,
        appointment_date: formData.appointment_date,
        appointment_time: formData.appointment_time,
        notes:            formData.notes || undefined,
      });
      if (res.data.success) {
        toast.success('Appointment created successfully');
        navigate('/appointments');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinDate = () => new Date().toISOString().split('T')[0];

  const normalizedSlots = (availableSlots || [])
    .map((s): { time: string; available: boolean } =>
      typeof s === 'string' ? { time: s, available: true } : { time: s.time, available: s.available }
    )
    .filter(s => s.available);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Appointment</h1>
          <p className="text-gray-500">Schedule a new appointment</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Patient */}
            <div className="space-y-2">
              <Label>
                <User className="w-4 h-4 inline mr-2" />
                Patient *
              </Label>
              <Select
                value={formData.patient_id}
                onValueChange={v => setFormData({ ...formData, patient_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select a patient" /></SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.patient_id} value={p.patient_id.toString()}>
                      {p.name} — {p.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service */}
            <div className="space-y-2">
              <Label>
                <Stethoscope className="w-4 h-4 inline mr-2" />
                Service *
              </Label>
              <Select
                value={formData.service_id}
                onValueChange={v => setFormData({ ...formData, service_id: v, appointment_time: '' })}
              >
                <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.service_id} value={s.service_id.toString()}>
                      {s.service_name} ({s.duration_minutes} min) — ₹{Number(s.price).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Doctor (optional) */}
            <div className="space-y-2">
              <Label>
                <UserRound className="w-4 h-4 inline mr-2" />
                Doctor <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Select
                value={formData.doctor_id}
                onValueChange={v => setFormData({ ...formData, doctor_id: v, appointment_time: '' })}
              >
                <SelectTrigger><SelectValue placeholder="Any available doctor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any available doctor</SelectItem>
                  {doctors.map(d => (
                    <SelectItem key={d.doctor_id} value={d.doctor_id.toString()}>
                      {d.name}{d.specialization ? ` — ${d.specialization}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>
                <Calendar className="w-4 h-4 inline mr-2" />
                Date *
              </Label>
              <Input
                type="date"
                min={getMinDate()}
                value={formData.appointment_date}
                onChange={e => setFormData({ ...formData, appointment_date: e.target.value, appointment_time: '' })}
                required
              />
            </div>

            {/* Time Slots */}
            {formData.service_id && formData.appointment_date && (
              <div className="space-y-2 col-span-1 sm:col-span-2">
                <Label>
                  <Clock className="w-4 h-4 inline mr-2" />
                  Time Slot *
                </Label>
                {isLoadingSlots ? (
                  <div className="flex items-center gap-2 text-gray-500 py-4">
                    <Spinner className="w-4 h-4" />
                    Loading available slots...
                  </div>
                ) : normalizedSlots.length === 0 ? (
                  <div className="py-4 px-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    {slotMessage || 'No available time slots for the selected date.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {normalizedSlots.map(({ time: slotTime }) => (
                      <button
                        key={slotTime}
                        type="button"
                        onClick={() => setFormData({ ...formData, appointment_time: slotTime })}
                        className={`p-2 text-sm rounded-lg border transition-colors font-medium ${
                          formData.appointment_time === slotTime
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white hover:bg-blue-50 border-gray-200 text-gray-700'
                        }`}
                      >
                        {slotTime}
                      </button>
                    ))}
                  </div>
                )}
                {formData.appointment_time && (
                  <p className="text-sm text-blue-600 font-medium">
                    ✓ Selected: {formData.appointment_time}
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 col-span-1 sm:col-span-2">
              <Button type="button" variant="outline" className="flex-1 h-11 sm:h-9" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11 sm:h-9"
                disabled={isSubmitting || !formData.appointment_time}
              >
                {isSubmitting ? (
                  <><Spinner className="w-4 h-4 mr-2" />Creating...</>
                ) : (
                  'Create Appointment'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewAppointment;
