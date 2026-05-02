import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  EnvelopeIcon,
  PhoneIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const phoneSchema = z.object({
  phone: z.string().min(10, 'Please enter a valid phone number'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const resetSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type EmailForm = z.infer<typeof emailSchema>;
type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm = z.infer<typeof otpSchema>;
type ResetForm = z.infer<typeof resetSchema>;

export default function ForgotPassword() {
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [step, setStep] = useState<'input' | 'otp' | 'reset' | 'success'>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactInfo, setContactInfo] = useState('');
  const [resetToken, setResetToken] = useState('');

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
  });

  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
  });

  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  const handleSendReset = async (data: EmailForm | PhoneForm) => {
    setIsLoading(true);
    setError(null);

    try {
      if (method === 'email') {
        const emailData = data as EmailForm;
        await api.post('/auth/forgot-password', { email: emailData.email });
        setContactInfo(emailData.email);
        setStep('success'); // Email sends a link, not OTP
      } else {
        const phoneData = data as PhoneForm;
        await api.post('/auth/forgot-password/phone', { phone: phoneData.phone });
        setContactInfo(phoneData.phone);
        setStep('otp'); // Phone sends OTP
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/verify-reset-otp', {
        phone: contactInfo,
        otp: data.otp,
      });
      setResetToken(response.data.resetToken);
      setStep('reset');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (data: ResetForm) => {
    setIsLoading(true);
    setError(null);

    try {
      await api.post('/auth/reset-password', {
        token: resetToken,
        password: data.password,
      });
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await api.post('/auth/forgot-password/phone', { phone: contactInfo });
      setError(null);
    } catch (err: any) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card p-8 max-w-md w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Back Link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to login
        </Link>

        {/* Logo & Title */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <span className="text-3xl font-display font-bold text-gradient">JetMed</span>
          </Link>
          
          {step === 'input' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot password?</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                No worries, we'll send you reset instructions
              </p>
            </>
          )}
          
          {step === 'otp' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Enter OTP</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                We sent a 6-digit code to {contactInfo}
              </p>
            </>
          )}
          
          {step === 'reset' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set new password</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Your new password must be different from previous passwords
              </p>
            </>
          )}
          
          {step === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {method === 'email' ? 'Check your email' : 'Password reset successful'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {method === 'email'
                  ? `We sent a password reset link to ${contactInfo}`
                  : 'Your password has been successfully reset'}
              </p>
            </>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3"
          >
            <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </motion.div>
        )}

        {/* Step: Input (Email or Phone) */}
        {step === 'input' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {/* Method Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => setMethod('email')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  method === 'email'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setMethod('phone')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  method === 'phone'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Phone
              </button>
            </div>

            {method === 'email' ? (
              <form onSubmit={emailForm.handleSubmit(handleSendReset)}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      {...emailForm.register('email')}
                      type="email"
                      className={`input pl-10 ${emailForm.formState.errors.email ? 'border-red-500' : ''}`}
                      placeholder="Enter your email"
                    />
                  </div>
                  {emailForm.formState.errors.email && (
                    <p className="mt-1 text-sm text-red-500">{emailForm.formState.errors.email.message}</p>
                  )}
                </div>

                <button type="submit" disabled={isLoading} className="btn-primary w-full">
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={phoneForm.handleSubmit(handleSendReset)}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone number
                  </label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      {...phoneForm.register('phone')}
                      type="tel"
                      className={`input pl-10 ${phoneForm.formState.errors.phone ? 'border-red-500' : ''}`}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  {phoneForm.formState.errors.phone && (
                    <p className="mt-1 text-sm text-red-500">{phoneForm.formState.errors.phone.message}</p>
                  )}
                </div>

                <button type="submit" disabled={isLoading} className="btn-primary w-full">
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending OTP...
                    </span>
                  ) : (
                    'Send OTP'
                  )}
                </button>
              </form>
            )}
          </motion.div>
        )}

        {/* Step: OTP Verification */}
        {step === 'otp' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Enter 6-digit OTP
                </label>
                <div className="relative">
                  <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...otpForm.register('otp')}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className={`input pl-10 text-center text-2xl tracking-widest ${
                      otpForm.formState.errors.otp ? 'border-red-500' : ''
                    }`}
                    placeholder="000000"
                  />
                </div>
                {otpForm.formState.errors.otp && (
                  <p className="mt-1 text-sm text-red-500">{otpForm.formState.errors.otp.message}</p>
                )}
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full mb-4">
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Didn't receive the code?{' '}
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={isLoading}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Resend
                </button>
              </p>
            </form>
          </motion.div>
        )}

        {/* Step: Reset Password */}
        {step === 'reset' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <form onSubmit={resetForm.handleSubmit(handleResetPassword)}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password
                  </label>
                  <input
                    {...resetForm.register('password')}
                    type="password"
                    className={`input ${resetForm.formState.errors.password ? 'border-red-500' : ''}`}
                    placeholder="••••••••"
                  />
                  {resetForm.formState.errors.password && (
                    <p className="mt-1 text-sm text-red-500">{resetForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    {...resetForm.register('confirmPassword')}
                    type="password"
                    className={`input ${resetForm.formState.errors.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="••••••••"
                  />
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-500">{resetForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </motion.div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Link to="/login" className="btn-primary w-full text-center">
              Back to login
            </Link>

            {method === 'email' && (
              <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                Didn't receive the email?{' '}
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Try again
                </button>
              </p>
            )}
          </motion.div>
        )}

        {/* Sign Up Link */}
        {step === 'input' && (
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign up
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
