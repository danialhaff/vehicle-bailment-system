'use client';

import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import { Session } from '@supabase/supabase-js';

export default function WizardForm({ session }: { session: Session | null }) {
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  
  // Steps: 1 = Tempahan, 2 = Dokumen (KYC), 3 = Perjanjian, 4 = Pembayaran, 5 = Sukses, 6 = Active Booking Dashboard
  const [step, setStep] = useState(paymentStatus === 'success' ? 5 : 1);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [sigHasMark, setSigHasMark] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    icNumber: '',
    drivingLicense: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    startDateTime: '',
    endDateTime: '',
  });

  // Files State (KYC)
  const [files, setFiles] = useState<{
    icFront: File | null;
    icBack: File | null;
    license: File | null;
    selfie: File | null;
  }>({ icFront: null, icBack: null, license: null, selfie: null });

  const [agreement, setAgreement] = useState(false);

  // Inline Auth State
  const [isRegister, setIsRegister] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [agreeToRegister, setAgreeToRegister] = useState(true);

  // Active Booking Dashboard State
  const [activeBooking, setActiveBooking] = useState<any | null>(null);
  const [checkingBooking, setCheckingBooking] = useState(false);
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [handoverPhotos, setHandoverPhotos] = useState<{
    fuelBefore: string | null;
    carBefore: string | null;
    fuelAfter: string | null;
    carAfter: string | null;
  }>({ fuelBefore: null, carBefore: null, fuelAfter: null, carAfter: null });

  // Pre-fill user data if already verified on session change
  useEffect(() => {
    if (session) {
      const meta = session.user?.user_metadata;
      if (meta?.is_verified) {
        setFormData(prev => ({
          ...prev,
          fullName: meta.fullName || prev.fullName,
          icNumber: meta.icNumber || prev.icNumber,
          drivingLicense: meta.drivingLicense || prev.drivingLicense,
          address: meta.address || prev.address,
          emergencyContactName: meta.emergencyContactName || prev.emergencyContactName,
          emergencyContactPhone: meta.emergencyContactPhone || prev.emergencyContactPhone,
        }));
      }
      // Check if user has an active booking (Paid or Pending)
      fetchActiveBooking(session.user);
    } else {
      // Clear active booking and reset to step 1 if logged out
      setActiveBooking(null);
      setStep(1);
    }
  }, [session]);

  useEffect(() => {
    if (paymentStatus === 'failed') alert('Pembayaran gagal. Sila cuba semula.');
  }, [paymentStatus]);

  // Fetch active booking of the logged in user
  const fetchActiveBooking = async (user: any) => {
    if (!user) return;
    setCheckingBooking(true);
    try {
      const icNumber = user.user_metadata?.icNumber;
      if (!icNumber) return;

      const { data: borrower } = await supabase
        .from('borrowers')
        .select('id')
        .eq('ic_number', icNumber)
        .maybeSingle();

      if (borrower) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('borrower_id', borrower.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (bookings && bookings.length > 0) {
          const latest = bookings[0];
          if (latest.payment_status === 'Paid') {
            setActiveBooking(latest);
            setStep(6); // Step 6: Active Booking Dashboard
            checkUploadedPhotos(latest.id);
            fetchContractUrl(latest.id);
          } else if (latest.payment_status === 'Pending') {
            setCurrentBookingId(latest.id);
            setStep(4); // Step 4: Payment screen
          }
        }
      }
    } catch (err) {
      console.error('Error fetching active booking:', err);
    } finally {
      setCheckingBooking(false);
    }
  };

  // Fetch signed PDF contract link
  const fetchContractUrl = async (bookingId: string) => {
    try {
      const { data } = await supabase
        .from('verification_media')
        .select('digital_signature_url')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (data?.digital_signature_url) {
        const publicUrl = supabase.storage
          .from('verification-documents')
          .getPublicUrl(data.digital_signature_url).data.publicUrl;
        setContractUrl(publicUrl);
      }
    } catch (err) {
      console.error('Error fetching contract link:', err);
    }
  };

  // Check which handover photos have already been uploaded
  const checkUploadedPhotos = async (bookingId: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('verification-documents')
        .list(`handovers`);

      if (data) {
        const photos = { fuelBefore: null, carBefore: null, fuelAfter: null, carAfter: null } as any;
        data.forEach(item => {
          if (item.name === `${bookingId}_fuel_before.png`) {
            photos.fuelBefore = supabase.storage.from('verification-documents').getPublicUrl(`handovers/${item.name}`).data.publicUrl;
          }
          if (item.name === `${bookingId}_car_before.png`) {
            photos.carBefore = supabase.storage.from('verification-documents').getPublicUrl(`handovers/${item.name}`).data.publicUrl;
          }
          if (item.name === `${bookingId}_fuel_after.png`) {
            photos.fuelAfter = supabase.storage.from('verification-documents').getPublicUrl(`handovers/${item.name}`).data.publicUrl;
          }
          if (item.name === `${bookingId}_car_after.png`) {
            photos.carAfter = supabase.storage.from('verification-documents').getPublicUrl(`handovers/${item.name}`).data.publicUrl;
          }
        });
        setHandoverPhotos(photos);
      }
    } catch (err) {
      console.error('Error listing photos:', err);
    }
  };

  // Upload handover photo (Before / After)
  const handleUploadPhoto = async (type: 'fuelBefore' | 'carBefore' | 'fuelAfter' | 'carAfter', file: File) => {
    if (!activeBooking) return;
    setLoading(true);
    try {
      const tag = type === 'fuelBefore' ? 'fuel_before' :
                  type === 'carBefore' ? 'car_before' :
                  type === 'fuelAfter' ? 'fuel_after' : 'car_after';
      const fileName = `${activeBooking.id}_${tag}.png`;

      const { data, error } = await supabase.storage
        .from('verification-documents')
        .upload(`handovers/${fileName}`, file, { upsert: true });

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('verification-documents')
        .getPublicUrl(`handovers/${fileName}`).data.publicUrl;

      setHandoverPhotos(prev => ({ ...prev, [type]: publicUrl }));
      alert('Foto berjaya dimuat naik!');
    } catch (err) {
      console.error('Upload photo error:', err);
      alert('Gagal memuat naik foto. Sila cuba semula.');
    } finally {
      setLoading(false);
    }
  };

  const totalDays = () => {
    if (!formData.startDateTime || !formData.endDateTime) return 1;
    const diff = new Date(formData.endDateTime).getTime() - new Date(formData.startDateTime).getTime();
    return diff <= 0 ? 1 : Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Kos Sumbangan Harian (RM100/hari)
  const calculateMaintenanceOnly = () => {
    return totalDays() * 100;
  };

  // Kos Cagaran Keselamatan (RM50)
  const calculateDeposit = () => {
    return 50;
  };

  // Jumlah Keseluruhan
  const calculatePrice = () => {
    return calculateMaintenanceOnly() + calculateDeposit();
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files: fl } = e.target;
    if (fl && fl.length > 0) setFiles(prev => ({ ...prev, [name]: fl[0] }));
  };

  const prevStep = () => setStep(p => p - 1);

  // Step 1 Submit (Public Select & Auth Flow)
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startDateTime || !formData.endDateTime || !formData.fullName || !formData.icNumber || !formData.drivingLicense || !formData.address) {
      alert('Sila lengkapkan semua maklumat tempahan dan profil.');
      return;
    }

    // Process inline Auth if there is no active session
    if (!session) {
      if (!authEmail || !authPassword) {
        alert('Sila masukkan alamat e-mel dan kata laluan untuk akaun anda.');
        return;
      }
      if (!agreeToRegister) {
        alert('Anda perlu bersetuju untuk mendaftar akaun untuk meneruskan.');
        return;
      }

      setAuthLoading(true);
      try {
        if (isRegister) {
          // Sign Up
          const { data, error } = await supabase.auth.signUp({
            email: authEmail,
            password: authPassword,
            options: {
              data: {
                fullName: formData.fullName,
                icNumber: formData.icNumber,
                is_verified: false // new account is unverified initially
              }
            }
          });
          if (error) throw error;
          alert('Pendaftaran berjaya! Akaun anda telah dicipta.');
          setStep(2); // Go to KYC documents upload
        } else {
          // Sign In
          const { data, error } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: authPassword
          });
          if (error) throw error;
          
          const meta = data.user?.user_metadata;
          if (meta?.is_verified) {
            // Already verified user, proceed straight to Step 4 (Payment)
            setStep(4);
            fetchActiveBooking(data.user);
          } else {
            // Unverified logged in user
            setStep(2);
          }
        }
      } catch (err: any) {
        alert(`Ralat log masuk/pendaftaran: ${err.message}`);
      } finally {
        setAuthLoading(false);
      }
    } else {
      // If already logged in, check verification status
      if (session.user?.user_metadata?.is_verified) {
        // Skip Step 2 and Step 3 entirely! Go straight to Payment Step 4.
        setLoading(true);
        try {
          // Pre-insert borrower and booking record to trigger Step 4
          const { data: borrower, error: bErr } = await supabase.from('borrowers').insert({
            full_name: formData.fullName,
            ic_number: formData.icNumber,
            driving_license_number: formData.drivingLicense,
            current_address: formData.address,
            emergency_contact_name: formData.emergencyContactName,
            emergency_contact_phone: formData.emergencyContactPhone
          }).select().single();
          if (bErr) throw bErr;

          const { data: booking, error: bookErr } = await supabase.from('bookings').insert({
            borrower_id: borrower.id,
            vehicle_model: 'Proton Persona',
            start_datetime: formData.startDateTime,
            end_datetime: formData.endDateTime,
            maintenance_share_amount: calculatePrice(),
            payment_status: 'Pending'
          }).select().single();
          if (bookErr) throw bookErr;

          setCurrentBookingId(booking.id);
          setStep(4);
        } catch (err: any) {
          console.error(err);
          alert('Ralat semasa menyediakan tempahan. Sila cuba semula.');
        } finally {
          setLoading(false);
        }
      } else {
        // Proceed to KYC document step
        setStep(2);
      }
    }
  };

  // Step 3 Agreement Submit (KYC Users)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sigCanvas.current?.isEmpty()) { alert('Sila tandatangan di dalam kotak yang disediakan.'); return; }
    if (!agreement) { alert('Anda perlu bersetuju dengan syarat perjanjian.'); return; }
    setLoading(true);
    try {
      const signatureImage = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') as string;
      const { generateAndUploadPDF } = await import('../lib/pdfGenerator');

      let selfiePath = null;
      if (files.selfie) {
        const { data, error } = await supabase.storage.from('verification-documents').upload(`selfies/${Date.now()}_${files.selfie.name}`, files.selfie);
        if (error) throw error;
        selfiePath = data.path;
      }
      let icPath = null, licensePath = null;
      if (files.icFront) {
        const { data, error } = await supabase.storage.from('verification-documents').upload(`ic/${Date.now()}_${files.icFront.name}`, files.icFront);
        if (error) throw error;
        icPath = data.path;
      }
      if (files.license) {
        const { data, error } = await supabase.storage.from('verification-documents').upload(`license/${Date.now()}_${files.license.name}`, files.license);
        if (error) throw error;
        licensePath = data.path;
      }

      // Generate the signed agreement PDF
      const { pdfPath } = await generateAndUploadPDF(
        formData, 
        signatureImage, 
        files.selfie, 
        calculateMaintenanceOnly(), 
        calculateDeposit(), 
        calculatePrice()
      );

      // Insert Borrower
      const { data: borrower, error: bErr } = await supabase.from('borrowers').insert({
        full_name: formData.fullName, ic_number: formData.icNumber,
        driving_license_number: formData.drivingLicense, current_address: formData.address,
        emergency_contact_name: formData.emergencyContactName, emergency_contact_phone: formData.emergencyContactPhone
      }).select().single();
      if (bErr) throw bErr;

      // Insert Booking
      const { data: booking, error: bookErr } = await supabase.from('bookings').insert({
        borrower_id: borrower.id, vehicle_model: 'Proton Persona',
        start_datetime: formData.startDateTime, end_datetime: formData.endDateTime,
        maintenance_share_amount: calculatePrice(), payment_status: 'Pending'
      }).select().single();
      if (bookErr) throw bookErr;

      setCurrentBookingId(booking.id);
      
      // Insert Verification Media
      await supabase.from('verification_media').insert({ 
        booking_id: booking.id, 
        ic_photo_url: icPath, 
        license_photo_url: licensePath, 
        selfie_ic_url: selfiePath, 
        digital_signature_url: pdfPath 
      });

      // Update the user's Auth metadata to set is_verified = true
      await supabase.auth.updateUser({
        data: {
          is_verified: true,
          fullName: formData.fullName,
          icNumber: formData.icNumber,
          drivingLicense: formData.drivingLicense,
          address: formData.address,
          emergencyContactName: formData.emergencyContactName,
          emergencyContactPhone: formData.emergencyContactPhone
        }
      });

      setStep(4);
    } catch (err) {
      console.error(err);
      alert('Ralat semasa menghantar maklumat. Sila semak konsol.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: currentBookingId, 
          fullName: formData.fullName, 
          email: session?.user?.email || 'customer@example.com', 
          amount: calculatePrice(), 
          icNumber: formData.icNumber 
        })
      });
      const data = await res.json();
      if (data.url) { 
        window.location.href = data.url; 
      } else {
        throw new Error('Tiada URL dari ToyyibPay');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memulakan pembayaran. Sila cuba semula.');
      setLoading(false);
    }
  };

  const steps = [
    { label: 'Tempahan', num: 1 },
    { label: 'Dokumen', num: 2 },
    { label: 'Perjanjian', num: 3 },
  ];

  if (checkingBooking) {
    return (
      <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Menyemak status tempahan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Stepper */}
      {step < 4 && (
        <div className="stepper">
          {steps.map((s, i) => (
            <div key={s.num} className={`step-item ${step === s.num ? 'active' : step > s.num ? 'done' : ''}`}>
              <div className="step-circle">
                {step > s.num ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : s.num}
              </div>
              <span className="step-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── STEP 1: Public Booking & Profile ─── */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit}>
          <h2 className="section-title">📅 Tempah Slot Perjalanan</h2>
          <p className="section-subtitle">Pilih tarikh pinjaman kenderaan Proton Persona secara terus</p>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Tarikh & Masa Mula</label>
              <input type="datetime-local" name="startDateTime" value={formData.startDateTime} onChange={handleInput} className="form-input" required />
            </div>
            <div className="form-group">
              <label className="form-label">Tarikh & Masa Tamat</label>
              <input type="datetime-local" name="endDateTime" value={formData.endDateTime} onChange={handleInput} className="form-input" required />
            </div>
          </div>

          {(formData.startDateTime && formData.endDateTime) && (
            <div className="price-box" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="price-box-label" style={{ fontSize: '0.85rem' }}>🗓 Kos Perkongsian Penyelenggaraan ({totalDays()} hari):</span>
                <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>RM {calculateMaintenanceOnly().toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="price-box-label" style={{ fontSize: '0.85rem' }}>🔒 Wang Cagaran Keselamatan (Security Deposit - Dipulangkan):</span>
                <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>RM {calculateDeposit().toFixed(2)}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.2rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="price-box-label" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-2)' }}>Jumlah Anggaran Bayaran:</span>
                <span className="price-box-amount" style={{ fontSize: '1.6rem' }}>RM {calculatePrice().toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="divider" />

          <div className="form-group">
            <label className="form-label">Nama Penuh (seperti dalam IC)</label>
            <input type="text" name="fullName" value={formData.fullName} onChange={handleInput} className="form-input" placeholder="cth: Ahmad Bin Ismail" required />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">No. IC</label>
              <input type="text" name="icNumber" value={formData.icNumber} onChange={handleInput} className="form-input" placeholder="xxxxxx-xx-xxxx" required />
            </div>
            <div className="form-group">
              <label className="form-label">No. Lesen Memandu</label>
              <input type="text" name="drivingLicense" value={formData.drivingLicense} onChange={handleInput} className="form-input" placeholder="cth: D1234567" required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Alamat Tempat Tinggal</label>
            <textarea name="address" value={formData.address} onChange={handleInput} className="form-input form-textarea" rows={2} placeholder="No. rumah, jalan, bandar, negeri" required />
          </div>

          <div className="form-group">
            <label className="form-label">Kenalan Kecemasan (Ibu Bapa / Waris)</label>
            <div className="form-grid-2">
              <input type="text" name="emergencyContactName" placeholder="Nama penuh" value={formData.emergencyContactName} onChange={handleInput} className="form-input" required />
              <input type="tel" name="emergencyContactPhone" placeholder="cth: 012-3456789" value={formData.emergencyContactPhone} onChange={handleInput} className="form-input" required />
            </div>
          </div>

          {/* Inline Auth Block if not logged in */}
          {!session && (
            <div style={{ background: 'rgba(59,125,216,0.06)', border: '1px dashed rgba(59,125,216,0.3)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginTop: '1.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-2)' }}>
                  {isRegister ? '🔑 Cipta Akaun Baharu untuk Tempah' : '🔑 Log Masuk Akaun Sedia Ada'}
                </h3>
                <button type="button" onClick={() => setIsRegister(!isRegister)} style={{ background: 'none', border: 'none', color: 'var(--purple)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                  {isRegister ? 'Log Masuk di sini' : 'Daftar Akaun Baru'}
                </button>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Alamat E-mel</label>
                  <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="form-input" placeholder="contoh@email.com" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Kata Laluan</label>
                  <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="form-input" placeholder="••••••••" required minLength={6} />
                </div>
              </div>

              <label className="agreement-row" style={{ padding: '0.5rem', background: 'none', border: 'none', margin: '0.5rem 0 0 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={agreeToRegister} onChange={e => setAgreeToRegister(e.target.checked)} className="agreement-check" style={{ width: '16px', height: '16px' }} />
                <span className="agreement-text" style={{ fontSize: '0.78rem' }}>Saya setuju untuk register account/login bagi menyelesaikan tempahan ini.</span>
              </label>
            </div>
          )}

          <div className="form-nav">
            <div />
            <button className="btn btn-primary" type="submit" disabled={authLoading || loading}>
              {authLoading ? '⏳ Memproses...' : session?.user?.user_metadata?.is_verified ? '⚡ Tempah & Bayar Secara Terus' : 'Seterusnya →'}
            </button>
          </div>
        </form>
      )}

      {/* ─── STEP 2: KYC Documents ─── */}
      {step === 2 && (
        <div>
          <h2 className="section-title">🪪 Pengesahan Identiti (KYC)</h2>
          <p className="section-subtitle">Muat naik dokumen sah untuk pengesahan satu kali akaun anda</p>

          {[
            { name: 'icFront', label: 'Depan IC (MyKad)', icon: '🪪' },
            { name: 'icBack', label: 'Belakang IC (MyKad)', icon: '🪪' },
            { name: 'license', label: 'Kad Lesen Memandu', icon: '🚗' },
          ].map(item => (
            <div className="upload-card" key={item.name}>
              <div className="upload-card-label">
                <div className="upload-card-icon">{item.icon}</div>
                {item.label}
              </div>
              <input type="file" name={item.name} accept="image/*" onChange={handleFile} className="form-input" />
            </div>
          ))}

          <div className="selfie-box">
            <div className="selfie-box-title">📸 Foto Pengesahan Diri</div>
            <p className="selfie-box-desc">Ambil gambar jelas dengan memegang IC anda di sebelah muka untuk pengesahan keselamatan.</p>
            <input type="file" name="selfie" accept="image/*" capture="user" onChange={handleFile} className="form-input" />
          </div>

          <div className="form-nav">
            <button className="btn btn-secondary" onClick={prevStep}>← Kembali</button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!files.icFront || !files.icBack || !files.license || !files.selfie}>Seterusnya →</button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Agreement & Signature ─── */}
      {step === 3 && (
        <div>
          <h2 className="section-title">📜 Perjanjian & Tandatangan</h2>
          <p className="section-subtitle">Sila baca dan tandatangani dokumen perjanjian Vehicle Bailment</p>

          {/* Premium T&C PDF link display */}
          <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-1)' }}>Terma & Syarat Pinjaman Kenderaan (PDF)</h4>
            <p className="text-sm" style={{ color: 'var(--text-2)', marginBottom: '1rem', maxWidth: '380px', margin: '0 auto 1.25rem' }}>
              Terma ini mentakrifkan sumbangan saguhati, sistem enjin cut-off perjalanan, zon pickup, deposit RM50, caj overcharge, dan pemotongan cagaran.
            </p>
            <a href="/api/tnc" target="_blank" className="btn btn-secondary" style={{ display: 'inline-flex', padding: '0.5rem 1.25rem', fontSize: '0.85rem', color: 'var(--primary-2)' }}>
              🌐 Baca Terma & Syarat (Buka PDF)
            </a>
          </div>

          <label className="agreement-row">
            <input type="checkbox" checked={agreement} onChange={e => setAgreement(e.target.checked)} className="agreement-check" />
            <span className="agreement-text">Saya telah membaca, memahami, dan bersetuju dengan semua syarat dalam dokumen PDF Terma & Syarat di atas.</span>
          </label>

          <div style={{ marginBottom: '1.25rem' }}>
            <div className="sig-header">
              <span className="sig-label">Tandatangan Digital Anda</span>
              <button className="sig-clear" onClick={() => { sigCanvas.current?.clear(); setSigHasMark(false); }}>Padam</button>
            </div>
            <div className="signature-container">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{ style: { width: '100%', height: '150px', display: 'block' } }}
                penColor="#1a1a2e"
                onEnd={() => setSigHasMark(true)}
              />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-3)', marginTop: '0.3rem' }}>Sila tanda di atas kotak putih menggunakan jari atau tetikus anda</p>
          </div>

          <div className="form-nav">
            <button className="btn btn-secondary" onClick={prevStep} disabled={loading}>← Kembali</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !agreement || !sigHasMark}>
              {loading ? '⏳ Memproses...' : '✍️ Tandatangan & Teruskan'}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 4: Payment ─── */}
      {step === 4 && (
        <div className="payment-screen">
          <div className="payment-badge">⚡ BAYARAN FPX DIPERLUKAN</div>
          <h2 className="section-title" style={{ marginBottom: '0.35rem' }}>Selesaikan Pembayaran</h2>
          <p className="text-sm text-text-2" style={{ marginBottom: 0 }}>Tempahan anda sedia untuk disahkan. Sila jelaskan bayaran untuk tempahan.</p>

          <div className="payment-summary">
            <div className="summary-row">
              <span className="summary-row-label">Kenderaan</span>
              <span className="summary-row-val">🚗 Proton Persona (Auto)</span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Tempoh Pemanduan</span>
              <span className="summary-row-val">{totalDays()} hari</span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Sumbangan Penyelenggaraan</span>
              <span className="summary-row-val">RM {calculateMaintenanceOnly().toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Cagaran Keselamatan (Deposit)</span>
              <span className="summary-row-val">RM {calculateDeposit().toFixed(2)}</span>
            </div>
            <div className="summary-row summary-total">
              <span className="summary-row-label">Jumlah Caj Pembayaran</span>
              <span className="summary-row-val">RM {calculatePrice().toFixed(2)}</span>
            </div>
          </div>

          <div className="payment-methods">
            {['FPX', 'Maybank2U', 'CIMB Clicks', 'Bank Islam'].map(m => (
              <div key={m} className="payment-method-chip" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>🏦 {m}</div>
            ))}
          </div>

          <button className="btn-pay" onClick={handlePayment} disabled={loading}>
            {loading ? '⏳ Membuka ToyyibPay...' : `💳 Bayar RM ${calculatePrice().toFixed(2)} via FPX`}
          </button>
          <p className="payment-note">Anda akan dibawa ke perbankan selamat ToyyibPay. Cagaran RM50 akan dipulangkan selepas pemulangan kenderaan selamat.</p>
        </div>
      )}

      {/* ─── STEP 5: Success ─── */}
      {step === 5 && (
        <div className="success-screen">
          <div className="success-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="success-title">Tempahan Berjaya! 🎉</h2>
          <p className="text-sm" style={{ color: 'var(--text-3)', marginBottom: '1rem' }}>Maklumat anda disahkan, kontrak e-tandatangan telah dimuat naik, dan pembayaran telah disahkan.</p>

          <div className="success-cards" style={{ marginBottom: '1.5rem' }}>
            {[
              { icon: '📄', label: 'Kontrak Perjanjian PDF telah dijana' },
              { icon: '🔒', label: 'Pengesahan KYC Ahli disimpan selamat' },
              { icon: '💳', label: 'Jumlah FPX (Sumbangan + Deposit) dibayar' },
              { icon: '🚗', label: 'Sila masuk Papan Pemuka untuk foto trip' },
            ].map(f => (
              <div className="success-feat" key={f.label}>
                <div className="success-feat-icon">{f.icon}</div>
                {f.label}
              </div>
            ))}
          </div>

          <button className="btn btn-primary w-full" onClick={() => {
            if (session) fetchActiveBooking(session.user);
            else setStep(1);
          }}>
            🔌 Buka Papan Pemuka Tempahan Aktif
          </button>
        </div>
      )}

      {/* ─── STEP 6: Active Booking Dashboard ─── */}
      {step === 6 && activeBooking && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--success)', background: 'var(--success-bg)', padding: '0.25rem 0.6rem', borderRadius: '99px', fontWeight: 700 }}>🚗 TEMPAHAN AKTIF (LUNAS)</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Ref: #{activeBooking.id.slice(0, 8).toUpperCase()}</span>
          </div>

          <h2 className="section-title">Papan Pemuka Tempahan</h2>
          <p className="section-subtitle" style={{ marginBottom: '1rem' }}>Uruskan foto takat penunjuk minyak dan keadaan fizikal kereta sebelum & selepas perjalanan.</p>

          {/* Trip Info Glass Box */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
              <div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>Mula Perjalanan:</div>
                <div style={{ fontWeight: 600, color: 'var(--text-1)', marginTop: '0.15rem' }}>{new Date(activeBooking.start_datetime).toLocaleString('ms-MY')}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>Tamat Perjalanan:</div>
                <div style={{ fontWeight: 600, color: 'var(--text-1)', marginTop: '0.15rem' }}>{new Date(activeBooking.end_datetime).toLocaleString('ms-MY')}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>Model Kereta:</div>
                <div style={{ fontWeight: 600, color: 'var(--text-1)', marginTop: '0.15rem' }}>🚗 PROTON PERSONA (Auto)</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>Cagaran Keselamatan:</div>
                <div style={{ fontWeight: 600, color: 'var(--warning)', marginTop: '0.15rem' }}>RM 50.00 (Dipegang)</div>
              </div>
            </div>
            
            {contractUrl && (
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                <a href={contractUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', color: 'var(--primary-2)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  📄 Muat Turun Perjanjian Bertandatangan (PDF)
                </a>
              </div>
            )}
          </div>

          {/* Handover Upload Fasa 1 (Sebelum Trip) */}
          <div style={{ background: 'rgba(6,11,20,0.4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--primary-2)', marginBottom: '0.3rem' }}>📸 Fasa 1: Sebelum Mula Trip (Handover)</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: '1rem' }}>Wajib dimuat naik sebelum mengambil kunci dan memandu kenderaan.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {/* Fuel Before */}
              <div style={{ background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.5rem' }}>⛽ Minyak Sebelum</div>
                {handoverPhotos.fuelBefore ? (
                  <div style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={handoverPhotos.fuelBefore} alt="Fuel Before" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div>
                    <label className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-block' }}>
                      📷 Ambil Foto
                      <input type="file" accept="image/*" capture="environment" onChange={e => { if (e.target.files?.[0]) handleUploadPhoto('fuelBefore', e.target.files[0]); }} style={{ display: 'none' }} />
                    </label>
                  </div>
                )}
              </div>

              {/* Car Before */}
              <div style={{ background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.5rem' }}>🚗 Fizikal Sebelum</div>
                {handoverPhotos.carBefore ? (
                  <div style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={handoverPhotos.carBefore} alt="Car Before" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div>
                    <label className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-block' }}>
                      📷 Ambil Foto
                      <input type="file" accept="image/*" capture="environment" onChange={e => { if (e.target.files?.[0]) handleUploadPhoto('carBefore', e.target.files[0]); }} style={{ display: 'none' }} />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Handover Upload Fasa 2 (Selepas Trip) */}
          <div style={{ background: 'rgba(6,11,20,0.4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--purple)', marginBottom: '0.3rem' }}>📸 Fasa 2: Selepas Tamat Trip (Return)</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: '1rem' }}>Wajib dimuat naik sejurus sebelum mengembalikan kunci dan mengunci kenderaan.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {/* Fuel After */}
              <div style={{ background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.5rem' }}>⛽ Minyak Selepas</div>
                {handoverPhotos.fuelAfter ? (
                  <div style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={handoverPhotos.fuelAfter} alt="Fuel After" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div>
                    {(!handoverPhotos.fuelBefore || !handoverPhotos.carBefore) ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'inline-block', padding: '0.35rem 0' }}>🔒 Sila selesai Fasa 1</span>
                    ) : (
                      <label className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-block' }}>
                        📷 Ambil Foto
                        <input type="file" accept="image/*" capture="environment" onChange={e => { if (e.target.files?.[0]) handleUploadPhoto('fuelAfter', e.target.files[0]); }} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Car After */}
              <div style={{ background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.5rem' }}>🚗 Fizikal Selepas</div>
                {handoverPhotos.carAfter ? (
                  <div style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={handoverPhotos.carAfter} alt="Car After" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div>
                    {(!handoverPhotos.fuelBefore || !handoverPhotos.carBefore) ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'inline-block', padding: '0.35rem 0' }}>🔒 Sila selesai Fasa 1</span>
                    ) : (
                      <label className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-block' }}>
                        📷 Ambil Foto
                        <input type="file" accept="image/*" capture="environment" onChange={e => { if (e.target.files?.[0]) handleUploadPhoto('carAfter', e.target.files[0]); }} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-3)' }}>
            ⚠️ Sila pastikan enjin kenderaan ditutup sepenuhnya selepas pemulangan disahkan di zon pickup. Enjin cut-off teknologi akan diaktifkan secara automatik sekiranya kenderaan keluar dari had perjalanan.
          </div>
        </div>
      )}
    </div>
  );
}
