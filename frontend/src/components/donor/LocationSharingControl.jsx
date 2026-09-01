import React, { useState, useEffect, useRef } from 'react';
import { formatDateTime } from '../../utils/dates.js';
import { Button } from '../common/Button.jsx';
import { Navigation, ShieldCheck, MapPin, Radio, AlertCircle } from 'lucide-react';
import { useToast } from '../common/ToastContext.jsx';

export function LocationSharingControl({ pledge, onStart, onStop }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const toast = useToast();

  const isSharingActive = Boolean(pledge?.locationSharing?.isActive);
  const expiresAt = pledge?.locationSharing?.expiresAt;

  // Cleanup any active geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const handleToggle = async () => {
    setBusy(true);
    setError(null);

    try {
      if (isSharingActive) {
        // Stop location sharing
        if (watchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        await onStop();
        toast.info('Location sharing stopped.');
      } else {
        // Start location sharing with explicit user consent
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          throw new Error('Location sharing requires HTTPS or localhost in your browser.');
        }

        if (!navigator.geolocation) {
          throw new Error('Geolocation is unavailable in this browser.');
        }

        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            maximumAge: 30000,
            timeout: 15000,
          });
        });

        await onStart({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        toast.success('Temporary location sharing active.');
      }
    } catch (err) {
      const msg = err && err.message ? err.message : 'Could not update location sharing.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" style={{ marginTop: 'var(--space-6)' }}>
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ShieldCheck size={18} style={{ color: 'var(--color-primary-800)' }} />
          Temporary Location Sharing
        </h3>
        {isSharingActive ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-success)',
              fontWeight: 600,
              padding: '0.25rem 0.65rem',
              backgroundColor: 'var(--color-success-bg)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-success-border)',
            }}
          >
            <Radio size={12} className="animate-pulse" /> Location sharing active
          </span>
        ) : (
          <span className="status-badge status-closed">Off</span>
        )}
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-surface-subtle)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.5,
        }}
      >
        <strong>Privacy Protocol:</strong> Your precise location is used only to compute coarse travel distance and estimated arrival ETA bands (e.g. 15–30 min) for the requesting hospital. Exact latitude and longitude are never shown to hospital staff and automatically delete upon expiration.
      </div>

      {error && (
        <div className="form-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <p style={{ margin: 'var(--space-2) 0', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
        {isSharingActive ? (
          <span style={{ color: 'var(--color-success)' }}>
            ● Location sharing active (expires {formatDateTime(expiresAt)})
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>○ Location sharing is currently off.</span>
        )}
      </p>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Button
          variant={isSharingActive ? 'secondary' : 'primary'}
          disabled={busy}
          loading={busy}
          onClick={handleToggle}
          icon={<Navigation size={16} />}
        >
          {busy
            ? 'Updating…'
            : isSharingActive
              ? 'Stop Location Sharing'
              : 'Start Location Sharing'}
        </Button>
      </div>
    </section>
  );
}
