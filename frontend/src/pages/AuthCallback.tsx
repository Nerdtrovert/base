import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBaseStore } from '../store/useBaseStore';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkAuthStatus, showCompanionMessage } = useBaseStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const authStatus = searchParams.get('status');
      const err = searchParams.get('error');

      if (authStatus === 'success') {
        try {
          await checkAuthStatus();
          setStatus('success');
          showCompanionMessage('Cloud sync initialized. Future-you says thanks.', 'success');
          
          const timeout = setTimeout(() => {
            navigate('/');
          }, 2000);
          return () => clearTimeout(timeout);
        } catch (error) {
          setStatus('error');
          setErrorMessage('Failed to resolve authenticated session.');
        }
      } else if (authStatus === 'gdrive_signup') {
        navigate('/login?gdrive_signup=1', { replace: true });
      } else if (authStatus === 'error' || err) {
        setStatus('error');
        setErrorMessage(err || 'Google authorization declined.');
      } else {
        // Fallback or refresh callback status checking
        await checkAuthStatus();
        navigate('/');
      }
    };

    handleCallback();
  }, [searchParams, checkAuthStatus, navigate, showCompanionMessage]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-6">
      
      {status === 'loading' && (
        <div className="space-y-4 animate-pulse">
          <RefreshCw className="w-12 h-12 text-accent animate-spin mx-auto" />
          <h2 className="text-xl font-bold text-text-primary">
            Synchronizing memory layers...
          </h2>
          <p className="text-sm text-text-secondary">
            Connecting your cloud sync container.
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4 animate-fade-in">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-bold text-text-primary">
            Sync connection established
          </h2>
          <p className="text-sm text-text-secondary">
            Returning you to your notebook...
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4 animate-fade-in max-w-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-text-primary">
            Connection failed
          </h2>
          <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">
            {errorMessage}
          </p>
          <div className="pt-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl bg-accent text-white font-semibold text-xs hover:bg-accent/90 transition-all cursor-pointer"
            >
              Back to Workspace
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
