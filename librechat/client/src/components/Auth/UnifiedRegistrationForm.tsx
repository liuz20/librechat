import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  useRegisterUserMutation, 
  useSendVerificationCodeMutation, 
  useVerifyPhoneMutation 
} from 'librechat-data-provider/react-query';
import type { TRegisterUser, TSendVerificationCodeRequest, TError } from 'librechat-data-provider';
import type { TLoginLayoutContext } from '~/common';
import { ErrorMessage } from './ErrorMessage';
import { Spinner } from '~/components/svg';
import { useLocalize, TranslationKeys } from '~/hooks';

interface UnifiedRegistrationFormData {
  name: string;
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  phoneNumber: string;
  verificationCode: string;
  registrationType: 'email' | 'phone';
}

const UnifiedRegistrationForm: React.FC = () => {
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
    formState: { errors },
    trigger,
    getValues,
    setValue,
  } = useForm<UnifiedRegistrationFormData>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      confirm_password: '',
      phoneNumber: '',
      verificationCode: '',
      registrationType: 'email'
    }
  });

  const password = watch('password');
  const registrationType = watch('registrationType');

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStep, setFormStep] = useState<number>(1);
  const [verificationSent, setVerificationSent] = useState<boolean>(false);
  const [verificationCountdown, setVerificationCountdown] = useState<number>(0);
  const [successCountdown, setSuccessCountdown] = useState<number>(0);

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

  // Call requestVerification mutation
  const requestVerification = useSendVerificationCodeMutation({
    onMutate: () => {
      setIsSubmitting(true);
      setErrorMessage('');
    },
    onSuccess: () => {
      setIsSubmitting(false);
      setVerificationSent(true);
      setVerificationCountdown(60);
      setFormStep(2);
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      const typedError = error as TError;
      if (typedError.response?.data?.message) {
        setErrorMessage(typedError.response.data.message);
      } else {
        setErrorMessage('Failed to send verification code. Please try again.');
      }
    },
  });

  // Call verifyCode mutation
  const verifyCode = useVerifyPhoneMutation({
    onMutate: () => {
      setIsSubmitting(true);
      setErrorMessage('');
    },
    onSuccess: () => {
      setIsSubmitting(false);
      setFormStep(3);
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      const typedError = error as TError;
      if (typedError.response?.data?.message) {
        setErrorMessage(typedError.response.data.message);
      } else {
        setErrorMessage('Invalid verification code. Please try again.');
      }
    },
  });

  // Call registerUser mutation for both email and phone registration
  const registerUser = useRegisterUserMutation({
    onMutate: () => {
      setIsSubmitting(true);
      setErrorMessage('');
    },
    onSuccess: () => {
      setIsSubmitting(false);
      setSuccessCountdown(3);
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      const typedError = error as TError;
      if (typedError.response?.data?.message) {
        setErrorMessage(typedError.response.data.message ?? '');
      } else {
        setErrorMessage('Registration failed. Please try again.');
      }
    },
  });

  const handleRequestCode = async () => {
    const isValid = await trigger('phoneNumber');
    if (isValid) {
      const request: TSendVerificationCodeRequest = {
        phone: getValues('phoneNumber')
      };
      requestVerification.mutate(request);
    }
  };

  const handleVerifyCode = async () => {
    const isValid = await Promise.all([
      trigger('phoneNumber'),
      trigger('verificationCode')
    ]).then(results => results.every(Boolean));
    if (isValid) {
      verifyCode.mutate({
        phone: getValues('phoneNumber'),
        verificationCode: getValues('verificationCode')
      });
    }
  };

  const handleRegistration = (data: UnifiedRegistrationFormData) => {
    if (data.registrationType === 'email') {
      // Handle email registration
      const emailData: TRegisterUser = {
        name: data.name,
        username: data.username,
        email: data.email,
        password: data.password,
        confirm_password: data.confirm_password,
        token: token ?? undefined
      };

      registerUser.mutate(emailData);
    } else {
      // Handle phone registration
      const phoneData = {
        name: data.name,
        username: data.username,
        phoneNumber: data.phoneNumber,
        code: data.verificationCode,
        password: data.password,
        confirm_password: data.confirm_password,
        token: token ?? undefined
      };

      registerUser.mutate(phoneData);
    }
  };

  const handleToggleRegistrationType = (type: 'email' | 'phone') => {
    setValue('registrationType', type);
    setFormStep(1);
    setVerificationSent(false);
    setErrorMessage('');
  };

  const renderInput = (
    id: keyof UnifiedRegistrationFormData, 
    label: TranslationKeys, 
    type: string, 
    validation: object
  ) => (
    <div className="mb-4">
      <div className="relative">
        <input
          id={id}
          type={type}
          autoComplete={id}
          aria-label={localize(label)}
          {...register(id as any, validation)}
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

  const renderRegistrationTypeSelector = () => (
    <div className="mb-6 flex rounded-xl border border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => handleToggleRegistrationType('email')}
        className={`flex-1 rounded-l-xl px-4 py-2 text-sm font-medium ${
          registrationType === 'email'
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
        }`}
      >
        {localize('com_auth_email')}
      </button>
      <button
        type="button"
        onClick={() => handleToggleRegistrationType('phone')}
        className={`flex-1 rounded-r-xl px-4 py-2 text-sm font-medium ${
          registrationType === 'phone'
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
        }`}
      >
        {localize('com_auth_phone')}
      </button>
    </div>
  );

  const renderPhoneRegistrationSteps = () => {
    if (formStep === 1) {
      return (
        <>
          <h2 className="mb-4 text-center text-lg font-medium text-gray-800 dark:text-white">
            {localize('com_auth_phone_registration')}
          </h2>
          {renderInput('phoneNumber', 'com_auth_phone', 'tel', {
            required: 'Phone number is required',
            pattern: {
              value: /^\+?[1-9]\d{1,14}$/, // E.164 format
              message: 'Please enter a valid phone number (e.g., +1234567890)',
            },
          })}
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
            {isSubmitting ? <Spinner /> : 'Request Code'}
          </button>
        </>
      );
    } else if (formStep === 2) {
      return (
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
              disabled={!!errors.verificationCode || isSubmitting}
              onClick={handleVerifyCode}
              className="
                w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
                transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
                focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
                disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
              "
            >
              {isSubmitting ? <Spinner /> : 'Verify Code'}
            </button>
            <button
              type="button"
              disabled={isSubmitting || verificationCountdown > 0}
              onClick={handleRequestCode}
              className="
                w-full rounded-2xl bg-gray-600 px-4 py-3 text-sm font-medium text-white
                transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2
                focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50
                disabled:hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700
              "
            >
              {isSubmitting 
                ? <Spinner /> 
                : verificationCountdown > 0 
                  ? `Resend in ${verificationCountdown}s`
                  : 'Resend Code'}
            </button>
          </div>
        </>
      );
    } else {
      return (
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
          })}
          {renderInput('confirm_password', 'com_auth_confirm_password', 'password', {
            required: localize('com_auth_confirm_password_required'),
            validate: (value) => value === password || localize('com_auth_password_not_match'),
          })}
          <button
            type="submit"
            disabled={isSubmitting}
            className="
              w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
              transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
              focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
              disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
            "
          >
            {isSubmitting ? <Spinner /> : localize('com_auth_register')}
          </button>
        </>
      );
    }
  };

  const renderEmailRegistrationForm = () => (
    <>
      <h2 className="mb-4 text-center text-lg font-medium text-gray-800 dark:text-white">
        {localize('com_auth_email_registration')}
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
      {renderInput('email', 'com_auth_email', 'email', {
        required: localize('com_auth_email_required'),
        pattern: {
          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
          message: localize('com_auth_email_invalid'),
        },
      })}
      {renderInput('password', 'com_auth_password', 'password', {
        required: localize('com_auth_password_required'),
        minLength: { value: 8, message: localize('com_auth_password_min_length') },
        maxLength: { value: 128, message: localize('com_auth_password_max_length') },
      })}
      {renderInput('confirm_password', 'com_auth_confirm_password', 'password', {
        required: localize('com_auth_confirm_password_required'),
        validate: (value) => value === password || localize('com_auth_password_not_match'),
      })}
      <button
        type="submit"
        disabled={isSubmitting}
        className="
          w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
          transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
          focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
          disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
        "
      >
        {isSubmitting ? <Spinner /> : localize('com_auth_register')}
      </button>
    </>
  );

  return (
    <form onSubmit={handleSubmit(handleRegistration)} className="w-full max-w-md space-y-4">
      {renderRegistrationTypeSelector()}
      {errorMessage && <ErrorMessage message={errorMessage} />}
      {registrationType === 'phone' ? renderPhoneRegistrationSteps() : renderEmailRegistrationForm()}
    </form>
  );
};

export default UnifiedRegistrationForm;

