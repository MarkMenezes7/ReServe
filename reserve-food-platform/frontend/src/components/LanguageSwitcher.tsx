import { useEffect, useState } from 'react';
import './LanguageSwitcher.css';

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

type LangOption = {
  code: string;
  label: string;
};

const LANGUAGES: LangOption[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'mr', label: 'Marathi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
];

function setGoogTransCookie(lang: string) {
  const value = `/en/${lang}`;
  document.cookie = `googtrans=${value};path=/;max-age=31536000`;
  document.cookie = `googtrans=${value};domain=${window.location.hostname};path=/;max-age=31536000`;
}

export default function LanguageSwitcher() {
  const [language, setLanguage] = useState<string>(() => localStorage.getItem('site_lang') || 'en');

  useEffect(() => {
    if (!document.getElementById('google-translate-script')) {
      window.googleTranslateElementInit = () => {
        if (window.google?.translate?.TranslateElement) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              autoDisplay: false,
              includedLanguages: LANGUAGES.map(l => l.code).join(','),
            },
            'google_translate_element'
          );
        }
      };

      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const onLanguageChange = (nextLang: string) => {
    if (nextLang === language) return; // Skip if same language
    
    setLanguage(nextLang);
    localStorage.setItem('site_lang', nextLang);
    setGoogTransCookie(nextLang);
    
    // Use a small delay to ensure cookie is set, then reload
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <>
      <div id="google_translate_element" className="ls-hidden-translator" />
      <div className="ls-switcher-wrap">
        <label htmlFor="site-language" className="ls-label">Language</label>
        <select
          id="site-language"
          className="ls-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          aria-label="Select language"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
      </div>
    </>
  );
}
