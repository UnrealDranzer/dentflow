import { Outlet } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 flex-col justify-center items-center text-white p-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center">
            <Stethoscope className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold">DentFlow</h1>
        </div>
        <p className="text-xl text-blue-100 text-center max-w-md">
          Modern dental clinic management system. Streamline appointments, manage patients, and grow your practice.
        </p>
        <div className="mt-12 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold">10K+</div>
            <div className="text-blue-200">Appointments</div>
          </div>
          <div>
            <div className="text-3xl font-bold">500+</div>
            <div className="text-blue-200">Clinics</div>
          </div>
          <div>
            <div className="text-3xl font-bold">50K+</div>
            <div className="text-blue-200">Patients</div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
