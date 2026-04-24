import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Stethoscope, Calendar, Clock, User, Phone, Mail, CheckCircle, MapPin, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { handlePhoneInput, isValidPhone, normalizePhone, PHONE_ERROR_MESSAGE } from '@/lib/phoneValidation';

interface Clinic {
  clinic_id: string;
  id?: string;
  clinic_name: string;
  name?: string;
  phone: string;
  working_hours_start: string;
  working_hours_end: string;
  address?: string;
  city?: string;
  state?: string;
}
interface Service {
  service_id: string; id?: string; service_name: string; name?: string; description?: string;
  duration_minutes: number; duration_mins?: number; price: number;
}
interface Doctor {
  doctor_id: string; id?: string; name: string; specialization?: string;
}
interface TimeSlot { time: string; available: boolean; }

const PublicBooking = () => {
  const { clinicSlug } = useParams<{ clinicSlug: string }>();
  const [clinic,   setClinic]   = useState<Clinic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [doctors,  setDoctors]  = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSuccess,      setIsSuccess]      = useState(false);
  const [phoneError,     setPhoneError]     = useState('');

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '',
    service_id: '', doctor_id: '',
    appointment_date: '', appointment_time: '', notes: ''
  });

  useEffect(() => {
    if (clinicSlug) fetchClinicData();
  }, [clinicSlug]);

  useEffect(() => {
    if (formData.service_id && formData.appointment_date && clinic) {
      fetchAvailableSlots();
    }
  }, [formData.service_id, formData.appointment_date, formData.doctor_id, clinic]);

  const fetchClinicData = async () => {
    try {
      setIsLoading(true);
      const res = await publicAPI.getClinic(clinicSlug!);
      
      // SYSTEM-WIDE NORMALIZATION: payload = res.data?.data || res.data || {}
      const payload = res.data?.data || res.data || {};
      
      if (payload.clinic) {
        setClinic(payload.clinic);
        setServices(Array.isArray(payload.services) ? payload.services : []);
        setDoctors(Array.isArray(payload.doctors) ? payload.doctors : []);
      } else {
        toast.error('Clinic not found or inactive');
      }
    } catch {
      toast.error('Failed to load clinic information');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableSlots = async () => {
    if (!clinic) return;
    try {
      setIsLoadingSlots(true);
      setFormData(prev => ({ ...prev, appointment_time: '' }));
      const params: { clinic_id: string; date: string; service_id: string; doctor_id?: string } = {
        clinic_id:  String(clinic?.clinic_id || clinic?.id || ''),
        date:       formData.appointment_date,
        service_id: formData.service_id,
      };
      if (formData.doctor_id && formData.doctor_id !== 'any') params.doctor_id = formData.doctor_id;
      const response = await publicAPI.getAvailableSlots(params);
      if (response.data.success) {
        const fetchedSlots = response.data.data.slots;
        
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const localToday = `${y}-${m}-${d}`;

        let finalSlots = fetchedSlots;
        if (formData.appointment_date === localToday) {
          const currentHours = now.getHours();
          const currentMinutes = now.getMinutes();
          finalSlots = fetchedSlots.filter((slot: any) => {
            const timeStr = typeof slot === 'string' ? slot : slot.time;
            if (!timeStr) return true;
            const [sh, sm] = timeStr.split(':').map(Number);
            if (sh > currentHours) return true;
            if (sh === currentHours && sm > currentMinutes) return true;
            return false;
          });
        }
        setAvailableSlots(finalSlots);
      }
    } catch (error) {
      console.error('Failed to fetch available slots:', error);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.service_id || !formData.appointment_date || !formData.appointment_time) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!isValidPhone(formData.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    setPhoneError('');
    if (!clinic) return;

    try {
      setIsSubmitting(true);
      const response = await publicAPI.bookAppointment({
        clinic_id:        String(clinic?.clinic_id || clinic?.id || ''),
        name:             formData.name,
        phone:            normalizePhone(formData.phone) || formData.phone,
        email:            formData.email || undefined,
        service_id:       formData.service_id,
        doctor_id:        (formData.doctor_id && formData.doctor_id !== 'any') ? formData.doctor_id : undefined,
        appointment_date: formData.appointment_date,
        appointment_time: formData.appointment_time,
        notes:            formData.notes || undefined,
      });

      if (response.data.success) {
        setIsSuccess(true);
        toast.success('Appointment booked successfully!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to book appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 overflow-y-auto">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 overflow-y-auto">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-500">Clinic not found or inactive</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4 overflow-y-auto">
        <Card className="w-full max-w-md my-auto">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked!</h2>
            <p className="text-gray-500 mb-4">
              Your appointment with {clinic.clinic_name} has been scheduled successfully.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm"><strong>Date:</strong> {new Date(formData.appointment_date).toLocaleDateString()}</p>
              <p className="text-sm"><strong>Time:</strong> {formData.appointment_time}</p>
              <p className="text-sm"><strong>Service:</strong> {services.find(s => s.service_id.toString() === formData.service_id)?.service_name}</p>
            </div>
            <p className="text-sm text-gray-500">
              You will receive a confirmation message shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-50 py-8 px-4 overflow-y-auto">
      <div className="max-w-2xl mx-auto my-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{clinic.clinic_name}</h1>
          <div className="flex items-center justify-center gap-2 text-gray-500 mt-2">
            <Phone className="w-4 h-4" />
            <span>{clinic.phone}</span>
          </div>
          {(clinic.address || clinic.city) && (
            <div className="flex items-center justify-center gap-2 text-gray-500 mt-1">
              <MapPin className="w-4 h-4" />
              <span>{[clinic.address, clinic.city, clinic.state].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>

        {/* Booking Form */}
        <Card>
          <CardHeader>
            <CardTitle>Book an Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Your Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="name">
                    <User className="w-4 h-4 inline mr-2" />
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => {
                      const cleaned = handlePhoneInput(e.target.value);
                      setFormData({ ...formData, phone: cleaned });
                      setPhoneError(cleaned.length > 0 && cleaned.length < 10 ? PHONE_ERROR_MESSAGE : '');
                    }}
                    required
                  />
                  {phoneError && <p className="text-sm text-red-500">{phoneError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email (Optional)
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Appointment Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Appointment Details</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="service">
                    <Stethoscope className="w-4 h-4 inline mr-2" />
                    Service *
                  </Label>
                  <Select
                    value={formData.service_id}
                    onValueChange={(value) => setFormData({ ...formData, service_id: value, appointment_time: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.service_id} value={service.service_id.toString()}>
                          {service.service_name} ({service.duration_minutes} min) — ₹{Number(service.price).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Optional Doctor Selector */}
                {doctors.length > 0 && (
                  <div className="space-y-2">
                    <Label>
                      <UserRound className="w-4 h-4 inline mr-2" />
                      Doctor <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                    <Select
                      value={formData.doctor_id}
                      onValueChange={(value) => setFormData({ ...formData, doctor_id: value, appointment_time: '' })}
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
                )}

                <div className="space-y-2">
                  <Label htmlFor="date">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Date *
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    min={getMinDate()}
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    required
                  />
                </div>

                {formData.service_id && formData.appointment_date && (
                  <div className="space-y-2">
                    <Label>
                      <Clock className="w-4 h-4 inline mr-2" />
                      Time Slot *
                    </Label>
                    {isLoadingSlots ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Spinner className="w-4 h-4" />
                        Loading available slots...
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-gray-500">No available slots for this date</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => setFormData({ ...formData, appointment_time: slot.time })}
                            className={`
                              p-2 text-sm rounded-lg border transition-colors
                              ${formData.appointment_time === slot.time
                                ? 'bg-blue-600 text-white border-blue-600'
                                : slot.available
                                  ? 'bg-white hover:bg-gray-50 border-gray-200'
                                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                              }
                            `}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional information..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !formData.appointment_time}
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Booking...
                  </>
                ) : (
                  'Book Appointment'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-8">
          Powered by DentFlow - Dental Clinic Management
        </p>
      </div>
    </div>
  );
};

export default PublicBooking;
