'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Pendaftaran berjaya! Anda kini log masuk.');
      }
    } catch (error: any) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      {/* Tabs */}
      <div className="auth-tabs">
        <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>
          Log Masuk
        </button>
        <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>
          Daftar Akaun
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">{isLogin ? 'Selamat Datang Kembali 👋' : 'Cipta Akaun Baru'}</h2>
        <p className="text-sm" style={{ color: 'var(--text-3)', marginTop: '0.25rem' }}>
          {isLogin
            ? 'Log masuk untuk akses tempahan kenderaan anda.'
            : 'Daftar untuk mula membuat tempahan kenderaan.'}
        </p>
      </div>

      <form onSubmit={handleAuth}>
        <div className="form-group">
          <label className="form-label">Alamat E-mel</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            placeholder="contoh@email.com"
            required
          />
        </div>
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">Kata Laluan {!isLogin && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(minimum 6 aksara)</span>}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <button className="btn btn-primary w-full" type="submit" disabled={loading}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Memproses...
            </span>
          ) : isLogin ? 'Log Masuk →' : 'Daftar Sekarang →'}
        </button>
      </form>

      {/* Trust badges */}
      <div className="trust-row" style={{ marginTop: '1.25rem' }}>
        <div className="trust-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Selamat 100%
        </div>
        <div className="trust-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Data Dilindungi
        </div>
        <div className="trust-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3"/><circle cx="12" cy="10" r="3"/><circle cx="12" cy="12" r="10"/></svg>
          Tanpa Yuran Pendaftaran
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
