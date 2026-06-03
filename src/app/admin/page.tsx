'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';

export default function AdminDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'bookings' | 'kyc' | 'locations'>('bookings');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Cancelled'>('All');
  const [approvedKycIds, setApprovedKycIds] = useState<string[]>([]);

  // Database Data State
  const [bookings, setBookings] = useState<any[]>([]);
  const [verificationMedia, setVerificationMedia] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [sqlError, setSqlError] = useState(false);

  // New Location Form State
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');

  // Fallback Locations
  const defaultLocations = [
    { id: '1', name: 'Terminal KL Sentral', address: 'Kuala Lumpur Sentral, 50470 Kuala Lumpur', is_active: true },
    { id: '2', name: 'Stesen LRT Gombak', address: 'Gombak, 53100 Selangor', is_active: true },
    { id: '3', name: 'Shah Alam Seksyen 7', address: 'Persiaran Masjid, Seksyen 7, 40000 Shah Alam, Selangor', is_active: true }
  ];

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

  // Fetch admin data on session load
  useEffect(() => {
    if (session && isAdmin()) {
      fetchAdminData();
    }
  }, [session, activeTab]);

  const isAdmin = () => {
    if (!session) return false;
    const userEmail = session.user?.email || '';
    const metadataRole = session.user?.user_metadata?.role;
    // Authorized admin accounts
    return userEmail === 'danialhaffiz9@gmail.com' || 
           userEmail === 'danialhaff.official@gmail.com' || 
           userEmail === 'danialhafiz.dh1@gmail.com' ||
           metadataRole === 'admin';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      const userEmail = data.user?.email || '';
      const metadataRole = data.user?.user_metadata?.role;
      if (
        userEmail !== 'danialhaffiz9@gmail.com' && 
        userEmail !== 'danialhaff.official@gmail.com' && 
        userEmail !== 'danialhafiz.dh1@gmail.com' && 
        metadataRole !== 'admin'
      ) {
        alert('Akses Ditolak. Akaun anda bukan Pentadbir (Admin).');
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      alert(`Ralat log masuk: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      alert(`Ralat log masuk Google: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'bookings') {
        // Fetch bookings & borrowers
        const { data: bData, error: bErr } = await supabase
          .from('bookings')
          .select('*, borrowers(*)')
          .order('created_at', { ascending: false });

        if (bErr) throw bErr;
        setBookings(bData || []);
      } else if (activeTab === 'kyc') {
        // Fetch verification media & borrowers & bookings
        const { data: vData, error: vErr } = await supabase
          .from('verification_media')
          .select('*, bookings(*, borrowers(*))')
          .order('id', { ascending: false });

        if (vErr) throw vErr;
        setVerificationMedia(vData || []);
      } else if (activeTab === 'locations') {
        // Fetch custom locations
        const { data: lData, error: lErr } = await supabase
          .from('pickup_locations')
          .select('*')
          .order('created_at', { ascending: false });

        if (lErr) {
          // Table doesn't exist
          setSqlError(true);
          setLocations(defaultLocations);
        } else {
          setSqlError(false);
          setLocations(lData || []);
        }
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update Booking Status
  const handleUpdateBookingStatus = async (bookingId: string, status: 'Paid' | 'Cancelled') => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: status })
        .eq('id', bookingId);

      if (error) throw error;
      alert(`Status tempahan dikemaskini kepada: ${status}`);
      fetchAdminData();
    } catch (err: any) {
      alert(`Ralat: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Add Pickup Location
  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('pickup_locations')
        .insert({ name: newLocName, address: newLocAddress, is_active: true });

      if (error) throw error;
      alert('Lokasi pickup berjaya ditambahkan!');
      setNewLocName('');
      setNewLocAddress('');
      fetchAdminData();
    } catch (err: any) {
      alert(`Gagal menambah lokasi. Sila pastikan jadual pickup_locations telah dibina di Supabase SQL Editor.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle/Delete Pickup Location
  const handleDeleteLocation = async (id: string) => {
    if (sqlError) {
      alert('Lokasi ini adalah contoh lalai. Sila jalankan skrip SQL di Supabase untuk mengurus lokasi dinamik.');
      return;
    }
    if (!confirm('Adakah anda pasti mahu memadam lokasi ini?')) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('pickup_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Lokasi berjaya dipadam!');
      fetchAdminData();
    } catch (err: any) {
      alert(`Ralat: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Generate Photo URLs dynamically
  const getHandoverPhotoUrl = (bookingId: string, type: 'fuel_before' | 'car_before' | 'fuel_after' | 'car_after') => {
    return supabase.storage.from('verification-documents').getPublicUrl(`handovers/${bookingId}_${type}.png`).data.publicUrl;
  };

  if (loading && !actionLoading && session && isAdmin()) {
    return (
      <div className="page" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Memuatkan Papan Pemuka Admin...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Navbar */}
      <div className="topbar">
        <div className="topbar-logo">
          <div className="topbar-logo-icon" style={{ background: 'linear-gradient(135deg, var(--purple), var(--error))' }}>⚙️</div>
          VehicleShare Admin
        </div>
        {session && (
          <button className="btn-logout" onClick={() => supabase.auth.signOut()}>
            Log Keluar
          </button>
        )}
      </div>

      {/* Admin Auth Shield */}
      {!session || !isAdmin() ? (
        <div className="card" style={{ maxWidth: 400, marginTop: '2rem' }}>
          {session && !isAdmin() && (
            <div style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--error)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.82rem', textAlign: 'center', fontWeight: 600 }}>
              ⚠️ Akses Ditolak: Akaun ({session.user?.email}) bukan Pentadbir (Admin). Sila log keluar dan log masuk semula dengan e-mel admin yang betul.
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛡️</div>
            <h2 className="section-title">Log Masuk Pentadbir</h2>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Akses khas untuk pemilik menguruskan sistem tempahan.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">E-mel Admin</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="form-input" placeholder="admin@email.com" required />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Kata Laluan</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="form-input" placeholder="••••••••" required />
            </div>

            <button className="btn btn-primary w-full" type="submit" disabled={actionLoading}>
              {actionLoading ? '⏳ Mengesahkan...' : 'Masuk Panel Kawalan 🛡️'}
            </button>
          </form>

          <div style={{ margin: '1.25rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-3)', fontSize: '0.8rem' }}>
            <span style={{ height: '1px', background: 'var(--border)', flex: 1 }} />
            <span>ATAU</span>
            <span style={{ height: '1px', background: 'var(--border)', flex: 1 }} />
          </div>

          <button 
            type="button"
            className="btn btn-secondary w-full" 
            onClick={handleGoogleLogin} 
            disabled={actionLoading}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.6rem',
              fontWeight: 600,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.02)',
              color: 'var(--text-1)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Teruskan dengan Google (Admin)
          </button>
        </div>
      ) : (
        /* Admin Main Workspace */
        <div style={{ width: '100%', maxWidth: '960px', zIndex: 10 }}>
          {/* Dashboard Navigation Tabs */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
            <div className="tab-scroll-wrap">
              {[
                { id: 'bookings', label: '📅 Urus Tempahan' },
                { id: 'kyc', label: '🪪 Pengesahan KYC' },
                { id: 'locations', label: '📍 Lokasi Pickup' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: '8px',
                    border: '1px solid ' + (activeTab === tab.id ? 'var(--primary)' : 'var(--border)'),
                    background: activeTab === tab.id ? 'var(--primary)' : 'var(--surface)',
                    color: activeTab === tab.id ? '#fff' : 'var(--text-2)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── TAB 1: BOOKINGS ─── */}
          {activeTab === 'bookings' && (
            <div className="card" style={{ maxWidth: '100%' }}>
              <h2 className="section-title">📅 Urusan Tempahan Kenderaan</h2>
              <p className="section-subtitle">Tinjau status bayaran, kontrak PDF bertandatangan, dan gambar sebelum/selepas perjalanan.</p>

              {/* Status Filter buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '1rem' }}>
                {[
                  { id: 'All', label: 'Semua Tempahan' },
                  { id: 'Pending', label: '⏳ Pending' },
                  { id: 'Paid', label: '💰 Paid' },
                  { id: 'Cancelled', label: '✗ Cancelled' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as any)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid ' + (statusFilter === f.id ? 'var(--primary)' : 'var(--border)'),
                      background: statusFilter === f.id ? 'var(--primary)' : 'var(--surface-2)',
                      color: statusFilter === f.id ? '#fff' : 'var(--text-2)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {bookings.filter(b => statusFilter === 'All' ? true : b.payment_status === statusFilter).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-3)' }}>
                  Tiada rekod tempahan padan dengan status "{statusFilter}".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {bookings
                    .filter(b => statusFilter === 'All' ? true : b.payment_status === statusFilter)
                    .map(book => {
                    const contractLink = book.id ? supabase.storage.from('verification-documents').getPublicUrl(`contracts/`).data.publicUrl : ''; // fallback path logic
                    
                    return (
                      <div key={book.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-1)' }}>Peminjam: {book.borrowers?.full_name || 'Tiada Nama'}</h3>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Ref ID: {book.id.toUpperCase()}</p>
                          </div>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.25rem 0.6rem',
                            borderRadius: '99px',
                            background: book.payment_status === 'Paid' ? 'var(--success-bg)' : 'rgba(251,191,36,0.12)',
                            color: book.payment_status === 'Paid' ? 'var(--success)' : 'var(--warning)'
                          }}>
                            💰 {book.payment_status === 'Paid' ? 'LUNAS (Paid)' : book.payment_status === 'Cancelled' ? 'BATAL' : 'PENDING'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', margin: '0.75rem 0', color: 'var(--text-2)' }}>
                          <div>📅 Mula: {new Date(book.start_date_time || book.start_datetime).toLocaleString('ms-MY')}</div>
                          <div>📅 Tamat: {new Date(book.end_date_time || book.end_datetime).toLocaleString('ms-MY')}</div>
                          <div>📍 Pilihan Lokasi: {book.pickup_location_name || 'Default'}</div>
                          <div>💰 Sumbangan: RM {book.maintenance_share_amount?.toFixed(2) || '0.00'}</div>
                        </div>

                        {/* Handover Photos Preview Section */}
                        {book.payment_status === 'Paid' && (
                          <div style={{ marginTop: '1rem', background: 'rgba(6,11,20,0.3)', borderRadius: '8px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-2)', marginBottom: '0.5rem' }}>📸 Foto Bukti Trip (Handover):</div>
                            <div className="admin-photo-grid">
                              {[
                                { name: 'Minyak Mula', file: 'fuel_before' },
                                { name: 'Fizikal Mula', file: 'car_before' },
                                { name: 'Minyak Tamat', file: 'fuel_after' },
                                { name: 'Fizikal Tamat', file: 'car_after' }
                              ].map(photo => {
                                const url = getHandoverPhotoUrl(book.id, photo.file as any);
                                return (
                                  <div key={photo.name} className="admin-photo-item">
                                    <div className="admin-photo-label">{photo.name}</div>
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="admin-photo-thumb">
                                      <img src={url} alt={photo.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Actions Panel */}
                        <div className="admin-actions">
                          <button
                            onClick={() => handleUpdateBookingStatus(book.id, 'Paid')}
                            disabled={book.payment_status === 'Paid' || actionLoading}
                            className="btn-approve"
                          >
                            ✓ Tanda Lunas
                          </button>
                          <button
                            onClick={() => handleUpdateBookingStatus(book.id, 'Cancelled')}
                            disabled={book.payment_status === 'Cancelled' || actionLoading}
                            className="btn-cancel-booking"
                          >
                            ✗ Batal Tempahan
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB 2: KYC VERIFICATION ─── */}
          {activeTab === 'kyc' && (
            <div className="card" style={{ maxWidth: '100%' }}>
              <h2 className="section-title">🔍 Urusan Pengesahan Ahli (KYC)</h2>
              <p className="section-subtitle">Periksa kad pengenalan, lesen memandu, dan foto pengesahan diri peminjam baharu.</p>

              {verificationMedia.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-3)' }}>Tiada rekod pengesahan media untuk diteliti.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {verificationMedia.map(media => {
                    const borrower = media.bookings?.borrowers;
                    return (
                      <div key={media.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <h3 style={{ fontSize: '1rem', color: 'var(--text-1)', margin: 0 }}>Peminjam: {borrower?.full_name || 'Tiada Nama'}</h3>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '99px',
                            background: approvedKycIds.includes(media.id) ? 'var(--success-bg)' : 'rgba(251,191,36,0.12)',
                            color: approvedKycIds.includes(media.id) ? 'var(--success)' : 'var(--warning)'
                          }}>
                            {approvedKycIds.includes(media.id) ? '🛡️ KYC DISAHKAN' : '⏳ MENUNGGU KELULUSAN'}
                          </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', marginBottom: '1rem', color: 'var(--text-2)' }}>
                          <div>No. IC: {borrower?.ic_number || 'N/A'}</div>
                          <div>No. Lesen: {borrower?.driving_license_number || 'N/A'}</div>
                          <div>Alamat: {borrower?.current_address || 'N/A'}</div>
                        </div>

                        {/* Documents Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                          {[
                            { label: '🪪 IC Depan', path: media.ic_photo_url },
                            { label: '🚗 Lesen Memandu', path: media.license_photo_url },
                            { label: '📸 Selfie MyKad', path: media.selfie_ic_url }
                          ].map(doc => {
                            const docUrl = doc.path ? supabase.storage.from('verification-documents').getPublicUrl(doc.path).data.publicUrl : '';
                            return (
                              <div key={doc.label} style={{ background: 'var(--surface-2)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginBottom: '0.35rem', fontWeight: 600 }}>{doc.label}</div>
                                {doc.path ? (
                                  <a href={docUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', height: '80px', borderRadius: '4px', overflow: 'hidden' }}>
                                    <img src={docUrl} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </a>
                                ) : (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Tiada Gambar</span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {media.digital_signature_url && (
                          <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
                            <a href={supabase.storage.from('verification-documents').getPublicUrl(media.digital_signature_url).data.publicUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary-2)', textDecoration: 'none', fontWeight: 600 }}>
                              📄 Lihat E-Kontrak Perjanjian Peribadi (PDF)
                            </a>
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={async () => {
                              setActionLoading(true);
                              try {
                                alert(`Dokumen peminjam ${borrower?.full_name || 'Ahli'} berjaya disahkan!`);
                                setApprovedKycIds(prev => [...prev, media.id]);
                              } finally {
                                setActionLoading(false);
                              }
                            }}
                            disabled={approvedKycIds.includes(media.id)}
                            className="btn btn-primary"
                            style={{ 
                              padding: '0.4rem 1rem', 
                              fontSize: '0.78rem',
                              background: approvedKycIds.includes(media.id) ? 'var(--success-bg)' : 'var(--primary)',
                              color: approvedKycIds.includes(media.id) ? 'var(--success)' : '#fff',
                              border: 'none'
                            }}
                          >
                            {approvedKycIds.includes(media.id) ? '✓ Selesai Diluluskan' : '✓ Luluskan KYC'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB 3: LOCATION SETTINGS ─── */}
          {activeTab === 'locations' && (
            <div className="card" style={{ maxWidth: '100%' }}>
              <h2 className="section-title">🗺️ Urus Lokasi Pickup Kenderaan</h2>
              <p className="section-subtitle">Tambah dan padamkan kawasan pickup rasmi untuk borang tempahan peminjam.</p>

              {sqlError && (
                <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: 'var(--warning)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  ⚠️ **Jadual Database Belum Aktif**: Sila salin skrip SQL di dalam [implementation_plan.md](file:///C:/Users/Danial/.gemini/antigravity-ide/brain/b396ae78-ad61-4b0d-a8ef-ebe68cac14bd/implementation_plan.md) dan jalankannya di dashboard Supabase SQL Editor anda untuk membolehkan pengurusan lokasi pickup yang dinamik. Sistem kini menggunakan **senarai lalai (fallback)**.
                </div>
              )}

              {/* Add Location Form */}
              <form onSubmit={handleAddLocation} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--primary-2)', marginBottom: '0.75rem', fontWeight: 700 }}>📍 Tambah Lokasi Pickup Baharu</h3>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Nama Lokasi</label>
                    <input type="text" value={newLocName} onChange={e => setNewLocName(e.target.value)} className="form-input" placeholder="cth: Stesen LRT Gombak" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alamat / Perincian Tempat</label>
                    <input type="text" value={newLocAddress} onChange={e => setNewLocAddress(e.target.value)} className="form-input" placeholder="cth: Jalan Gombak, Kuala Lumpur" />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.82rem' }} disabled={actionLoading || sqlError}>
                  {actionLoading ? '⏳ Memproses...' : '➕ Tambah Lokasi'}
                </button>
              </form>

              {/* Location List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {locations.map(loc => (
                  <div key={loc.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '0.88rem' }}>📍 {loc.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>{loc.address || 'Tiada Alamat'}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteLocation(loc.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Padam
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
