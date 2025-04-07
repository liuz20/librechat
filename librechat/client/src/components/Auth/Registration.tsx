import React from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TLoginLayoutContext } from '~/common';
import UnifiedRegistrationForm from './UnifiedRegistrationForm';

const Registration: React.FC = () => {
  const { startupConfigError, isFetching } = useOutletContext<TLoginLayoutContext>();

  return (
    <>
      {!startupConfigError && !isFetching && (
        <UnifiedRegistrationForm />
      )}
    </>
  );
};

export default Registration;
