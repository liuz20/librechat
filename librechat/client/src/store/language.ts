import Cookies from 'js-cookie';
import { atomWithLocalStorage } from './utils';

// Import API types
// We're assuming there's a StartupConfig type that would contain the defaultLang property
// If not available, you might need to create this type

// Function to get the startup config from window object
const getStartupConfig = () => {
  return (window as any).__STARTUP_CONFIG__ || {};
};

const defaultLang = () => {
  // First check for cookie
  const cookieLang = Cookies.get('lang');
  if (cookieLang) return cookieLang;

  // Then check localStorage
  const localStorageLang = localStorage.getItem('lang');
  if (localStorageLang) return localStorageLang;

  // Then check server-provided default language
  const startupConfig = getStartupConfig();
  if (startupConfig.defaultLang) return startupConfig.defaultLang;

  // Finally, fallback to browser language
  return navigator.language || navigator.languages[0];
};

const lang = atomWithLocalStorage('lang', defaultLang());

export default { lang };
