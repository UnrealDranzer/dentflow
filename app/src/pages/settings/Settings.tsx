import { useEffect, useState } from 'react';
import { clinicAPI, systemAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { handlePhoneInput, isValidPhone, normalizePhone, PHONE_ERROR_MESSAGE } from '@/lib/phoneValidation';
import {
  Building2, Clock, Bell, Shield, Copy, ExternalLink, CheckCircle2, Server, Coffee
} from 'lucide-react';

const DAYS = [
  { val: 0, label: 'Sunday' },
  { val: 1, label: 'Monday' },
  { val: 2, label: 'Tuesday' },
  { val: 3, label: 'Wednesday' },
  { val: 4, label: 'Thursday' },
  { val: 5, label: 'Friday' },
  { val: 6, label: 'Saturday' },
];

const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Profile tab
  const [profile, setProfile] = useState({
    clinic_name: '', clinic_slug: '', phone: '', address: '',
    city: '', state: '', country: '', postal_code: '',
    website: '', google_review_link: '', timezone: 'Asia/Kolkata',
  });

  // Working hours tab
  const [workingHours, setWorkingHours] = useState({
    working_hours_start: '09:00',
    working_hours_end:   '18:00',
    working_days:        [1, 2, 3, 4, 5, 6] as number[],
    slot_interval_minutes: 30,
    break_start: '',
    break_end: '',
  });

  // Notifications tab
  const [notifications, setNotifications] = useState({
    sms_enabled:       false,
    whatsapp_enabled:  false,
    google_review_link: '',
  });

  // Security tab
  const [passwords, setPasswords] = useState({
    current_password: '', new_password: '', confirm_password: '',
  });

  // System Billing
  const [isBillingEnabled, setIsBillingEnabled] = useState(true);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await clinicAPI.getSettings();
      if (res.data.success) {
        const payload = res.data.data || {};
        const c = payload.settings || payload.clinic || {};
        
        setProfile({
          clinic_name:        c.name               || c.clinic_name        || '',
          clinic_slug:        c.booking_slug       || c.clinic_slug        || '',
          phone:              c.phone              || '',
          address:            c.address            || '',
          city:               c.city               || '',
          state:              c.state              || '',
          country:            c.country            || '',
          postal_code:        c.postal_code        || '',
          website:            c.website            || '',
          google_review_link: c.google_review_link || '',
          timezone:           c.timezone           || 'Asia/Kolkata',
        });

        let wd = c.working_days;
        if (typeof wd === 'string') { try { wd = JSON.parse(wd); } catch { wd = [1,2,3,4,5,6]; } }
        if (!Array.isArray(wd)) wd = [1,2,3,4,5,6];

        setWorkingHours({
          working_hours_start:   c.working_hours_start   ? String(c.working_hours_start).slice(0,5) : '09:00',
          working_hours_end:     c.working_hours_end     ? String(c.working_hours_end).slice(0,5)   : '18:00',
          working_days:          wd.map(Number),
          slot_interval_minutes: c.slot_interval_minutes || 30,
          break_start:           c.break_start ? String(c.break_start).slice(0,5) : '',
          break_end:             c.break_end   ? String(c.break_end).slice(0,5)   : '',
        });

        setNotifications({
          sms_enabled:       !!c.sms_enabled,
          whatsapp_enabled:  !!c.whatsapp_enabled,
          google_review_link: c.google_review_link || '',
        });
      }
      
      const billingRes = await systemAPI.getBillingStatus();
      if (billingRes.data.success) {
        setIsBillingEnabled(billingRes.data.billing_enabled);
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    if (profile.phone && !isValidPhone(profile.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    setPhoneError('');
    try {
      setIsSaving(true);
      const res = await clinicAPI.updateProfile({
        ...profile,
        phone: profile.phone ? (normalizePhone(profile.phone) || profile.phone) : undefined,
      });
      if (res.data.success) toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper: convert HH:MM to readable AM/PM string
  const toAmPm = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const saveWorkingHours = async () => {
    // Validate break times
    if (workingHours.break_start && workingHours.break_end) {
      if (workingHours.break_start >= workingHours.break_end) {
        toast.error('Break start must be before break end');
        return;
      }
      if (workingHours.break_start < workingHours.working_hours_start ||
          workingHours.break_end > workingHours.working_hours_end) {
        toast.error('Break time must be within working hours');
        return;
      }
    } else if (workingHours.break_start || workingHours.break_end) {
      toast.error('Please set both break start and end times, or leave both empty');
      return;
    }

    try {
      setIsSaving(true);
      const res = await clinicAPI.updateWorkingHours(workingHours);
      if (res.data.success) toast.success('Working hours updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update working hours');
    } finally {
      setIsSaving(false);
    }
  };

  const saveNotifications = async () => {
    try {
      setIsSaving(true);
      const res = await clinicAPI.updateNotifications(notifications);
      if (res.data.success) toast.success('Notification settings updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update notifications');
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async () => {
    if (!passwords.current_password || !passwords.new_password) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (passwords.new_password !== passwords.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwords.new_password.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    try {
      setIsSaving(true);
      const res = await clinicAPI.changePassword({
        current_password: passwords.current_password,
        new_password:     passwords.new_password,
      });
      if (res.data.success) {
        toast.success('Password changed successfully');
        setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setWorkingHours(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort((a, b) => a - b)
    }));
  };

  const bookingUrl = `${window.location.origin}/book/${profile.clinic_slug || '[your-slug]'}`;

  const copyBookingLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast.success('Booking link copied!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your clinic settings and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="profile">
            <Building2 className="w-4 h-4 mr-1.5" />Profile
          </TabsTrigger>
          <TabsTrigger value="hours">
            <Clock className="w-4 h-4 mr-1.5" />Hours
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-1.5" />Notify
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-1.5" />Security
          </TabsTrigger>
          <TabsTrigger value="system">
            <Server className="w-4 h-4 mr-1.5" />System
          </TabsTrigger>
        </TabsList>

        {/* ── Profile Tab ─────────────────────────────────────────── */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Clinic Profile</CardTitle>
              <CardDescription>Update your clinic's public information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Clinic Name</Label>
                  <Input
                    value={profile.clinic_name}
                    onChange={e => setProfile({ ...profile, clinic_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Booking Slug</Label>
                  <Input
                    value={profile.clinic_slug}
                    onChange={e => setProfile({ ...profile, clinic_slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="my-clinic-name"
                  />
                  <p className="text-xs text-gray-500">Used in your public booking link</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={profile.phone}
                    onChange={e => {
                      const cleaned = handlePhoneInput(e.target.value);
                      setProfile({ ...profile, phone: cleaned });
                      setPhoneError(cleaned.length > 0 && cleaned.length < 10 ? PHONE_ERROR_MESSAGE : '');
                    }}
                    placeholder="9876543210"
                  />
                  {phoneError && <p className="text-sm text-red-500">{phoneError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} placeholder="https://yourclinic.com" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Address</Label>
                  <Input value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={profile.state} onChange={e => setProfile({ ...profile, state: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={profile.country} onChange={e => setProfile({ ...profile, country: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Postal Code</Label>
                  <Input value={profile.postal_code} onChange={e => setProfile({ ...profile, postal_code: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Google Review Link</Label>
                  <Input
                    value={profile.google_review_link}
                    onChange={e => setProfile({ ...profile, google_review_link: e.target.value })}
                    placeholder="https://g.page/r/..."
                  />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>

          {/* Public Booking Link */}
          {profile.clinic_slug && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-blue-800">Public Booking Link</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-white rounded px-3 py-2 border border-blue-200 text-blue-700 truncate">
                    {bookingUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyBookingLink}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Working Hours Tab ────────────────────────────────────── */}
        <TabsContent value="hours" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Working Hours</CardTitle>
              <CardDescription>Set clinic operating hours and open days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Open Days</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map(d => (
                    <button
                      key={d.val}
                      type="button"
                      onClick={() => toggleDay(d.val)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors font-medium ${
                        workingHours.working_days.includes(d.val)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {!workingHours.working_days.includes(new Date().getDay()) && (
                  <p className="text-sm text-amber-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Clinic is closed today
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Opening Time</Label>
                  <Input
                    type="time"
                    value={workingHours.working_hours_start}
                    onChange={e => setWorkingHours({ ...workingHours, working_hours_start: e.target.value })}
                  />
                  {workingHours.working_hours_start && (
                    <p className="text-xs text-gray-500">{toAmPm(workingHours.working_hours_start)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Closing Time</Label>
                  <Input
                    type="time"
                    value={workingHours.working_hours_end}
                    onChange={e => setWorkingHours({ ...workingHours, working_hours_end: e.target.value })}
                  />
                  {workingHours.working_hours_end && (
                    <p className="text-xs text-gray-500">{toAmPm(workingHours.working_hours_end)}</p>
                  )}
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Default Slot Interval (minutes)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={workingHours.slot_interval_minutes}
                    onChange={e => setWorkingHours({ ...workingHours, slot_interval_minutes: Number(e.target.value) })}
                  />
                </div>
              </div>

              <Button onClick={saveWorkingHours} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Working Hours'}
              </Button>
            </CardContent>
          </Card>

          {/* ── Break Time Card ──────────────────────────────────────── */}
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-600" />
                Clinic Break (Optional)
              </CardTitle>
              <CardDescription>
                Define a break period during working hours. Appointment slots will not be generated during this time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Break Start Time</Label>
                  <Input
                    type="time"
                    value={workingHours.break_start}
                    onChange={e => setWorkingHours({ ...workingHours, break_start: e.target.value })}
                    placeholder="e.g. 13:00"
                  />
                  {workingHours.break_start && (
                    <p className="text-xs text-gray-500">{toAmPm(workingHours.break_start)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Break End Time</Label>
                  <Input
                    type="time"
                    value={workingHours.break_end}
                    onChange={e => setWorkingHours({ ...workingHours, break_end: e.target.value })}
                    placeholder="e.g. 14:00"
                  />
                  {workingHours.break_end && (
                    <p className="text-xs text-gray-500">{toAmPm(workingHours.break_end)}</p>
                  )}
                </div>
              </div>
              {workingHours.break_start && workingHours.break_end && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <Coffee className="w-4 h-4 inline mr-1" />
                    Break: {toAmPm(workingHours.break_start)} — {toAmPm(workingHours.break_end)}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    No appointment slots will be available during this time.
                  </p>
                </div>
              )}
              {!workingHours.break_start && !workingHours.break_end && (
                <p className="text-sm text-gray-400 italic">No break configured — slots will be generated for the full working period.</p>
              )}
              <Button onClick={saveWorkingHours} disabled={isSaving} variant="outline">
                {isSaving ? 'Saving...' : 'Save Break Time'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications Tab ────────────────────────────────────── */}
        <TabsContent value="notifications" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure patient communication channels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">WhatsApp Notifications</p>
                  <p className="text-sm text-gray-500">Send appointment reminders via WhatsApp</p>
                </div>
                <Switch
                  checked={notifications.whatsapp_enabled}
                  onCheckedChange={v => setNotifications({ ...notifications, whatsapp_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">SMS Notifications</p>
                  <p className="text-sm text-gray-500">Send appointment reminders via SMS</p>
                </div>
                <Switch
                  checked={notifications.sms_enabled}
                  onCheckedChange={v => setNotifications({ ...notifications, sms_enabled: v })}
                />
              </div>

              <div className="space-y-2">
                <Label>Google Review Link</Label>
                <Input
                  value={notifications.google_review_link}
                  onChange={e => setNotifications({ ...notifications, google_review_link: e.target.value })}
                  placeholder="https://g.page/r/your-review-link"
                />
                <p className="text-xs text-gray-500">Included in post-appointment thank-you messages</p>
              </div>

              {(notifications.whatsapp_enabled || notifications.sms_enabled) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 font-medium">Configuration Required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    To send WhatsApp/SMS messages, configure your provider credentials in the backend <code className="bg-amber-100 px-1 rounded">.env</code> file
                    (WHATSAPP_ACCESS_TOKEN, TWILIO_AUTH_TOKEN, etc.).
                  </p>
                </div>
              )}

              <Button onClick={saveNotifications} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Notification Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Security Tab ─────────────────────────────────────────── */}
        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your clinic admin password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={passwords.current_password}
                  onChange={e => setPasswords({ ...passwords, current_password: e.target.value })}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={passwords.new_password}
                  onChange={e => setPasswords({ ...passwords, new_password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={passwords.confirm_password}
                  onChange={e => setPasswords({ ...passwords, confirm_password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <Button onClick={changePassword} disabled={isSaving}>
                {isSaving ? 'Changing...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── System Tab ─────────────────────────────────────────── */}
        <TabsContent value="system" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System & Billing Settings</CardTitle>
              <CardDescription>Global configuration for the application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-gray-900">Enable Billing System</h4>
                  <p className="text-sm text-gray-500">
                    When disabled, the platform enters 'Free Mode'. All users bypass subscriptions and 30-day trial checks.
                  </p>
                </div>
                <Switch
                  checked={isBillingEnabled}
                  onCheckedChange={async (val) => {
                    if (isSaving) return;
                    setIsSaving(true);
                    try {
                      const res = await systemAPI.updateBillingStatus({ billing_enabled: val });
                      if (res.data.success) {
                        setIsBillingEnabled(val);
                        toast.success(`Billing system is now ${val ? 'ON' : 'OFF'}`);
                      }
                    } catch (err) {
                      toast.error('Failed to update billing settings');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
