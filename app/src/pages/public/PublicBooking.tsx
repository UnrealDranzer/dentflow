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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Stethoscope, Calendar, Clock, User, Phone, Mail, CheckCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface Clinic {
  clinic_id: number;
  clinic_name: string;
  phone: string;
  working_hours_start: string;
  working_hours_end: string;
  address?: string;
  city?: string;
  state?: string;
}

interface Service {
  service_id: number;
  service_name: string;
  description?: string;
  duration_minutes: number;
  price: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const PublicBooking = () => {
  const { clinicId } = useParams<{ clinicId: string }>();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    service_id: '',
    appointment_date: '',
    appointment_time: '',
    notes: ''
  });

  useEffect(() => {
    if (clinicId) {
      fetchClinicData();
    }
  }, [clinicId]);

  useEffect(() => {
    if (formData.service_id && formData.appointment_date && clinicId) {
      fetchAvailableSlots();
    }
  }, [formData.service_id, formData.appointment_date, clinicId]);

  const fetchClinicData = async () => {
    try {
      setIsLoading(true);
      const response = await publicAPI.getClinicInfo(Number(clinicId));
      if (response.data.success) {
        setClinic(response.data.data.clinic);
        setServices(response.data.data.services);
      }
    } catch (error) {
      console.error('Failed to fetch clinic:', error);
      toast.error('Failed to load clinic information');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      setIsLoadingSlots(true);
      setFormData(prev => ({ ...prev, appointment_time: '' }));

      const response = await publicAPI.getAvailableSlots({
        clinic_id: Number(clinicId),
        date: formData.appointment_date,
        service_id: parseInt(formData.service_id)
      });

      if (response.data.success) {
        setAvailableSlots(response.data.data.slots);
      }
    } catch (error) {
      console.error('Failed to fetch slots:', error);
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

    try {
      setIsSubmitting(true);
      const response = await publicAPI.bookAppointment({
        clinic_id: Number(clinicId),
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        service_id: parseInt(formData.service_id),
        appointment_date: formData.appointment_date,
        appointment_time: formData.appointment_time,
        notes: formData.notes
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <Card className="w-full max-w-md">
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
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
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
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
                    onValueChange={(value) => setFormData({ ...formData, service_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.service_id} value={service.service_id.toString()}>
                          {service.service_name} ({service.duration_minutes} min) - ₹{service.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
