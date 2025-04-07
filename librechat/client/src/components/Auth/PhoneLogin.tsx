import { useForm } from 'react-hook-form';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TError } from 'librechat-data-provider';
import { useSendVerificationCodeMutation, usePhoneLoginMutation } from 'librechat-data-provider/react-query';
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
  const requestVerification = useSendVerificationCodeMutation({
    variables: () => {
      const phoneNumber = getValues('phoneNumber');
      return { phone: phoneNumber };
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
        setErrorMessage(localize('com_auth_verification_code_error'));
      }
    },
  });

  // Login with phone and verification code mutation
  const phoneLogin = usePhoneLoginMutation({
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
        setErrorMessage(localize('com_auth_phone_login_failed'));
      }
    },
  });

  const handleRequestCode = async () => {
    const isPhoneValid = await trigger('phoneNumber');
    if (isPhoneValid) {
      // No need to pass phone number as it's already configured in the hook's variables
      requestVerification.mutate();
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
                required: localize('com_auth_phone_required'),
                pattern: {
                  value: /^\+?[0-9]{10,15}$/,
                  message: localize('com_auth_phone_invalid'),
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
                `${localize('com_auth_resend_code')} ${verificationCountdown}s`
              ) : (
                localize('com_auth_request_verification_code')
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="my-4 text-center text-sm font-light text-gray-700 dark:text-white">
              {localize('com_auth_verification_code_sent')}
            </div>
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  id="verificationCode"
                  autoComplete="one-time-code"
                  aria-label={localize('com_auth_verification_code')}
                  {...register('verificationCode', {
                    required: localize('com_auth_verification_code_required'),
                    pattern: {
                      value: /^[0-9]{4,6}$/,
                      message: localize('com_auth_verification_code_invalid'),
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
                  ? `${localize('com_auth_resend_code')} ${verificationCountdown}s`
                  : localize('com_auth_resend_code')}
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

