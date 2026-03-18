import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/services/api';

// Layouts
const DashboardLayout = lazy(() => import('@/layouts/DashboardLayout'));
const AuthLayout = lazy(() => import('@/layouts/AuthLayout'));

// Pages
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Patients = lazy(() => import('@/pages/patients/Patients'));
const PatientDetail = lazy(() => import('@/pages/patients/PatientDetail'));
const Services = lazy(() => import('@/pages/services/Services'));
const Appointments = lazy(() => import('@/pages/appointments/Appointments'));
const AppointmentDetail = lazy(() => import('@/pages/appointments/AppointmentDetail'));
const NewAppointment = lazy(() => import('@/pages/appointments/NewAppointment'));
const Analytics = lazy(() => import('@/pages/analytics/Analytics'));
const Settings = lazy(() => import('@/pages/settings/Settings'));
const PublicBooking = lazy(() => import('@/pages/public/PublicBooking'));
const Doctors = lazy(() => import('@/pages/doctors/Doctors'));

// Components
import { Toaster } from '@/components/ui/sonner';
import { Spinner } from '@/components/ui/spinner';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirects to dashboard if authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { setAuth, logout, setLoading } = useAuthStore();

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = useAuthStore.getState().token;
      
      if (token) {
        try {
          const response = await authAPI.getMe();
          if (response.data.success) {
            setAuth(response.data.data.clinic, token);
          } else {
            logout();
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          logout();
        }
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [setAuth, logout, setLoading]);

  return (
    <Router>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Spinner className="w-8 h-8" /></div>}>
        <Routes>
          {/* Public Booking Route */}
          <Route path="/book/:clinicSlug" element={<PublicBooking />} />
          
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />
          </Route>
  
          {/* Protected Dashboard Routes */}
          <Route 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/services" element={<Services />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/appointments/new" element={<NewAppointment />} />
            <Route path="/appointments/:id" element={<AppointmentDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
  
          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" />
    </Router>
  );
}

export default App;
