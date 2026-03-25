import { useEffect, useState } from 'react';
import { servicesAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
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
import { Textarea } from '@/components/ui/textarea';

import {
  Plus,
  Clock,
  IndianRupee,
  Edit,
  Trash2,
  Stethoscope
} from 'lucide-react';
import { toast } from 'sonner';

interface Service {
  service_id: number;
  service_name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  color_code: string;
  is_active: boolean;
}

const Services = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [newService, setNewService] = useState({
    service_name: '',
    description: '',
    duration_minutes: 30,
    price: 0,
    color_code: '#3B82F6'
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setIsLoading(true);
      const response = await servicesAPI.getAll({ active_only: false });
      if (response.data.success) {
        setServices(response.data.data.services);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
      toast.error('Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await servicesAPI.create(newService);
      if (response.data.success) {
        toast.success('Service added successfully');
        setNewService({
          service_name: '',
          description: '',
          duration_minutes: 30,
          price: 0,
          color_code: '#3B82F6'
        });
        setIsAddDialogOpen(false);
        fetchServices();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add service');
    }
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    try {
      const response = await servicesAPI.update(selectedService.service_id, {
        service_name: selectedService.service_name,
        description: selectedService.description,
        duration_minutes: selectedService.duration_minutes,
        price: selectedService.price,
        color_code: selectedService.color_code,
        is_active: selectedService.is_active
      });
      if (response.data.success) {
        toast.success('Service updated successfully');
        setIsEditDialogOpen(false);
        fetchServices();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update service');
    }
  };

  const handleDeleteService = async () => {
    if (!selectedService) return;

    try {
      const response = await servicesAPI.delete(selectedService.service_id);
      if (response.data.success) {
        toast.success('Service deleted successfully');
        setIsDeleteDialogOpen(false);
        fetchServices();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete service');
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-500">Manage your dental services and treatments</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Service</DialogTitle>
              <DialogDescription>
                Add a new dental service or treatment.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddService}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="service_name">Service Name *</Label>
                  <Input
                    id="service_name"
                    placeholder="Teeth Cleaning"
                    value={newService.service_name}
                    onChange={(e) => setNewService({ ...newService, service_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the service"
                    value={newService.description}
                    onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={5}
                      max={480}
                      value={newService.duration_minutes || 0}
                      onChange={(e) => setNewService({ ...newService, duration_minutes: parseInt(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (₹) *</Label>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      value={newService.price || 0}
                      onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color Code</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="color"
                      type="color"
                      value={newService.color_code}
                      onChange={(e) => setNewService({ ...newService, color_code: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={newService.color_code}
                      onChange={(e) => setNewService({ ...newService, color_code: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Service</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <Card key={service.service_id} className={!service.is_active ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: service.color_code }}
                  >
                    <Stethoscope className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{service.service_name}</CardTitle>
                    {!service.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                {service.description || 'No description'}
              </p>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  {service.duration_minutes} min
                </div>
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                  <IndianRupee className="w-4 h-4" />
                  {service.price.toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedService(service);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-red-600 hover:text-red-700"
                  onClick={() => {
                    setSelectedService(service);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {services.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Stethoscope className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No services added yet</p>
          <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
            Add Your First Service
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>
          {selectedService && (
            <form onSubmit={handleUpdateService}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Service Name</Label>
                  <Input
                    value={selectedService.service_name}
                    onChange={(e) => setSelectedService({ ...selectedService, service_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={selectedService.description || ''}
                    onChange={(e) => setSelectedService({ ...selectedService, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={selectedService.duration_minutes || 0}
                      onChange={(e) => setSelectedService({ ...selectedService, duration_minutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price (₹)</Label>
                    <Input
                      type="number"
                      value={selectedService.price || 0}
                      onChange={(e) => setSelectedService({ ...selectedService, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color Code</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={selectedService.color_code}
                      onChange={(e) => setSelectedService({ ...selectedService, color_code: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={selectedService.color_code}
                      onChange={(e) => setSelectedService({ ...selectedService, color_code: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={selectedService.is_active}
                    onChange={(e) => setSelectedService({ ...selectedService, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedService?.service_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteService}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Services;
