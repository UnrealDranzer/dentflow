import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, CheckCircle, ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { handlePhoneInput, isValidPhone, normalizePhone, PHONE_ERROR_MESSAGE } from '@/lib/phoneValidation';

type Step = 'form' | 'otp' | 'success';

const Register = () => {
  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({
    clinic_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  // Focus OTP input when step changes
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const cleaned = handlePhoneInput(value);
      setFormData(prev => ({ ...prev, phone: cleaned }));
      setPhoneError(cleaned.length > 0 && cleaned.length < 10 ? PHONE_ERROR_MESSAGE : '');
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (formData.phone && !isValidPhone(formData.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.sendRegisterOtp({
        clinic_name: formData.clinic_name,
        email: formData.email,
        phone: normalizePhone(formData.phone) || formData.phone,
        password: formData.password,
      });
      
      if (response.data.success) {
        toast.success('Verification code sent to your email');
        setStep('otp');
        setResendTimer(30);
      } else {
        setError(response.data.message || 'Failed to send verification code');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.verifyRegisterOtp({
        email: formData.email,
        otp,
      });
      
      if (response.data.success) {
        const { clinic, token } = response.data.data;
        setAuth(clinic, token);
        setStep('success');
        toast.success('Account created successfully!');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setError(response.data.message || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setError('');
    
    try {
      const response = await authAPI.resendRegisterOtp({ email: formData.email });
      if (response.data.success) {
        toast.success('New verification code sent');
        setResendTimer(30);
        setOtp('');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code');
    }
  };

  // ─── SUCCESS STATE ──────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-gray-500">Redirecting to your dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  // ─── OTP VERIFICATION STEP ─────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <button 
              onClick={() => { setStep('form'); setError(''); setOtp(''); }}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <CardTitle className="text-2xl font-bold">Verify your email</CardTitle>
          </div>
          <CardDescription>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              We sent a 6-digit code to <strong className="text-gray-700">{formData.email}</strong>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                ref={otpInputRef}
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                required
                disabled={isLoading}
                autoComplete="one-time-code"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Create Account'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-gray-500">Didn't receive the code? </span>
            <button
              onClick={handleResendOtp}
              disabled={resendTimer > 0}
              className={`font-medium ${resendTimer > 0 ? 'text-gray-400' : 'text-blue-600 hover:underline'}`}
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </button>
          </div>

          <div className="mt-2 text-center">
            <button
              onClick={() => { setStep('form'); setError(''); setOtp(''); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Change email or details
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── REGISTRATION FORM (STEP 1) ────────────────────────────────────────────
  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Start managing your dental clinic with DentFlow
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinic_name">Clinic Name</Label>
            <Input
              id="clinic_name"
              name="clinic_name"
              placeholder="Dr. Smith's Dental Care"
              value={formData.clinic_name}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="dr@clinic.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              value={formData.phone}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
            {phoneError && (
              <p className="text-sm text-red-500">{phoneError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending verification code...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-500">Already have an account? </span>
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default Register;
