import { useEffect, useState } from 'react';
import { doctorsAPI } from '@/services/api';
import type { Doctor } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus, Search, UserRound, Phone, Mail, Edit, Trash2,
  ToggleLeft, ToggleRight, Clock, Star, Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { handlePhoneInput, isValidPhone, normalizePhone, formatPhoneDisplay, PHONE_ERROR_MESSAGE } from '@/lib/phoneValidation';

const DAYS = [
  { val: 0, label: 'Sun' },
  { val: 1, label: 'Mon' },
  { val: 2, label: 'Tue' },
  { val: 3, label: 'Wed' },
  { val: 4, label: 'Thu' },
  { val: 5, label: 'Fri' },
  { val: 6, label: 'Sat' },
];

const emptyForm = {
  name: '',
  specialization: '',
  phone: '',
  email: '',
  qualification: '',
  experience_years: '',
  color_tag: '#3B82F6',
  working_days: [1, 2, 3, 4, 5, 6],
  start_time: '09:00',
  end_time: '18:00',
  break_start: '13:00',
  break_end: '14:00',
  slot_interval: 30,
};

const toggleDay = (day: number, selected: number[], onChange: (v: number[]) => void) => {
  if (selected.includes(day)) {
    onChange(selected.filter(d => d !== day).sort());
  } else {
    onChange([...selected, day].sort());
  }
};

const DaySelector = ({
  selected,
  onChange,
}: { selected: number[]; onChange: (v: number[]) => void }) => (
  <div className="flex gap-1 flex-wrap">
    {DAYS.map(d => (
      <button
        key={d.val}
        type="button"
        onClick={() => toggleDay(d.val, selected, onChange)}
        className={`px-2 py-1 text-xs rounded font-medium border transition-colors ${
          selected.includes(d.val)
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
        }`}
      >
        {d.label}
      </button>
    ))}
  </div>
);

const DoctorForm = ({
  values, setValues, onSubmit, onCancel, submitLabel, isSaving
}: {
  values: any;
  setValues: (v: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  isSaving: boolean;
}) => {
  const [phoneError, setPhoneError] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (values.phone && !isValidPhone(values.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    setPhoneError('');
    onSubmit(e);
  };

  return (
  <form onSubmit={handleFormSubmit}>
    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Basic Info */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700 border-b pb-1">Basic Information</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Full Name *</Label>
            <Input
              value={values.name}
              onChange={e => setValues({ ...values, name: e.target.value })}
              placeholder="Dr. John Smith"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Specialization</Label>
            <Input
              value={values.specialization || ''}
              onChange={e => setValues({ ...values, specialization: e.target.value })}
              placeholder="General Dentistry"
            />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={values.phone || ''}
              onChange={e => {
                const cleaned = handlePhoneInput(e.target.value);
                setValues({ ...values, phone: cleaned });
                setPhoneError(cleaned.length > 0 && cleaned.length < 10 ? PHONE_ERROR_MESSAGE : '');
              }}
              placeholder="9876543210"
            />
            {phoneError && <p className="text-sm text-red-500">{phoneError}</p>}
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={values.email || ''}
              onChange={e => setValues({ ...values, email: e.target.value })}
              placeholder="doctor@clinic.com"
            />
          </div>
          <div className="space-y-1">
            <Label>Qualification</Label>
            <Input
              value={values.qualification || ''}
              onChange={e => setValues({ ...values, qualification: e.target.value })}
              placeholder="BDS, MDS"
            />
          </div>
          <div className="space-y-1">
            <Label>Experience (years)</Label>
            <Input
              type="number"
              min={0}
              value={values.experience_years || ''}
              onChange={e => setValues({ ...values, experience_years: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Color Tag</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="color"
                value={values.color_tag || '#3B82F6'}
                onChange={e => setValues({ ...values, color_tag: e.target.value })}
                className="w-12 h-10 p-1"
              />
              <Input
                value={values.color_tag || '#3B82F6'}
                onChange={e => setValues({ ...values, color_tag: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700 border-b pb-1">Schedule & Availability</p>
        <div className="space-y-1">
          <Label>Working Days</Label>
          <DaySelector
            selected={values.working_days || [1, 2, 3, 4, 5, 6]}
            onChange={days => setValues({ ...values, working_days: days })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={values.start_time || '09:00'}
              onChange={e => setValues({ ...values, start_time: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>End Time</Label>
            <Input
              type="time"
              value={values.end_time || '18:00'}
              onChange={e => setValues({ ...values, end_time: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Break Start</Label>
            <Input
              type="time"
              value={values.break_start || '13:00'}
              onChange={e => setValues({ ...values, break_start: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Break End</Label>
            <Input
              type="time"
              value={values.break_end || '14:00'}
              onChange={e => setValues({ ...values, break_end: e.target.value })}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Slot Interval (minutes)</Label>
            <Input
              type="number"
              min={5}
              max={120}
              value={values.slot_interval || 30}
              onChange={e => setValues({ ...values, slot_interval: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </div>
    <DialogFooter className="mt-4">
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      <Button type="submit" disabled={isSaving}>
        {isSaving ? 'Saving...' : submitLabel}
      </Button>
    </DialogFooter>
  </form>
  );
};

const Doctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [newDoc, setNewDoc] = useState({ ...emptyForm });
  const [editDoc, setEditDoc] = useState<Doctor & typeof emptyForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchDoctors(); }, []);

  const fetchDoctors = async () => {
    try {
      setIsLoading(true);
      const res = await doctorsAPI.getAll({ active_only: false });
      if (res.data.success) setDoctors(res.data.data.doctors);
    } catch {
      toast.error('Failed to load doctors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.name?.trim()) {
      toast.error('Doctor name is required');
      return;
    }
    try {
      setIsSaving(true);
      const res = await doctorsAPI.create({
        name: newDoc.name.trim(),
        specialization: newDoc.specialization?.trim() || '',
        phone: newDoc.phone ? (normalizePhone(newDoc.phone) || newDoc.phone) : undefined,
        email: newDoc.email?.trim() || '',
        qualification: newDoc.qualification?.trim() || '',
        experience_years: newDoc.experience_years ? Number(newDoc.experience_years) : undefined,
        color_tag: newDoc.color_tag || '#3B82F6',
        working_days: newDoc.working_days,
        start_time: newDoc.start_time,
        end_time: newDoc.end_time,
        break_start: newDoc.break_start,
        break_end: newDoc.break_end,
        slot_interval: Number(newDoc.slot_interval),
      });
      if (res.data.success) {
        toast.success('Doctor added successfully');
        setIsAddOpen(false);
        setNewDoc({ ...emptyForm });
        fetchDoctors();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add doctor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDoc) return;
    if (!editDoc.name?.trim()) {
      toast.error('Doctor name is required');
      return;
    }
    try {
      setIsSaving(true);
      const res = await doctorsAPI.update(editDoc.doctor_id, {
        name: editDoc.name.trim(),
        specialization: editDoc.specialization?.trim() || '',
        phone: editDoc.phone ? (normalizePhone(editDoc.phone) || editDoc.phone) : undefined,
        email: editDoc.email?.trim() || '',
        qualification: editDoc.qualification?.trim() || '',
        experience_years: editDoc.experience_years ? Number(editDoc.experience_years) : undefined,
        color_tag: editDoc.color_tag || '#3B82F6',
        working_days: editDoc.working_days,
        start_time: editDoc.start_time,
        end_time: editDoc.end_time,
        break_start: editDoc.break_start,
        break_end: editDoc.break_end,
        slot_interval: Number(editDoc.slot_interval),
      });
      if (res.data.success) {
        toast.success('Doctor updated successfully');
        setIsEditOpen(false);
        fetchDoctors();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update doctor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDoctor) return;
    try {
      const res = await doctorsAPI.delete(selectedDoctor.doctor_id);
      if (res.data.success) {
        toast.success('Doctor deactivated');
        setIsDeleteOpen(false);
        fetchDoctors();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete doctor');
    }
  };

  const handleToggleActive = async (doc: Doctor) => {
    try {
      const res = await doctorsAPI.update(doc.doctor_id, { is_active: !doc.is_active });
      if (res.data.success) {
        toast.success(doc.is_active ? 'Doctor deactivated' : 'Doctor activated');
        fetchDoctors();
      }
    } catch {
      toast.error('Failed to update doctor status');
    }
  };

  const openEdit = (doc: Doctor) => {
    setEditDoc({
      ...doc,
      working_days: doc.working_days || [1, 2, 3, 4, 5, 6],
      start_time: doc.start_time || '09:00',
      end_time: doc.end_time || '18:00',
      break_start: doc.break_start || '13:00',
      break_end: doc.break_end || '14:00',
      slot_interval: doc.slot_interval || 30,
    } as any);
    setIsEditOpen(true);
  };

  const filtered = doctors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.specialization || '').toLowerCase().includes(search.toLowerCase())
  );



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
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-gray-500">Manage your clinic's dental professionals</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Doctor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Doctor</DialogTitle>
              <DialogDescription>Add a new doctor to your clinic.</DialogDescription>
            </DialogHeader>
            <DoctorForm
              values={newDoc}
              setValues={setNewDoc}
              onSubmit={handleAdd}
              onCancel={() => setIsAddOpen(false)}
              submitLabel="Add Doctor"
              isSaving={isSaving}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search doctors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Doctor Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <UserRound className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">{search ? 'No doctors found' : 'No doctors added yet'}</p>
          {!search && (
            <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
              Add Your First Doctor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card key={doc.doctor_id} className={`relative w-full overflow-hidden ${!doc.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                    style={{ backgroundColor: doc.color_tag || '#3B82F6' }}
                  >
                    {doc.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base truncate">{doc.name}</CardTitle>
                      <Badge variant={doc.is_active ? 'default' : 'secondary'} className="text-xs">
                        {doc.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {doc.specialization && (
                      <p className="text-sm text-blue-600 font-medium">{doc.specialization}</p>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2">
                {doc.qualification && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    {doc.qualification}
                  </div>
                )}
                {doc.experience_years && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Briefcase className="w-3.5 h-3.5" />
                    {doc.experience_years} years experience
                  </div>
                )}
                {doc.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5" />
                    {formatPhoneDisplay(doc.phone)}
                  </div>
                )}
                {doc.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 truncate">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{doc.email}</span>
                  </div>
                )}
                {doc.start_time && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-3.5 h-3.5" />
                    {doc.start_time} – {doc.end_time}
                  </div>
                )}

                {/* Working days dots */}
                {doc.working_days && (
                  <div className="flex gap-1 mt-1">
                    {DAYS.map(d => (
                      <span
                        key={d.val}
                        className={`text-xs px-1 py-0.5 rounded font-medium ${
                          (doc.working_days as number[]).includes(d.val)
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(doc)}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(doc)}
                    title={doc.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {doc.is_active
                      ? <ToggleRight className="w-4 h-4 text-green-600" />
                      : <ToggleLeft className="w-4 h-4 text-gray-400" />
                    }
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => { setSelectedDoctor(doc); setIsDeleteOpen(true); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
          </DialogHeader>
          {editDoc && (
            <DoctorForm
              values={editDoc}
              setValues={setEditDoc}
              onSubmit={handleEdit}
              onCancel={() => setIsEditOpen(false)}
              submitLabel="Save Changes"
              isSaving={isSaving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Doctor</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate <strong>{selectedDoctor?.name}</strong>?
              They won't be bookable for new appointments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Doctors;
