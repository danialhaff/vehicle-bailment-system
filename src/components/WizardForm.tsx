'use client';

import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '../lib/supabaseClient';
import { useSearchParams } from 'next/navigation';

export default function WizardForm() {
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  const [step, setStep] = useState(paymentStatus === 'success' ? 5 : 1);
  const [loading, setLoading] = useState(false);
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [sigHasMark, setSigHasMark] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

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

  const [files, setFiles] = useState<{
    icFront: File | null;
    icBack: File | null;
    license: File | null;
    selfie: File | null;
  }>({ icFront: null, icBack: null, license: null, selfie: null });

  const [agreement, setAgreement] = useState(false);

  useEffect(() => {
    if (paymentStatus === 'failed') alert('Pembayaran gagal. Sila cuba semula.');
  }, [paymentStatus]);

  const calculatePrice = () => {
    if (!formData.startDateTime || !formData.endDateTime) return 100;
    const diff = new Date(formData.endDateTime).getTime() - new Date(formData.startDateTime).getTime();
    if (diff <= 0) return 100;
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) * 100;
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files: fl } = e.target;
    if (fl && fl.length > 0) setFiles(prev => ({ ...prev, [name]: fl[0] }));
  };

  const nextStep = () => setStep(p => p + 1);
  const prevStep = () => setStep(p => p - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sigCanvas.current?.isEmpty()) { alert('Sila tandatangan di dalam kotak yang disediakan.'); return; }
    if (!agreement) { alert('Anda perlu bersetuju dengan syarat perjanjian.'); return; }
    setLoading(true);
    try {
      const signatureImage = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') as string;
      const { generateAndUploadPDF } = await import('../lib/pdfGenerator');
      const totalPrice = calculatePrice();

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

      const { pdfPath } = await generateAndUploadPDF(formData, signatureImage, files.selfie, totalPrice);

      const { data: borrower, error: bErr } = await supabase.from('borrowers').insert({
        full_name: formData.fullName, ic_number: formData.icNumber,
        driving_license_number: formData.drivingLicense, current_address: formData.address,
        emergency_contact_name: formData.emergencyContactName, emergency_contact_phone: formData.emergencyContactPhone
      }).select().single();
      if (bErr) throw bErr;

      const { data: booking, error: bookErr } = await supabase.from('bookings').insert({
        borrower_id: borrower.id, vehicle_model: 'Proton Persona',
        start_datetime: formData.startDateTime, end_datetime: formData.endDateTime,
        maintenance_share_amount: totalPrice, payment_status: 'Pending'
      }).select().single();
      if (bookErr) throw bookErr;

      setCurrentBookingId(booking.id);
      await supabase.from('verification_media').insert({ booking_id: booking.id, ic_photo_url: icPath, license_photo_url: licensePath, selfie_ic_url: selfiePath, digital_signature_url: pdfPath });
      setStep(4);
    } catch (err) {
      console.error(err);
      alert('Ralat semasa menghantar maklumat. Sila semak konsol untuk maklumat lanjut.');
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
        body: JSON.stringify({ bookingId: currentBookingId, fullName: formData.fullName, email: 'customer@example.com', amount: calculatePrice(), icNumber: formData.icNumber })
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else throw new Error('Tiada URL dari ToyyibPay');
    } catch (err) {
      console.error(err);
      alert('Gagal memulakan pembayaran. Sila cuba semula.');
      setLoading(false);
    }
  };

  const totalDays = () => {
    if (!formData.startDateTime || !formData.endDateTime) return 1;
    const diff = new Date(formData.endDateTime).getTime() - new Date(formData.startDateTime).getTime();
    return diff <= 0 ? 1 : Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const steps = [
    { label: 'Tempahan', num: 1 },
    { label: 'Dokumen', num: 2 },
    { label: 'Perjanjian', num: 3 },
  ];

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

      {/* ─── STEP 1: Booking & Profile ─── */}
      {step === 1 && (
        <div>
          <h2 className="section-title">📅 Pilih Tarikh & Maklumat</h2>
          <p className="section-subtitle">Tetapkan tarikh pinjaman dan isi maklumat diri anda</p>

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
            <div className="price-box">
              <div>
                <div className="price-box-label">Jumlah Kos Dijangkakan</div>
                <div className="price-box-amount">RM {calculatePrice().toFixed(2)}</div>
              </div>
              <div className="price-box-rate">
                🗓 {totalDays()} hari × RM 100/hari
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

          <div className="form-nav">
            <div />
            <button className="btn btn-primary" onClick={nextStep} disabled={!formData.fullName || !formData.icNumber || !formData.startDateTime || !formData.endDateTime}>
              Seterusnya →
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: KYC Documents ─── */}
      {step === 2 && (
        <div>
          <h2 className="section-title">🪪 Pengesahan Identiti (KYC)</h2>
          <p className="section-subtitle">Muat naik dokumen sah untuk pengesahan akaun anda</p>

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
            <button className="btn btn-primary" onClick={nextStep}>Seterusnya →</button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Agreement & Signature ─── */}
      {step === 3 && (
        <div>
          <h2 className="section-title">📜 Perjanjian & Tandatangan</h2>
          <p className="section-subtitle">Baca dan tandatangani perjanjian pinjaman kenderaan</p>

          <div className="terms-box">
            <h4>PERJANJIAN PINJAMAN KENDERAAN PERSENDIRIAN (VEHICLE BAILMENT)</h4>
            {[
              { title: '1. PENGAKUAN PINJAMAN', body: 'Pemilik bersetuju meminjamkan kenderaan Proton Persona kepada Peminjam bagi tempoh slot masa yang dipersetujui untuk kegunaan logistik peribadi. Transaksi ini berkonsepkan perkongsian kos penyelenggaraan (Car Sharing) dan bukannya sewaan komersial.' },
              { title: '2. TANGGUNGJAWAB KEROSAKAN & KEMALANGAN', body: 'Peminjam mengaku bertanggungjawab sepenuhnya ke atas keselamatan kenderaan sepanjang tempoh jagaan. Sekiranya berlaku sebarang kemalangan atau kerosakan, Peminjam WAJIB menanggung 100% kos pembaikan.' },
              { title: '3. SAMAN & PENYALAHGUNAAN', body: 'Sebarang saman lalu lintas (PDRM/JPJ/PBT) atau salah guna kenderaan untuk aktiviti jenayah sepanjang tempoh slot ini adalah tanggungan mutlak Peminjam.' },
              { title: '4. CAGARAN KESELAMATAN', body: 'Peminjam bersetuju mendepositkan wang jaminan (Security Deposit) yang akan dipulangkan semula dalam tempoh 3-5 hari selepas kenderaan dipulangkan dengan selamat.' },
            ].map(c => (
              <div className="terms-clause" key={c.title}>
                <strong>{c.title}:</strong> {c.body}
              </div>
            ))}
            <div className="price-summary">💰 Jumlah Kos: RM {calculatePrice().toFixed(2)}</div>
          </div>

          <label className="agreement-row">
            <input type="checkbox" checked={agreement} onChange={e => setAgreement(e.target.checked)} className="agreement-check" />
            <span className="agreement-text">Saya telah membaca, memahami, dan bersetuju dengan semua syarat dalam perjanjian pinjaman kenderaan ini.</span>
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
            <p className="text-sm" style={{ color: 'var(--text-3)', marginTop: '0.3rem' }}>Tanda di atas kotak putih menggunakan jari atau tetikus anda</p>
          </div>

          <div className="form-nav">
            <button className="btn btn-secondary" onClick={prevStep} disabled={loading}>← Kembali</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !agreement}>
              {loading ? '⏳ Memproses...' : '✍️ Tandatangan & Bayar'}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 4: Payment ─── */}
      {step === 4 && (
        <div className="payment-screen">
          <div className="payment-badge">⚡ BAYARAN DIPERLUKAN</div>
          <h2 className="section-title" style={{ marginBottom: '0.35rem' }}>Selesaikan Bayaran</h2>
          <p className="text-sm text-text-2" style={{ marginBottom: 0 }}>Pengesahan anda telah berjaya dihantar. Sila bayar untuk mengesahkan tempahan.</p>

          <div className="payment-summary">
            <div className="summary-row">
              <span className="summary-row-label">Kenderaan</span>
              <span className="summary-row-val">🚗 Proton Persona</span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Tempoh</span>
              <span className="summary-row-val">{totalDays()} hari</span>
            </div>
            <div className="summary-row">
              <span className="summary-row-label">Kadar</span>
              <span className="summary-row-val">RM 100 / hari</span>
            </div>
            <div className="summary-row summary-total">
              <span className="summary-row-label">Jumlah Bayaran</span>
              <span className="summary-row-val">RM {calculatePrice().toFixed(2)}</span>
            </div>
          </div>

          <div className="payment-methods">
            {['FPX', 'Maybank2U', 'CIMB Clicks', 'HLB Connect'].map(m => (
              <div key={m} className="payment-method-chip">🏦 {m}</div>
            ))}
          </div>

          <button className="btn-pay" onClick={handlePayment} disabled={loading}>
            {loading ? '⏳ Membuka halaman pembayaran...' : `💳 Bayar RM ${calculatePrice().toFixed(2)} via FPX`}
          </button>
          <p className="payment-note">Anda akan dibawa ke halaman perbankan selamat (ToyyibPay). Setelah berjaya, anda akan dikembalikan ke sini secara automatik.</p>
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
          <p className="text-sm" style={{ color: 'var(--text-3)', marginBottom: 0 }}>Maklumat anda telah disimpan, perjanjian telah ditandatangani, dan pembayaran telah diterima.</p>

          <div className="success-cards">
            {[
              { icon: '📄', label: 'Kontrak PDF telah dijana' },
              { icon: '🔒', label: 'Dokumen KYC disimpan selamat' },
              { icon: '💳', label: 'Pembayaran FPX berjaya' },
              { icon: '✅', label: 'Status: Menunggu pengesahan' },
            ].map(f => (
              <div className="success-feat" key={f.label}>
                <div className="success-feat-icon">{f.icon}</div>
                {f.label}
              </div>
            ))}
          </div>

          <button className="btn btn-primary w-full" onClick={() => { setStep(1); setAgreement(false); setSigHasMark(false); setFormData({ fullName:'', icNumber:'', drivingLicense:'', address:'', emergencyContactName:'', emergencyContactPhone:'', startDateTime:'', endDateTime:'' }); }}>
            + Buat Tempahan Baru
          </button>
        </div>
      )}
    </div>
  );
}
