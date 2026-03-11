import { useEffect, useState } from 'react';
import { clinicAPI, authAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Bell,
  Lock,
  Clock,
  Link as LinkIcon,
  Copy,
  CheckCircle
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const Settings = () => {
  const { clinic } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await clinicAPI.getSettings();
      if (response.data.success) {
        setSettings(response.data.data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setIsSaving(true);
      const response = await clinicAPI.updateNotifications({
        sms_enabled: settings.sms_enabled,
        whatsapp_enabled: settings.whatsapp_enabled,
        google_review_link: settings.google_review_link
      });

      if (response.data.success) {
        toast.success('Notification settings saved');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWorkingHours = async () => {
    try {
      setIsSaving(true);
      const response = await clinicAPI.updateWorkingHours({
        working_hours_start: settings.working_hours_start,
        working_hours_end: settings.working_hours_end,
        working_days: JSON.parse(settings.working_days || '[1,2,3,4,5,6]')
      });

      if (response.data.success) {
        toast.success('Working hours saved');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setIsSaving(true);
      const response = await authAPI.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });

      if (response.data.success) {
        toast.success('Password changed successfully');
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const copyBookingLink = () => {
    const link = `${window.location.origin}/book/${clinic?.clinic_id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Booking link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const bookingLink = `${window.location.origin}/book/${clinic?.clinic_id}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your clinic settings and preferences</p>
      </div>

      {/* Public Booking Link */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <LinkIcon className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Public Booking Link</h3>
          </div>
          <p className="text-blue-100 mb-4">
            Share this link with your patients to allow them to book appointments online.
          </p>
          <div className="flex gap-3">
            <Input
              value={bookingLink}
              readOnly
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
            <Button
              variant="secondary"
              onClick={copyBookingLink}
              className="shrink-0"
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">SMS Notifications</h4>
                  <p className="text-sm text-gray-500">Send appointment reminders via SMS</p>
                </div>
                <Switch
                  checked={settings?.sms_enabled || false}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, sms_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">WhatsApp Notifications</h4>
                  <p className="text-sm text-gray-500">Send appointment reminders via WhatsApp</p>
                </div>
                <Switch
                  checked={settings?.whatsapp_enabled || false}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, whatsapp_enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Google Review Link</Label>
                <Input
                  placeholder="https://g.page/..."
                  value={settings?.google_review_link || ''}
                  onChange={(e) => setSettings({ ...settings, google_review_link: e.target.value })}
                />
                <p className="text-sm text-gray-500">
                  This link will be sent to patients after their appointment
                </p>
              </div>

              <Button onClick={handleSaveNotifications} disabled={isSaving}>
                {isSaving ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="working-hours">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Working Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Opening Time</Label>
                  <Input
                    type="time"
                    value={settings?.working_hours_start || '09:00'}
                    onChange={(e) => setSettings({ ...settings, working_hours_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Closing Time</Label>
                  <Input
                    type="time"
                    value={settings?.working_hours_end || '18:00'}
                    onChange={(e) => setSettings({ ...settings, working_hours_end: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={handleSaveWorkingHours} disabled={isSaving}>
                {isSaving ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Spinner className="w-4 h-4 mr-2" /> : null}
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
