import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';

interface RegisterForm {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

type Step = 'register' | 'verify';

export const Register: React.FC = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [apiError, setApiError] = useState('');
    const [step, setStep] = useState<Step>('register');
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterForm>();
    const navigate = useNavigate();
    const password = watch('password');

    // ── Step 1: Register ──────────────────────────────────────────────────────
    const onSubmit = async (data: RegisterForm) => {
        try {
            setApiError('');
            await api.post('/auth/register', {
                name: data.name,
                email: data.email,
                password: data.password,
            });
            setRegisteredEmail(data.email);
            setStep('verify');
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Registration failed';
            // If account exists but unverified, still go to verify step
            if (err.response?.data?.data?.requiresVerification) {
                setRegisteredEmail(data.email);
                setStep('verify');
                return;
            }
            setApiError(msg);
        }
    };

    // ── Step 2: Verify OTP ────────────────────────────────────────────────────
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp.trim() || otp.length !== 6) {
            setVerifyError('Please enter the 6-digit OTP from your email.');
            return;
        }
        try {
            setVerifying(true);
            setVerifyError('');
            await api.post('/auth/verify-email', { email: registeredEmail, otp: otp.trim() });
            setSuccessMsg('Email verified! Redirecting to login…');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err: any) {
            setVerifyError(err.response?.data?.error || 'Invalid OTP. Please try again.');
        } finally {
            setVerifying(false);
        }
    };

    // ── Resend OTP ────────────────────────────────────────────────────────────
    const handleResend = async () => {
        try {
            setResending(true);
            setVerifyError('');
            await api.post('/auth/resend-otp', { email: registeredEmail });
            setSuccessMsg('A new OTP has been sent to your email!');
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err: any) {
            setVerifyError(err.response?.data?.error || 'Failed to resend OTP.');
        } finally {
            setResending(false);
        }
    };

    // ── OTP Verification Screen ───────────────────────────────────────────────
    if (step === 'verify') {
        return (
            <Card className="w-full shadow-2xl shadow-black/50 border-white/10 backdrop-blur-2xl bg-[#0a0a0f]/80">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#6c63ff]/10 flex items-center justify-center text-3xl mx-auto mb-4">
                        📧
                    </div>
                    <h2 className="text-2xl font-bold text-white">Verify your email</h2>
                    <p className="text-gray-400 text-sm mt-2">
                        We sent a 6-digit OTP to
                    </p>
                    <p className="text-[#6c63ff] font-bold text-sm mt-1">{registeredEmail}</p>
                </div>

                {successMsg && (
                    <div className="mb-4 p-3 rounded-lg bg-[#43e97b]/10 border border-[#43e97b]/30 text-[#43e97b] text-sm text-center font-medium">
                        {successMsg}
                    </div>
                )}
                {verifyError && (
                    <div className="mb-4 p-3 rounded-lg bg-[#f43f5e]/10 border border-[#f43f5e]/30 text-[#f43f5e] text-sm text-center">
                        {verifyError}
                    </div>
                )}

                <form onSubmit={handleVerify} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                            Enter the 6-digit OTP
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={e => {
                                const val = e.target.value.replace(/\D/g, '');
                                setOtp(val);
                                setVerifyError('');
                            }}
                            placeholder="000000"
                            className="w-full text-center text-3xl font-bold tracking-[0.5em] bg-[#111420] border border-[#1f2540] rounded-xl px-4 py-4 text-[#6c63ff] focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all"
                        />
                        <p className="text-[10px] text-gray-600 text-center mt-2">
                            OTP expires in 10 minutes
                        </p>
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-[#6c63ff] hover:bg-[#5b54d6]"
                        isLoading={verifying}
                        disabled={otp.length !== 6}
                    >
                        <i className="fa-solid fa-circle-check mr-2"></i>
                        Verify Email
                    </Button>
                </form>

                <div className="mt-5 text-center space-y-3">
                    <p className="text-gray-500 text-sm">Didn't receive the OTP?</p>
                    <button
                        onClick={handleResend}
                        disabled={resending}
                        className="text-[#6c63ff] hover:underline text-sm font-bold disabled:opacity-50"
                    >
                        {resending ? 'Sending…' : 'Resend OTP'}
                    </button>
                    <p className="text-gray-600 text-xs">
                        Wrong email?{' '}
                        <button onClick={() => { setStep('register'); setOtp(''); setVerifyError(''); }}
                            className="text-[#06b6d4] hover:underline">
                            Go back
                        </button>
                    </p>
                </div>
            </Card>
        );
    }

    // ── Registration Form ─────────────────────────────────────────────────────
    return (
        <Card className="w-full shadow-2xl shadow-black/50 border-white/10 backdrop-blur-2xl bg-[#0a0a0f]/80">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Create Account</h2>

            {apiError && (
                <div className="mb-4 p-3 rounded-lg bg-[#f43f5e]/10 border border-[#f43f5e]/30 text-[#f43f5e] text-sm text-center">
                    {apiError}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                    <Input
                        placeholder="John Doe"
                        {...register('name', { required: 'Name is required' })}
                        error={errors.name?.message}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <Input
                        type="email"
                        placeholder="you@company.com"
                        {...register('email', {
                            required: 'Email is required',
                            pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email address' },
                        })}
                        error={errors.email?.message}
                    />
                    <p className="text-[10px] text-gray-600 mt-1">
                        A verification OTP will be sent to this email.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                    <div className="relative">
                        <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...register('password', {
                                required: 'Password is required',
                                minLength: { value: 6, message: 'Minimum 6 characters' },
                            })}
                            error={errors.password?.message}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-white transition-colors">
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                    <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...register('confirmPassword', {
                            required: 'Please confirm your password',
                            validate: value => value === password || 'Passwords do not match',
                        })}
                        error={errors.confirmPassword?.message}
                    />
                </div>

                <Button type="submit" className="w-full bg-[#6c63ff] hover:bg-[#5b54d6]" isLoading={isSubmitting}>
                    <i className="fa-solid fa-paper-plane mr-2"></i>
                    Register & Send OTP
                </Button>

                <p className="text-center text-sm text-gray-400 mt-4">
                    Already have an account?{' '}
                    <Link to="/login" className="text-[#06b6d4] hover:underline font-medium">Login</Link>
                </p>
            </form>
        </Card>
    );
};