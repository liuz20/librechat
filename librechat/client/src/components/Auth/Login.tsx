import { useOutletContext } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import type { TLoginLayoutContext } from '~/common';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { getLoginError } from '~/utils';
import { useLocalize } from '~/hooks';
import UnifiedLoginForm from './UnifiedLoginForm';

function Login() {
  const localize = useLocalize();
  const { error, setError, login } = useAuthContext();
  const { startupConfig } = useOutletContext<TLoginLayoutContext>();

  // Handle phone login
  const handlePhoneLogin = (data: { phoneNumber: string; verificationCode: string }) => {
    // This will be handled by the phoneLogin mutation in UnifiedLoginForm
    // For debugging: console.log("Phone login:", data);
  };

  return (
    <>
      {error != null && <ErrorMessage>{localize(getLoginError(error))}</ErrorMessage>}
      
      {(startupConfig?.emailLoginEnabled === true || startupConfig?.phoneLoginEnabled === true) && (
        <UnifiedLoginForm
          onSubmit={login}
          onPhoneLogin={handlePhoneLogin}
          startupConfig={startupConfig}
          error={error}
          setError={setError}
        />
      )}
      
      {startupConfig?.registrationEnabled === true && (
        <div>
          <p className="my-4 text-center text-sm font-light text-gray-700 dark:text-white">
            {localize('com_auth_no_account')}{' '}
            <a
              href="/register"
              className="inline-flex p-1 text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              {localize('com_auth_sign_up')}
            </a>
          </p>
          {startupConfig?.phoneLoginEnabled === true && (
            <p className="mt-2 mb-4 text-center text-sm font-light text-gray-700 dark:text-white">
              {localize('com_auth_or')}{' '}
              <a
                href="/register-phone"
                className="inline-flex p-1 text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              >
                {localize('com_auth_sign_up_with_phone')}
              </a>
            </p>
          )}
        </div>
      )}
    </>
  );
}

export default Login;
