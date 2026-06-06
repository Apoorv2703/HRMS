import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess, loginFailure } from '../store/authSlice';
import api from '../services/api';
import { ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

const AuthCallbackPage = () => {
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const samlResponse = searchParams.get('SAMLResponse');
        const state = searchParams.get('state') || ''; // Typically contains the subdomain

        // Retrieve subdomain from state or local storage fallback
        const subdomain = state || localStorage.getItem('workspaceSubdomain') || '';

        if (!subdomain) {
          throw new Error('Workspace subdomain is required to complete SSO.');
        }

        let endpoint = '';
        let payload = { subdomain };

        if (provider === 'google') {
          if (!code) throw new Error('Authorization code not returned from Google.');
          endpoint = '/auth/google/callback';
          payload.code = code;
        } else if (provider === 'microsoft') {
          if (!code) throw new Error('Authorization code not returned from Microsoft.');
          endpoint = '/auth/microsoft/callback';
          payload.code = code;
        } else if (provider === 'saml') {
          if (!samlResponse) throw new Error('SAML Response token not returned from IdP.');
          endpoint = '/auth/saml/callback';
          payload.SAMLResponse = samlResponse;
        } else {
          throw new Error('Unknown SSO provider.');
        }

        // Send login credentials/payload to backend
        const response = await api.post(endpoint, payload);

        // Store tokens & update redux state
        dispatch(loginSuccess(response.data));

        // Save active workspace subdomain
        localStorage.setItem('workspaceSubdomain', subdomain);

        // Redirect to workspace dashboard
        navigate('/dashboard');
      } catch (err) {
        console.error('SSO Callback error:', err);
        const errMsg = err.response?.data?.error || err.message || 'Single Sign-On authentication failed.';
        setError(errMsg);
        dispatch(loginFailure(errMsg));
        setLoading(false);
      }
    };

    processCallback();
  }, [provider, searchParams, dispatch, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl text-center space-y-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
          <ShieldCheck className="h-7 w-7 text-brand-400" />
          SSO Authentication
        </h2>

        {loading ? (
          <div className="space-y-4 py-8 flex flex-col items-center">
            <RefreshCw className="h-10 w-10 animate-spin text-brand-500" />
            <p className="text-sm text-slate-400">
              Validating token attributes with your workspace server...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-start gap-2.5 text-left">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            
            <button
              onClick={() => navigate('/login')}
              className="w-full rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 py-2.5 text-sm font-semibold text-white transition cursor-pointer"
            >
              Return to Login Screen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
