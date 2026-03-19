import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';

interface LoginForm {
    email: string;
    password: string;
}

interface LoginEmployee {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'EMPLOYEE';
    department?: string | null;
    isSuperAdmin?: boolean;
}

interface LoginResponseEnvelope {
    success: boolean;
    message: string;
    data: {
        token: string;
        employee: LoginEmployee;
    };
}

export const Login: React.FC = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [apiError, setApiError] = useState('');
    const [unverifiedEmail, setUnverifiedEmail] = useState(''); // email that needs verification
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState('');

    const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginForm>();
    const navigate = useNavigate();
    const setAuth = useAuthStore(state => state.setAuth);

    const onSubmit = async (formData: LoginForm) => {
        try {
            setApiError('');
            setUnverifiedEmail('');
            setResendMsg('');

            const payload = await api.post<any, LoginResponseEnvelope>('/auth/login', formData);

            const token = payload?.data?.token;
            const employee = payload?.data?.employee;

            if (!token || !employee) {
                setApiError('Unexpected response from server. Please try again.');
                return;
            }

            setAuth(employee, token);

            if (employee.role === 'ADMIN') {
                navigate('/admin/dashboard', { replace: true });
            } else {
                navigate('/employee/dashboard', { replace: true });
            }
        } catch (err: any) {
            const message = err.response?.data?.error || err.message || 'Invalid credentials.';

            // Detect unverified email error — show resend option
            if (message.toLowerCase().includes('verify your email')) {
                setUnverifiedEmail(getValues('email'));
                setApiError(message);
            } else {
                setApiError(message);
            }
        }
    };

    // ── Resend OTP from login page ────────────────────────────────────────────
    const handleResendOtp = async () => {
        if (!unverifiedEmail) return;
        try {
            setResending(true);
            setResendMsg('');
            await api.post('/auth/resend-otp', { email: unverifiedEmail });
            setResendMsg('OTP sent! Check your email then verify at the register page.');
        } catch (err: any) {
            setResendMsg(err.response?.data?.error || 'Failed to resend OTP.');
        } finally {
            setResending(false);
        }
    };

    return (
        <Card className="w-full shadow-2xl shadow-black/50 border-white/10 backdrop-blur-2xl bg-[#0a0a0f]/80">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Sign In</h2>

            {/* Main error */}
            {apiError && (
                <div className="mb-4 p-3 rounded-lg bg-[#f43f5e]/10 border border-[#f43f5e]/30 text-[#f43f5e] text-sm text-center font-medium">
                    {apiError}
                </div>
            )}

            {/* Unverified email — show verify prompt */}
            {unverifiedEmail && (
                <div className="mb-4 p-4 rounded-lg bg-[#f7b731]/10 border border-[#f7b731]/30 text-center space-y-2">
                    <p className="text-[#f7b731] text-xs font-bold">Email not verified</p>
                    <p className="text-gray-400 text-xs">
                        Didn't get the OTP?
                    </p>
                    <button
                        onClick={handleResendOtp}
                        disabled={resending}
                        className="text-[#6c63ff] text-xs font-bold hover:underline disabled:opacity-50"
                    >
                        {resending ? 'Sending…' : 'Resend OTP to my email'}
                    </button>
                    {resendMsg && (
                        <p className="text-[#43e97b] text-xs font-bold">{resendMsg}</p>
                    )}
                    <p className="text-gray-600 text-[10px]">
                        Then go to{' '}
                        <Link to="/register" className="text-[#06b6d4] hover:underline">Register page</Link>
                        {' '}to enter the OTP.
                    </p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
                    <Input
                        type="email"
                        placeholder="you@company.com"
                        {...register('email', { required: 'Email is required' })}
                        error={errors.email?.message}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                    <div className="relative">
                        <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...register('password', { required: 'Password is required' })}
                            error={errors.password?.message}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(prev => !prev)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-white transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full bg-[#7c3aed] hover:bg-[#6d28d9]"
                    isLoading={isSubmitting}
                >
                    Sign In to Workspace
                </Button>

                <p className="text-center text-sm text-gray-400 mt-4">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-[#06b6d4] hover:underline font-medium">
                        Register
                    </Link>
                </p>
            </form>
        </Card>
    );
};