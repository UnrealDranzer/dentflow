import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { patientsAPI, servicesAPI, appointmentsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Calendar, Clock, User, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

interface Patient {
  patient_id: number;
  name: string;
  phone: string;
}

interface Service {
  service_id: number;
  service_name: string;
  duration_minutes: number;
  price: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const NewAppointment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patient_id');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const [formData, setFormData] = useState({
    patient_id: preselectedPatientId || '',
    service_id: '',
    appointment_date: '',
    appointment_time: '',
    notes: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.service_id && formData.appointment_date) {
      fetchAvailableSlots();
    }
  }, [formData.service_id, formData.appointment_date]);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [patientsRes, servicesRes] = await Promise.all([
        patientsAPI.getAll({ limit: 100 }),
        servicesAPI.getAll()
      ]);

      if (patientsRes.data.success) {
        setPatients(patientsRes.data.data.patients);
      }

      if (servicesRes.data.success) {
        setServices(servicesRes.data.data.services);
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      setIsLoadingSlots(true);
      setFormData(prev => ({ ...prev, appointment_time: '' }));

      const response = await appointmentsAPI.getAvailableSlots({
        date: formData.appointment_date,
        service_id: parseInt(formData.service_id)
      });

      if (response.data.success) {
        setAvailableSlots(response.data.data.slots);
      }
    } catch (error) {
      console.error('Failed to fetch available slots:', error);
      toast.error('Failed to load available time slots');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patient_id || !formData.service_id || !formData.appointment_date || !formData.appointment_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await appointmentsAPI.create({
        patient_id: parseInt(formData.patient_id),
        service_id: parseInt(formData.service_id),
        appointment_date: formData.appointment_date,
        appointment_time: formData.appointment_time,
        notes: formData.notes
      });

      if (response.data.success) {
        toast.success('Appointment created successfully');
        navigate('/appointments');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create appointment');
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Selection */}
            <div className="space-y-2">
              <Label htmlFor="patient">
                <User className="w-4 h-4 inline mr-2" />
                Patient *
              </Label>
              <Select
                value={formData.patient_id}
                onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.patient_id} value={patient.patient_id.toString()}>
                      {patient.name} - {patient.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service Selection */}
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

            {/* Date Selection */}
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

            {/* Time Slot Selection */}
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
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
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

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || !formData.appointment_time}
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Creating...
                  </>
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
