import { useForm } from 'react-hook-form';
import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { 
  useSendVerificationCodeMutation, 
  useVerifyPhoneMutation, 
  usePhoneRegisterMutation 
} from 'librechat-data-provider/react-query';
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
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  const {
    watch,
    register,
    handleSubmit,
    formState: { errors, isValid },
    trigger,
    getValues,
  } = useForm<PhoneRegistrationFormData>({ 
    mode: 'onChange',
    defaultValues: {
      phone: '',
      verificationCode: '',
      name: '',
      username: '',
      password: '',
      confirm_password: ''
    }
  });

  const password = watch('password');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [formStep, setFormStep] = useState<number>(1);
  const [verificationSent, setVerificationSent] = useState<boolean>(false);
  const [verificationCountdown, setVerificationCountdown] = useState<number>(0);
  const [successCountdown, setSuccessCountdown] = useState<number>(0);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Cleanup timers on unmount
  useEffect(() => {
    let verificationTimer: NodeJS.Timeout;
    let successTimer: NodeJS.Timeout;

    if (verificationSent && verificationCountdown > 0) {
      verificationTimer = setInterval(() => {
        setVerificationCountdown((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
    }

    if (successCountdown > 0) {
      successTimer = setInterval(() => {
        setSuccessCountdown((prev) => {
          if (prev <= 1) {
            navigate('/c/new', { replace: true });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      clearInterval(verificationTimer);
      clearInterval(successTimer);
    };
  }, [verificationSent, verificationCountdown, successCountdown, navigate]);

  const requestVerification = useSendVerificationCodeMutation({
    onMutate: () => setIsRequestingCode(true),
    onSuccess: () => {
      setVerificationSent(true);
      setVerificationCountdown(60);
      setErrorMessage('');
      setFormStep(2);
    },
    onError: (error: unknown) => {
      setErrorMessage(
        (error as TError).response?.data?.message
          ? (error as TError).response.data.message
          : 'Failed to send verification code. Please try again.'
      );
    },
    onSettled: () => setIsRequestingCode(false),
  });

  const verifyCode = useVerifyPhoneMutation({
    onMutate: () => setIsVerifyingCode(true),
    onSuccess: () => {
      setFormStep(3);
      setErrorMessage('');
    },
    onError: (error: unknown) => {
      setErrorMessage(
        (error as TError).response?.data?.message
          ? (error as TError).response.data.message
          : 'Invalid verification code. Please try again.'
      );
    },
    onSettled: () => setIsVerifyingCode(false),
  });

  const registerUser = usePhoneRegisterMutation({
    onMutate: () => setIsRegistering(true),
    onSuccess: () => {
      setSuccessCountdown(3);
      setErrorMessage('');
    },
    onError: (error: unknown) => {
      setErrorMessage(
        (error as TError).response?.data?.message
          ? (error as TError).response.data.message
          : 'Registration failed. Please try again.'
      );
    },
    onSettled: () => setIsRegistering(false),
  });

  const handleRequestCode = async () => {
    const isPhoneValid = await trigger('phone');
    if (isPhoneValid) {
      requestVerification.mutate({ phone: getValues('phone') });
    }
  };

  const handleVerifyCode = async () => {
    const isValid = await Promise.all([
      trigger('phone'),
      trigger('verificationCode')
    ]).then(results => results.every(Boolean));
    if (isValid) {
      verifyCode.mutate({
        phone: getValues('phone'),
        verificationCode: getValues('verificationCode')
      });
    }
  };

  const handleRegistration = (data: PhoneRegistrationFormData) => {
    const { phone, name, username, password, confirm_password } = data;
    registerUser.mutate({
      phone,
      name,
      username,
      password,
      confirm_password,
      token: token ?? undefined,
    });
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
          aria-describedby={errors[id] ? `${id}-error` : undefined}
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
        <span 
          id={`${id}-error`}
          role="alert" 
          className="mt-1 text-sm text-red-500"
        >
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
      {registerUser.isSuccess && successCountdown > 0 && (
        <div
          className="rounded-md border border-green-500 bg-green-500/10 px-3 py-2 text-sm text-gray-600 dark:text-gray-200"
          role="alert"
        >
          {localize('com_auth_registration_success_generic') +
            ' ' +
            localize('com_auth_email_verification_redirecting', { 0: successCountdown.toString() })}
        </div>
      )}
      {!startupConfigError && !isFetching && (
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
                  value: /^\+?[1-9]\d{1,14}$/, // E.164 format
                  message: 'Please enter a valid phone number (e.g., +1234567890)',
                },
              })}
              <button
                type="button"
                disabled={!!errors.phone || isRequestingCode || verificationCountdown > 0}
                onClick={handleRequestCode}
                className="
                  w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                  transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
                  focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                  disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
                "
              >
                {isRequestingCode ? <Spinner /> : 'Request Code'}
              </button>
            </>
          )}

          {formStep === 2 && (
            <>
              <h2 className="mb-4 text-center text-lg font-medium text-gray-800 dark:text-white">
                {localize('com_auth_verify_phone')}
              </h2>
              {renderInput('verificationCode', 'com_auth_verification_code', 'text', {
                required: 'Verification code is required',
                pattern: {
                  value: /^\d{6}$/, // Assuming 6-digit code
                  message: 'Please enter a valid 6-digit code',
                },
              })}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!!errors.verificationCode || isVerifyingCode}
                  onClick={handleVerifyCode}
                  className="
                    w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                    transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
                    focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                    disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
                  "
                >
                  {isVerifyingCode ? <Spinner /> : 'Verify Code'}
                </button>
                <button
                  type="button"
                  disabled={isRequestingCode || verificationCountdown > 0}
                  onClick={handleRequestCode}
                  className="
                    w-full rounded-2xl bg-gray-600 px-4 py-3 text-sm font-medium text-white
                    transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2
                    focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50
                    disabled:hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700
                  "
                >
                  {isRequestingCode 
                    ? <Spinner /> 
                    : verificationCountdown > 0 
                      ? `Resend in ${verificationCountdown}s`
                      : 'Resend Code'}
                </button>
              </div>
            </>
          )}

          {formStep === 3 && (
            <>
              <h2 className="mb-4 text-center text-lg font-medium text-gray-800 dark:text-white">
                {localize('com_auth_complete_registration')}
              </h2>
              {renderInput('name', 'com_auth_full_name', 'text', {
                required: localize('com_auth_name_required'),
                minLength: { value: 3, message: localize('com_auth_name_min_length') },
                maxLength: { value: 80, message: localize('com_auth_name_max_length') },
              })}
              {renderInput('username', 'com_auth_username', 'text', {
                required: 'Username is required',
                minLength: { value: 2, message: localize('com_auth_username_min_length') },
                maxLength: { value: 80, message: localize('com_auth_username_max_length') },
                pattern: {
                  value: /^[a-zA-Z0-9_]+$/,
                  message: 'Username can only contain letters, numbers, and underscores',
                },
              })}
              {renderInput('password', 'com_auth_password', 'password', {
                required: localize('com_auth_password_required'),
                minLength: { value: 8, message: localize('com_auth_password_min_length') },
                maxLength: { value: 128, message: localize('com_auth_password_max_length') },
                pattern: {
                  value: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/,
                  message: 'Password must contain at least one letter and one number',
                },
              })}
              {renderInput('confirm_password', 'com_auth_password_confirm', 'password', {
                validate: (value: string) => value === password || localize('com_auth_password_not_match'),
              })}
              <button
                disabled={!isValid || isRegistering}
                type="submit"
                aria-label="Submit registration"
                className="
                  w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                  transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
                  focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                  disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
                "
              >
                {isRegistering ? <Spinner /> : localize('com_auth_continue')}
              </button>
            </>
          )}
        </form>
      )}
      <p className="my-4 text-center text-sm font-light text-gray-700 dark:text-white">
        {localize('com_auth_already_have_account')}{' '}
        <a
          href="/login-phone"
          aria-label="Login"
          className="inline-flex p-1 text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
        >
          {localize('com_auth_login')}
        </a>
      </p>
    </>
  );
};

export default PhoneRegistration;
