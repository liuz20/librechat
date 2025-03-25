import { useForm } from 'react-hook-form';
import React, { useState } from 'react';
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import type { TError } from 'librechat-data-provider';
import type { TLoginLayoutContext } from '~/common';
import { ErrorMessage } from './ErrorMessage';
import { Spinner } from '~/components/svg';
import { useLocalize, TranslationKeys } from '~/hooks';

interface PhoneRegistrationFormData {
  phone: string;
  verificationCode: string;
  name: string;
  username: string;
  password: string;
  confirm_password: string;
}

const PhoneRegistration: React.FC = () => {
  const navigate = useNavigate();
  const localize = useLocalize();
  const { startupConfig, startupConfigError, isFetching } = useOutletContext<TLoginLayoutContext>();

  const {
    watch,
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<PhoneRegistrationFormData>({ mode: 'onChange' });
  
  const password = watch('password');

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [formStep, setFormStep] = useState<number>(1);
  const [verificationSent, setVerificationSent] = useState<boolean>(false);
  const [verificationCountdown, setVerificationCountdown] = useState<number>(0);

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  // Request verification code mutation
  const requestVerification = useMutation({
    mutationFn: async (phone: string) => {
      const response = await axios.post('/api/auth/phone/request-verification', { phone });
      return response.data;
    },
    onMutate: () => {
      setIsSubmitting(true);
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

  // Verify code mutation
  const verifyCode = useMutation({
    mutationFn: async ({ phone, verificationCode }: { phone: string; verificationCode: string }) => {
      const response = await axios.post('/api/auth/phone/verify-code', {
        phone,
        verificationCode,
      });
      return response.data;
    },
    onMutate: () => {
      setIsSubmitting(true);
    },
    onSuccess: () => {
      setIsSubmitting(false);
      setFormStep(3);
      setErrorMessage('');
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      if ((error as TError).response?.data?.message) {
        setErrorMessage((error as TError).response?.data?.message ?? '');
      } else {
        setErrorMessage('Invalid verification code. Please try again.');
      }
    },
  });

  // Register user mutation
  const registerUser = useMutation({
    mutationFn: async (data: PhoneRegistrationFormData) => {
      const { phone, name, username, password, confirm_password } = data;
      const response = await axios.post('/api/auth/phone/register', {
        phone,
        name,
        username,
        password,
        confirm_password,
        token: token ?? undefined,
      });
      return response.data;
    },
    onMutate: () => {
      setIsSubmitting(true);
    },
    onSuccess: () => {
      setIsSubmitting(false);
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(timer);
            navigate('/c/new', { replace: true });
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
        setErrorMessage('Registration failed. Please try again.');
      }
    },
  });

  const handleRequestCode = async () => {
    const isPhoneValid = await trigger('phone');
    if (isPhoneValid) {
      const phone = getValues('phone');
      requestVerification.mutate(phone);
    }
  };

  const handleVerifyCode = async () => {
    const isPhoneValid = await trigger('phone');
    const isCodeValid = await trigger('verificationCode');
    if (isPhoneValid && isCodeValid) {
      const phone = getValues('phone');
      const verificationCode = getValues('verificationCode');
      verifyCode.mutate({ phone, verificationCode });
    }
  };

  const handleRegistration = (data: PhoneRegistrationFormData) => {
    registerUser.mutate(data);
  };

  const renderInput = (id: keyof PhoneRegistrationFormData, label: TranslationKeys, type: string, validation: object) => (
    <div className="mb-4">
      <div className="relative">
        <input
          id={id}
          type={type}
          autoComplete={id}
          aria-label={localize(label)}
          {...register(id, validation)}
          aria-invalid={!!errors[id]}
          className="
            webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light
            bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none
          "
          placeholder=" "
          data-testid={id}
        />
        <label
          htmlFor={id}
          className="
            absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200
            peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100
            peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500
            rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4
          "
        >
          {localize(label)}
        </label>
      </div>
      {errors[id] && (
        <span role="alert" className="mt-1 text-sm text-red-500">
          {String(errors[id]?.message) ?? ''}
        </span>
      )}
    </div>
  );

  return (
    <>
      {errorMessage && (
        <ErrorMessage>
          {localize('com_auth_error_create')} {errorMessage}
        </ErrorMessage>
      )}
      {registerUser.isSuccess && countdown > 0 && (
        <div
          className="rounded-md border border-green-500 bg-green-500/10 px-3 py-2 text-sm text-gray-600 dark:text-gray-200"
          role="alert"
        >
          {localize('com_auth_registration_success_generic') +
            ' ' +
            localize('com_auth_email_verification_redirecting', { 0: countdown.toString() })}
        </div>
      )}
      {!startupConfigError && !isFetching && (
        <>
          <form
            className="mt-6"
            aria-label="Phone Registration form"
            method="POST"
            onSubmit={handleSubmit(handleRegistration)}
          >
            {formStep === 1 && (
              <>
                <h2 className="mb-4 text-center text-lg font-medium text-gray-800 dark:text-white">
                  {localize('com_auth_phone_registration')}
                </h2>
                {renderInput('phone', 'com_auth_phone', 'tel', {
                  required: 'Phone number is required',
                  pattern: {
                    value: /^\+?[0-9]{10,15}$/,
                    message: 'Please enter a valid phone number',
                  },
                })}
                <div className="mt-6">
                  <button
                    type="button"
                    disabled={!!errors.phone || isSubmitting || verificationCountdown > 0}
                    onClick={handleRequestCode}
                    className="
                      w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                      transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
                      focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                      disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
                    "
                  >
                    {isSubmitting && formStep === 1 ? (
                      <Spinner />
                    ) : verificationCountdown > 0 ? (
                      `Resend code in ${verificationCountdown}s`
                    ) : verificationSent ? (
                      'Resend Code'
                    ) : (
                      'Request Verification Code'
                    )}
                  </button>
                </div>
                {verificationSent && (
                  <>
                    <div className="my-4 text-center text-sm font-light text-gray-700 dark:text-white">
                      Verification code sent. Please enter it below.
                    </div>
                    {renderInput('verificationCode', 'com_auth_verification_code', 'text', {
                      required: 'Verification code is required',
                      pattern: {
                        value: /^[0-9]{4,6}$/,
                        message: 'Please enter a valid verification code',
                      },
                    })}
                    <div className="mt-6">
                      <button
                        type="button"
                        disabled={!!errors.verificationCode || isSubmitting}
                        onClick={handleVerifyCode}
                        className="
                          w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                          transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
                          focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                          disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
                        "
                      >
                        {isSubmitting && formStep === 1 ? <Spinner /> : 'Verify Code'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {formStep === 3 && (
              <>
                <h2 className="mb-4 text-center text-lg font-medium text-gray-800 dark:text-white">
                  {localize('com_auth_complete_registration')}
                </h2>
                {renderInput('name', 'com_auth_full_name', 'text', {
                  required: localize('com_auth_name_required'),
                  minLength: {
                    value: 3,
                    message: localize('com_auth_name_min_length'),
                  },
                  maxLength: {
                    value: 80,
                    message: localize('com_auth_name_max_length'),
                  },
                })}
                {renderInput('username', 'com_auth_username', 'text', {
                  required: 'Username is required',
                  minLength: {
                    value: 2,
                    message: localize('com_auth_username_min_length'),
                  },
                  maxLength: {
                    value: 80,
                    message: localize('com_auth_username_max_length'),
                  },
                })}
                {renderInput('password', 'com_auth_password', 'password', {
                  required: localize('com_auth_password_required'),
                  minLength: {
                    value: 8,
                    message: localize('com_auth_password_min_length'),
                  },
                  maxLength: {
                    value: 128,
                    message: localize('com_auth_password_max_length'),
                  },
                })}
                {renderInput('confirm_password', 'com_auth_password_confirm', 'password', {
                  validate: (value: string) =>
                    value === password || localize('com_auth_password_not_match'),
                })}
                <div className="mt-6">
                  <button
                    disabled={
                      Object.keys(errors).length > 0 ||
                      !getValues('name') ||
                      !getValues('username') ||
                      !getValues('password') ||
                      !getValues('confirm_password')
                    }
                    type="submit"
                    aria-label="Submit registration"
                    className="
                      w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                      transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
                      focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                      disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
                    "
                  >
                    {isSubmitting ? <Spinner /> : localize('com_auth_continue')}
                  </button>
                </div>
              </>
            )}
          </form>

          <p className="my-4 text-center text-sm font-light text-gray-700 dark:text-white">
            {localize('com_auth_already_have_account')}{' '}
            <a
              href="/login"
              aria-label="Login"
              className="inline-flex p-1 text-sm font-medium text

