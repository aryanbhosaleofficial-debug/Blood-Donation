import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { ShieldCheck, HeartHandshake, Building2, Activity, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const user = await login(email, password);
      if (user) {
        const from = location.state?.from?.pathname;
        if (from && from !== '/login') {
          navigate(from, { replace: true });
        } else {
          switch (user.role) {
            case 'HOSPITAL':
              navigate('/hospital', { replace: true });
              break;
            case 'BLOOD_BANK':
              navigate('/blood-bank', { replace: true });
              break;
            case 'DONOR':
              navigate('/donor', { replace: true });
              break;
            case 'ADMIN':
              navigate('/admin/organizations', { replace: true });
              break;
            default:
              navigate('/', { replace: true });
          }
        }
      }
    } catch {
      // Generic message: do not reveal specifics to prevent account enumeration
      setError('Invalid email or password.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        maxWidth: 960,
        width: '100%',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Information Panel */}
      <div
        style={{
          backgroundColor: 'var(--color-primary-950)',
          color: '#FFFFFF',
          padding: 'var(--space-10) var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 'var(--space-8)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <div className="brand-icon-wrapper">
              <HeartHandshake size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-xl)', color: '#FFFFFF', fontWeight: 700 }}>BloodLink</h1>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Community Blood Network
              </span>
            </div>
          </div>

          <h2 style={{ fontSize: 'var(--font-size-2xl)', color: '#F8FAFC', marginBottom: 'var(--space-3)', fontWeight: 700, lineHeight: 1.3 }}>
            Emergency Red-Cell Sourcing & Coordination
          </h2>
          <p style={{ color: '#94A3B8', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
            Connect verified hospitals, participating blood banks, and potential community donors for rapid, auditable blood logistics.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <div style={{ padding: 6, borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-accent-400)' }}>
                <Building2 size={16} />
              </div>
              <div>
                <strong style={{ fontSize: 'var(--font-size-sm)', color: '#F1F5F9', display: 'block' }}>Hospital & Blood Bank Network</strong>
                <span style={{ fontSize: 'var(--font-size-xs)', color: '#94A3B8' }}>Atomic stock reservations and live request tracking.</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <div style={{ padding: 6, borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.08)', color: '#38BDF8' }}>
                <Activity size={16} />
              </div>
              <div>
                <strong style={{ fontSize: 'var(--font-size-sm)', color: '#F1F5F9', display: 'block' }}>Privacy-First Donor Coordination</strong>
                <span style={{ fontSize: 'var(--font-size-xs)', color: '#94A3B8' }}>Pseudonymous alerts with coarse travel ETAs.</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <div style={{ padding: 6, borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.08)', color: '#4ADE80' }}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <strong style={{ fontSize: 'var(--font-size-sm)', color: '#F1F5F9', display: 'block' }}>Operational Integrity</strong>
                <span style={{ fontSize: 'var(--font-size-xs)', color: '#94A3B8' }}>Append-only audit logs and surge demand surveillance.</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-4)', fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5 }}>
          Final donor screening, suitability evaluation, and transfusion decisions are handled by qualified medical professionals.
        </div>
      </div>

      {/* Login Form Card */}
      <div style={{ padding: 'var(--space-10) var(--space-8)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
            Sign in
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Enter your organization or donor credentials to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="login-email">Email</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="username"
                required
                disabled={busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="login-password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%' }}
              />
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={busy}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="form-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={busy}
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
          >
            Sign in
          </Button>

          <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Need help? Contact your hospital or blood-bank administrator.
          </div>
        </form>
      </div>
    </div>
  );
}
