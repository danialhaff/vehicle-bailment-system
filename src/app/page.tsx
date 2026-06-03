'use client';

import React, { useState, useEffect, Suspense } from 'react';
import WizardForm from '../components/WizardForm';
import Auth from '../components/Auth';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="page" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Memuatkan...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Top Navigation Bar */}
      <div className="topbar">
        <div className="topbar-logo">
          <div className="topbar-logo-icon">🚗</div>
          VehicleShare
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!session && (
            <a href="/admin" style={{ fontSize: '0.75rem', color: 'var(--text-3)', textDecoration: 'none', fontWeight: 600, padding: '0.35rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
              Admin ⚙️
            </a>
          )}
          {session && (
            <button className="btn-logout" onClick={() => supabase.auth.signOut()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Log Keluar
            </button>
          )}
        </div>
      </div>

      {/* Hero Header */}
      {!session && (
        <>
          {/* Animated Car Visual */}
          <div className="car-visual-wrap">
            <div className="car-visual-glow" />
            <div className="car-visual-ring" />
            <div className="car-visual-ring-2" />
            <span className="car-emoji">🚗</span>
          </div>

          <div className="hero">
            <div className="hero-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
              Sistem Disahkan &amp; Selamat
            </div>
            <h1 className="hero-title">Kongsi Kereta,{'\n'}Bukan Risiko</h1>
            <p className="hero-subtitle">
              Platform pengesahan pinjaman kenderaan persendirian dengan e-tandatangan dan log masuk Google.
            </p>
          </div>

          {/* Feature Strip */}
          <div className="feature-strip">
            {[
              { icon: '📋', label: 'Kontrak Digital' },
              { icon: '🛡️', label: 'Pengesahan KYC' },
              { icon: '💳', label: 'Bayar FPX' },
            ].map(f => (
              <div key={f.label} className="feature-chip">
                <div className="feature-chip-icon">{f.icon}</div>
                <div className="feature-chip-label">{f.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Hero for logged in users */}
      {session && (
        <div className="hero" style={{ marginBottom: '0.5rem' }}>
          <div className="hero-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
            Sistem Disahkan &amp; Selamat
          </div>
          <h1 className="hero-title">Tempahan Kenderaan</h1>
          <p className="hero-subtitle">
            Uruskan tempahan aktif, penyerahan foto takat minyak &amp; keadaan fizikal serta sejarah perjalanan anda.
          </p>
        </div>
      )}

      {/* Main Content: Conditionally show Auth Wall or WizardForm */}
      {!session ? (
        <Auth />
      ) : (
        <Suspense fallback={<div style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Memuatkan borang...</div>}>
          <WizardForm session={session} />
        </Suspense>
      )}

      {/* Footer */}
      <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-3)', zIndex: 10 }}>
        <p>© 2025 VehicleShare · Selamat · Dipercayai</p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
