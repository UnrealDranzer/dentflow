import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { patientsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Plus,
  Phone,
  Mail,
  Calendar,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { handlePhoneInput, isValidPhone, normalizePhone, formatPhoneDisplay, PHONE_ERROR_MESSAGE } from '@/lib/phoneValidation';
import { Skeleton } from '@/components/ui/skeleton';
interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  last_visit?: string;
  total_visits: number;
  created_at: string;
}

const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', phone: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const response = await patientsAPI.getAll();
      if (response.data.success) setPatients(response.data.data.patients);
    } catch (error) {
      console.error('Failed to fetch patients:', error);
      toast.error('Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (newPatient.phone && !isValidPhone(newPatient.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    setPhoneError('');
    try {
      setIsSubmitting(true);
      const response = await patientsAPI.create({
        ...newPatient,
        phone: normalizePhone(newPatient.phone) || newPatient.phone,
      });
      if (response.data.success) {
        toast.success('Patient added successfully');
        setNewPatient({ name: '', phone: '', email: '' });
        setIsAddDialogOpen(false);
        fetchPatients();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery) ||
    patient.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-11 sm:h-9 w-32" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            {/* Desktop Table Skeleton */}
            <div className="hidden sm:block overflow-x-auto">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 border-b pb-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <Skeleton className="h-6 flex-1" />
                    <Skeleton className="h-6 flex-1" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile Card Skeleton */}
            <div className="sm:hidden space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500">Manage your patient records</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 sm:h-9">
              <Plus className="w-4 h-4 mr-2" />
              Add Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
              <DialogDescription>Enter the patient details below.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPatient}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    value={newPatient.phone}
                    onChange={(e) => {
                      const cleaned = handlePhoneInput(e.target.value);
                      setNewPatient({ ...newPatient, phone: cleaned });
                      setPhoneError(cleaned.length > 0 && cleaned.length < 10 ? PHONE_ERROR_MESSAGE : '');
                    }}
                    required
                  />
                  {phoneError && <p className="text-sm text-red-500">{phoneError}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={newPatient.email}
                    onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Patient'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search patients by name, phone, or email..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients Table / Cards */}
      <Card>
        <CardHeader>
          <CardTitle>All Patients ({filteredPatients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPatients.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No patients found</p>
              {searchQuery && <p className="text-sm">Try adjusting your search</p>}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Last Visit</TableHead>
                      <TableHead>Total Visits</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold">
                                {(patient.name || 'Unknown').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{patient.name}</p>
                              <p className="text-sm text-gray-500">Added {formatDate(patient.created_at)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {formatPhoneDisplay(patient.phone)}
                            </div>
                            {patient.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="w-3 h-3 text-gray-400" />
                                {patient.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(patient.last_visit)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={patient.total_visits > 0 ? 'default' : 'secondary'}>
                            {patient.total_visits} visits
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/patients/${patient.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="sm:hidden space-y-3">
                {filteredPatients.map((patient) => (
                  <Link
                    key={patient.id}
                    to={`/patients/${patient.id}`}
                    className="block p-4 bg-gray-50 rounded-lg border border-gray-100 active:bg-gray-100 transition-colors"
                  >

                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-semibold text-sm">
                          {(patient.name || 'Unknown').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">Visits: {patient.total_visits}</p>
                      </div>
                      <Badge
                        variant={patient.total_visits > 0 ? 'default' : 'secondary'}
                        className="text-[10px] h-5 flex-shrink-0"
                      >
                        {patient.total_visits}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{formatPhoneDisplay(patient.phone)}</span>
                      </div>
                      {patient.last_visit && (
                        <div className="flex items-center gap-1.5 justify-end truncate">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{formatDate(patient.last_visit)}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Patients;
