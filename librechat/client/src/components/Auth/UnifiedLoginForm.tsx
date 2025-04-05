import { useForm } from 'react-hook-form';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TLoginUser, TStartupConfig, TError } from 'librechat-data-provider';
import { useSendVerificationCodeMutation, usePhoneLoginMutation } from 'librechat-data-provider/react-query';
import type { TAuthContext } from '~/common';
import { useResendVerificationEmail, useGetStartupConfig } from '~/data-provider';
import { Spinner } from '~/components/svg';
import { useLocalize } from '~/hooks';

type TUnifiedLoginFormProps = {
  onSubmit: (data: TLoginUser) => void;
  onPhoneLogin: (data: { phoneNumber: string; verificationCode: string }) => void;
  startupConfig: TStartupConfig;
  error: Pick<TAuthContext, 'error'>['error'];
  setError: Pick<TAuthContext, 'setError'>['setError'];
};

interface UnifiedLoginFormData {
  identifier: string; // can be email or phone
  password: string;
  verificationCode: string;
}

const UnifiedLoginForm: React.FC<TUnifiedLoginFormProps> = ({ 
  onSubmit, 
  onPhoneLogin, 
  startupConfig, 
  error, 
  setError 
}) => {
  const navigate = useNavigate();
  const localize = useLocalize();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<UnifiedLoginFormData>({ mode: 'onChange' });

  const [isPhone, setIsPhone] = useState<boolean>(false);
  const [showResendLink, setShowResendLink] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState<boolean>(false);
  const [verificationCountdown, setVerificationCountdown] = useState<number>(0);

  const { data: config } = useGetStartupConfig();
  const useUsernameLogin = config?.ldap?.username;

  const identifier = watch('identifier');

  // Reset error when user starts typing
  const clearErrors = () => {
    setError(undefined);
    setErrorMessage('');
  };

  // Detect if input is a phone number
  useEffect(() => {
    if (!identifier) return;

    // Simple regex to detect if input might be a phone number
    const phonePattern = /^\+?[0-9]{1,15}$/;
    const emailPattern = /\S+@\S+\.\S+/;
    
    if (phonePattern.test(identifier) && !emailPattern.test(identifier)) {
      setIsPhone(true);
    } else {
      setIsPhone(false);
      setVerificationSent(false);
    }
  }, [identifier]);

  useEffect(() => {
    if (error && error.includes('422') && !showResendLink) {
      setShowResendLink(true);
    }
  }, [error, showResendLink]);

  const resendLinkMutation = useResendVerificationEmail({
    onMutate: () => {
      setError(undefined);
      setShowResendLink(false);
    },
  });

  // Request verification code mutation
  const requestVerification = useSendVerificationCodeMutation({
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

  // Phone login mutation
  const phoneLogin = usePhoneLoginMutation({
    onMutate: () => {
      setIsSubmitting(true);
      clearErrors();
    },
    onSuccess: (data) => {
      setIsSubmitting(false);
      setErrorMessage('');
      onPhoneLogin({ 
        phoneNumber: getValues('identifier'), 
        verificationCode: getValues('verificationCode') 
      });
      navigate('/c/new', { replace: true });
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      if ((error as TError).response?.data?.message) {
        setErrorMessage((error as TError).response?.data?.message ?? '');
      } else {
        setErrorMessage('Login failed. Please check your credentials.');
      }
    },
  });

  const handleRequestCode = async () => {
    const isValid = await trigger('identifier');
    if (isValid && isPhone) {
      const phoneNumber = getValues('identifier');
      requestVerification.mutate({ phoneNumber });
    }
  };

  const handleFormSubmit = (data: UnifiedLoginFormData) => {
    if (isPhone && verificationSent) {
      // Phone login with verification code
      phoneLogin.mutate({
        phoneNumber: data.identifier,
        verificationCode: data.verificationCode
      });
    } else if (!isPhone) {
      // Email login with password
      onSubmit({
        email: data.identifier,
        password: data.password
      });
    }
  };

  const handleResendEmail = () => {
    const email = getValues('identifier');
    if (!email || isPhone) {
      return setShowResendLink(false);
    }
    resendLinkMutation.mutate({ email });
  };

  const renderError = (fieldName: 'identifier' | 'password' | 'verificationCode') => {
    const errorMessage = errors[fieldName]?.message;
    return errorMessage ? (
      <span role="alert" className="mt-1 text-sm text-red-500 dark:text-red-900">
        {String(errorMessage)}
      </span>
    ) : null;
  };

  if (!startupConfig) {
    return null;
  }

  return (
    <>
      {showResendLink && !isPhone && (
        <div className="mt-2 rounded-md border border-green-500 bg-green-500/10 px-3 py-2 text-sm text-gray-600 dark:text-gray-200">
          {localize('com_auth_email_verification_resend_prompt')}
          <button
            type="button"
            className="ml-2 text-blue-600 hover:underline"
            onClick={handleResendEmail}
            disabled={resendLinkMutation.isLoading}
          >
            {localize('com_auth_email_resend_link')}
          </button>
        </div>
      )}
      <form
        className="mt-6"
        aria-label="Login form"
        method="POST"
        onSubmit={handleSubmit(handleFormSubmit)}
      >
        <div className="mb-4">
          <div className="relative">
            <input
              type={isPhone ? "tel" : "text"}
              id="identifier"
              autoComplete={isPhone ? "tel" : (useUsernameLogin ? "username" : "email")}
              aria-label={isPhone ? localize('com_auth_phone') : localize('com_auth_email')}
              {...register('identifier', {
                required: localize('com_auth_identifier_required'),
                validate: (value) => {
                  // For phone validation
                  if (/^\+?[0-9]{10,15}$/.test(value)) {
                    return true;
                  }
                  // For email validation
                  if (/\S+@\S+\.\S+/.test(value)) {
                    return true;
                  }
                  // For username (if LDAP)
                  if (useUsernameLogin && /\S+/.test(value)) {
                    return true;
                  }
                  return localize('com_auth_invalid_identifier');
                }
              })}
              onChange={(e) => {
                setValue('identifier', e.target.value);
                clearErrors();
              }}
              aria-invalid={!!errors.identifier}
              className="
                webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light
                bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none
              "
              placeholder=" "
            />
            <label
              htmlFor="identifier"
              className="
                absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200
                peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100
                peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-600 dark:peer-focus:text-green-500
                rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4
              "
            >
              {localize('com_auth_email_or_phone')}
            </label>
          </div>
          {renderError('identifier')}
        </div>

        {isPhone ? (
          /* Phone verification flow */
          !verificationSent ? (
            <div className="mt-6">
              <button
                type="button"
                disabled={!!errors.identifier || isSubmitting || verificationCountdown > 0 || !identifier}
                onClick={handleRequestCode}
                className="
                  w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                  transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
                  focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                  disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
                "
              >
                {isSubmitting ? (
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
            </>
          )
        ) : (
          /* Email/username password flow */
          <div className="mb-2">
            <div className="relative">
              <input
                type="password"
                id="password"
                autoComplete="current-password"
                aria-label={localize('com_auth_password')}
                {...register('password', {
                  required: !isPhone ? localize('com_auth_password_required') : false,
                  minLength: { value: 8, message: localize('com_auth_password_min_length') },
                  maxLength: { value: 128, message: localize('com_auth_password_max_length') },
                })}
                aria-invalid={!!errors.password}
                className="
                  webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light
                  bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none
                "
                placeholder=" "
                onChange={clearErrors}
              />
              <label
                htmlFor="password"
                className="
                  absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200
                  peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100
                  peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-600 dark:peer-focus:text-green-500
                  rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4
                "
              >
                {localize('com_auth_password')}
              </label>
            </div>
            {renderError('password')}
          </div>
        )}

        {!isPhone && startupConfig.passwordResetEnabled && (
          <a
            href="/forgot-password"
            className="inline-flex p-1 text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
          >
            {localize('com_auth_password_forgot')}
          </a>
        )}

        {/* Submit button - only show for email login or when phone verification sent */}
        {(!isPhone || (isPhone && verificationSent)) && (
          <div className="mt-6">
            <button
              aria-label={localize('com_auth_continue')}
              data-testid="login-button"
              type="submit"
              disabled={isSubmitting || 
                (isPhone && (!verificationSent || !getValues('verificationCode'))) || 
                (!isPhone && !getValues('password'))}
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
        )}
      </form>

      {errorMessage && (
        <div className="mt-2 rounded-md border border-red-500 bg-red-500/10 px-3 py-2 text-sm text-gray-600 dark:text-gray-200">
          {errorMessage}
        </div>
      )}
    </>
  );
};

export default UnifiedLoginForm;
