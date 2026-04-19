import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Mail, CheckCircle, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'email' | 'otp' | 'reset' | 'success';

const ForgotPassword = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [step]);

  // ─── STEP 1: Send OTP ───────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authAPI.sendForgotPasswordOtp({ email });
      if (response.data.success) {
        toast.success('If the email exists, a reset code has been sent');
        setStep('otp');
        setResendTimer(30);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── STEP 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.verifyForgotPasswordOtp({ email, otp });
      if (response.data.success) {
        setResetToken(response.data.resetToken);
        setStep('reset');
        toast.success('Code verified. Set your new password.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid reset code');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── STEP 3: Reset Password ────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.resetPassword({
        email,
        newPassword,
        resetToken,
      });
      if (response.data.success) {
        setStep('success');
        toast.success('Password reset successfully!');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setError('');
    try {
      await authAPI.sendForgotPasswordOtp({ email });
      toast.success('New reset code sent');
      setResendTimer(30);
      setOtp('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code');
    }
  };

  // ─── SUCCESS ────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
          <p className="text-gray-500 mb-6">Your password has been changed successfully.</p>
          <Link to="/login">
            <Button className="w-full">Back to Login</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // ─── STEP 3: NEW PASSWORD ──────────────────────────────────────────────────
  if (step === 'reset') {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <KeyRound className="w-5 h-5 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
          </div>
          <CardDescription>
            Create a strong password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // ─── STEP 2: OTP VERIFICATION ──────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <button 
              onClick={() => { setStep('email'); setError(''); setOtp(''); }}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          </div>
          <CardDescription>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              We sent a reset code to <strong className="text-gray-700">{email}</strong>
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
              <Label htmlFor="otp">Reset Code</Label>
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

            <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
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
        </CardContent>
      </Card>
    );
  }

  // ─── STEP 1: EMAIL INPUT ───────────────────────────────────────────────────
  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/login" className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <CardTitle className="text-2xl font-bold">Forgot password?</CardTitle>
        </div>
        <CardDescription>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Enter your email and we'll send you a reset code
          </div>
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
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="dr@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Reset Code'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            ← Back to Login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default ForgotPassword;
