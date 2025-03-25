import { useForm } from 'react-hook-form';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import type { TError } from 'librechat-data-provider';
import type { TAuthContext } from '~/common';
import { ErrorMessage } from './ErrorMessage';
import { Spinner } from '~/components/svg';
import { useLocalize } from '~/hooks';

interface PhoneLoginFormData {
  phoneNumber: string;
  verificationCode: string;
}

type TPhoneLoginProps = {
  onSubmit: (data: { token: string; user: unknown }) => void;
  error: Pick<TAuthContext, 'error'>['error'];
  setError: Pick<TAuthContext, 'setError'>['setError'];
};

const PhoneLogin: React.FC<TPhoneLoginProps> = ({ onSubmit, error, setError }) => {
  const navigate = useNavigate();
  const localize = useLocalize();

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<PhoneLoginFormData>({ mode: 'onChange' });

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStep, setFormStep] = useState<number>(1);
  const [verificationSent, setVerificationSent] = useState<boolean>(false);
  const [verificationCountdown, setVerificationCountdown] = useState<number>(0);

  // Reset error when user starts typing
  const clearErrors = () => {
    setError(undefined);
    setErrorMessage('');
  };

  // Request verification code mutation
  const requestVerification = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await axios.post('/api/auth/phone/send-verification-code', { phoneNumber });
      return response.data;
    },
    onMutate: () => {
      setIsSubmitting(true);
      clearErrors();
    },
    onSuccess: () => {
      setIsSubmitting(false);
      setVerificationSent(true);
      setVerificationCountdown(60);
      const timer = setInterval(() => {
        setVerificationCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(timer);
            return 0;
          } else {
            return prevCountdown - 1;
          }
        });
      }, 1000);
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      if ((error as TError).response?.data?.message) {
        setErrorMessage((error as TError).response?.data?.message ?? '');
      } else {
        setErrorMessage('Failed to send verification code. Please try again.');
      }
    },
  });

  // Login with phone and verification code mutation
  const phoneLogin = useMutation({
    mutationFn: async (data: PhoneLoginFormData) => {
      const response = await axios.post('/api/auth/phone/login', data);
      return response.data;
    },
    onMutate: () => {
      setIsSubmitting(true);
      clearErrors();
    },
    onSuccess: (data) => {
      setIsSubmitting(false);
      setErrorMessage('');
      onSubmit(data);
      navigate('/c/new', { replace: true });
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      if ((error as TError).response?.data?.message) {
        setErrorMessage((error as TError).response?.data?.message ?? '');
      } else {
        setErrorMessage('Login failed. Please check your phone number and verification code.');
      }
    },
  });

  const handleRequestCode = async () => {
    const isPhoneValid = await trigger('phoneNumber');
    if (isPhoneValid) {
      const phoneNumber = getValues('phoneNumber');
      requestVerification.mutate(phoneNumber);
    }
  };

  const handleLogin = (data: PhoneLoginFormData) => {
    phoneLogin.mutate(data);
  };

  const renderError = (fieldName: 'phoneNumber' | 'verificationCode') => {
    const errorMessage = errors[fieldName]?.message;
    return errorMessage ? (
      <span role="alert" className="mt-1 text-sm text-red-500 dark:text-red-900">
        {String(errorMessage)}
      </span>
    ) : null;
  };

  return (
    <>
      {(error || errorMessage) && (
        <ErrorMessage>
          {error || errorMessage}
        </ErrorMessage>
      )}

      <form
        className="mt-6"
        aria-label="Phone login form"
        method="POST"
        onSubmit={handleSubmit(handleLogin)}
      >
        <div className="mb-4">
          <div className="relative">
            <input
              type="tel"
              id="phoneNumber"
              autoComplete="tel"
              aria-label={localize('com_auth_phone')}
              {...register('phoneNumber', {
                required: 'Phone number is required',
                pattern: {
                  value: /^\+?[0-9]{10,15}$/,
                  message: 'Please enter a valid phone number',
                },
              })}
              aria-invalid={!!errors.phoneNumber}
              className="
                webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light
                bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none
              "
              placeholder=" "
              onChange={clearErrors}
            />
            <label
              htmlFor="phoneNumber"
              className="
                absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200
                peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100
                peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-600 dark:peer-focus:text-green-500
                rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4
              "
            >
              {localize('com_auth_phone')}
            </label>
          </div>
          {renderError('phoneNumber')}
        </div>

        {!verificationSent ? (
          <div className="mt-6">
            <button
              type="button"
              disabled={!!errors.phoneNumber || isSubmitting || verificationCountdown > 0}
              onClick={handleRequestCode}
              className="
                w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
                focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
              "
            >
              {isSubmitting && !verificationSent ? (
                <Spinner />
              ) : verificationCountdown > 0 ? (
                `Resend code in ${verificationCountdown}s`
              ) : (
                'Request Verification Code'
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="my-4 text-center text-sm font-light text-gray-700 dark:text-white">
              Verification code sent. Please enter it below.
            </div>
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  id="verificationCode"
                  autoComplete="one-time-code"
                  aria-label={localize('com_auth_verification_code')}
                  {...register('verificationCode', {
                    required: 'Verification code is required',
                    pattern: {
                      value: /^[0-9]{4,6}$/,
                      message: 'Please enter a valid verification code',
                    },
                  })}
                  aria-invalid={!!errors.verificationCode}
                  className="
                    webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light
                    bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none
                  "
                  placeholder=" "
                  onChange={clearErrors}
                />
                <label
                  htmlFor="verificationCode"
                  className="
                    absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200
                    peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100
                    peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-600 dark:peer-focus:text-green-500
                    rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4
                  "
                >
                  {localize('com_auth_verification_code')}
                </label>
              </div>
              {renderError('verificationCode')}
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleRequestCode}
                disabled={verificationCountdown > 0 || isSubmitting}
                className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              >
                {verificationCountdown > 0
                  ? `Resend code in ${verificationCountdown}s`
                  : 'Resend code'}
              </button>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={!!errors.verificationCode || !getValues('verificationCode') || isSubmitting}
                className="
                  w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                  transition-colors hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700
                  disabled:opacity-50 disabled:hover:bg-green-600
                "
              >
                {isSubmitting ? (
                  <Spinner />
                ) : (
                  localize('com_auth_continue')
                )}
              </button>
            </div>
          </>
        )}
      </form>

      <p className="my-4 text-center text-sm font-light text-gray-700 dark:text-white">
        {localize('com_auth_no_account')}{' '}
        <a
          href="/register-phone"
          className="inline-flex p-1 text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
        >
          {localize('com_auth_sign_up')}
        </a>
      </p>
    </>
  );
};

export default PhoneLogin;

