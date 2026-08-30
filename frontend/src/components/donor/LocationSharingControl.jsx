import React, { useState, useEffect, useRef } from 'react';
import { formatDateTime } from '../../utils/dates.js';

export function LocationSharingControl({ pledge, onStart, onStop }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);

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
      }
    } catch (err) {
      setError(err && err.message ? err.message : 'Could not update location sharing.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" style={{ marginTop: '1rem' }}>
      <h3>Temporary Location Sharing</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        Your location is used temporarily to compute coarse travel ETA for the hospital. Exact coordinates are never displayed to the hospital and are automatically deleted when sharing stops or the request completes.
      </p>

      {error && (
        <div className="form-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <p style={{ margin: '0.5rem 0', fontWeight: 500 }}>
        {isSharingActive ? (
          <span style={{ color: 'var(--success)' }}>
            ● Location sharing active (expires {formatDateTime(expiresAt)})
          </span>
        ) : (
          <span style={{ color: 'var(--muted)' }}>○ Location sharing is currently off.</span>
        )}
      </p>

      <div style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className={isSharingActive ? 'btn btn-secondary' : 'btn btn-primary'}
          disabled={busy}
          onClick={handleToggle}
        >
          {busy
            ? 'Updating…'
            : isSharingActive
              ? 'Stop Location Sharing'
              : 'Start Location Sharing'}
        </button>
      </div>
    </section>
  );
}
