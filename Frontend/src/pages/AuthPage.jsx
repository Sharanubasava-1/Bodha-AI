import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import heroImage from '../assets/98275714-7efa-4f6e-b956-e5d209118c31.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function AuthPage() {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const modeLabel = useMemo(() => (isSignup ? 'CREATE ACCOUNT' : 'SIGN IN'), [isSignup]);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleGoogleCredential = async (credential) => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const data = await parseResponse(response);
      saveSessionAndGo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    const initGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (!response.credential) {
            setError('Google authentication failed. Please try again.');
            return;
          }

          handleGoogleCredential(response.credential);
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 396,
        shape: 'rectangular',
      });
    };

    const id = 'google-identity-script';
    const existing = document.getElementById(id);
    if (existing) {
      initGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogleButton;
    document.body.appendChild(script);
  }, []);

  const saveSessionAndGo = (data) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    navigate('/dashboard');
  };

  const parseResponse = async (response) => {
    const raw = await response.text();
    let parsed = null;

    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    if (!response.ok) {
      const message =
        (parsed && typeof parsed === 'object' && parsed.message) ||
        (parsed && typeof parsed === 'object' && parsed.msg) ||
        (typeof parsed === 'string' && parsed) ||
        'Request failed';
      throw new Error(message);
    }

    return parsed;
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.email.trim(),
          password: form.password,
        }),
      });

      const loginData = await parseResponse(loginResponse);
      saveSessionAndGo(loginData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'Student',
        }),
      });

      await parseResponse(registerResponse);

      const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.email.trim(),
          password: form.password,
        }),
      });

      const loginData = await parseResponse(loginResponse);
      saveSessionAndGo(loginData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const onFieldChange = (field, value) => {
    setError('');
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="split-layout">
      {/* Left Panel */}
      <div className="split-left">
        <img 
          src={heroImage} 
          alt="Bodha Hero" 
          style={{ width: '100%', maxWidth: '350px', height: 'auto', marginBottom: '2rem' }} 
        />

        <div className="split-left-content">
          <h1 className="split-left-title brutalist-font">
            ENTER <br />
            <span className="text-accent-blue">BODHA.</span>
          </h1>
          <div className="title-underline"></div>
          <p className="split-left-subtitle">
            Your Personal AI Knowledge Gap Tutor. Master every concept.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="split-right bg-grid">
        <div className="auth-form-container">
          <div className="auth-badge">
            <span style={{ marginRight: '8px' }}>⚡</span> {modeLabel}
          </div>

          <h2 className="auth-title brutalist-font">{isSignup ? 'JOIN BODHA' : 'WELCOME BACK'}</h2>
          <p className="auth-desc">
            {isSignup ? 'Create your account to start learning.' : 'Enter your credentials to access your tutor.'}
          </p>

          <form onSubmit={isSignup ? handleCreateAccount : handleSignIn}>
            {isSignup && (
              <div className="form-group">
                <label className="form-label">Username</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="student001"
                    value={form.username}
                    onChange={(e) => onFieldChange('username', e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="student@bodha.edu" 
                  value={form.email}
                  onChange={(e) => onFieldChange('email', e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••" 
                  value={form.password}
                  onChange={(e) => onFieldChange('password', e.target.value)}
                  required 
                />
              </div>
            </div>

            {error && (
              <p style={{ color: '#b91c1c', fontFamily: 'Inter', fontWeight: 700, marginBottom: '1rem' }}>{error}</p>
            )}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'PLEASE WAIT' : modeLabel} <ArrowRight size={20} />
            </button>
          </form>

          <div className="auth-separator">
            <span>OR CONTINUE WITH</span>
          </div>

          {!GOOGLE_CLIENT_ID ? (
            <p style={{ color: '#b91c1c', fontFamily: 'Inter', fontWeight: 700 }}>
              Google Sign-In is not configured. Set VITE_GOOGLE_CLIENT_ID.
            </p>
          ) : (
            <div
              className="btn-google"
              style={{ display: 'flex', justifyContent: 'center', padding: '0.6rem' }}
            >
              <div ref={googleButtonRef} />
            </div>
          )}

          <div className="auth-footer">
            <button
              type="button"
              className="footer-link"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              onClick={() => {
                setIsSignup((prev) => !prev);
                setError('');
              }}
            >
              {isSignup ? 'BACK TO SIGN IN' : 'CREATE ACCOUNT'}
            </button>
            <span className="footer-copyright">BODHA © 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
