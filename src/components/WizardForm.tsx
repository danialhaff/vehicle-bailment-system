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
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (paymentStatus === 'success') {
      setStep(5);
    } else if (paymentStatus === 'failed') {
      alert('Payment failed. Please try again.');
    }
  }, [paymentStatus]);

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

  const [files, setFiles] = useState<{
    icFront: File | null;
    icBack: File | null;
    license: File | null;
    selfie: File | null;
  }>({
    icFront: null,
    icBack: null,
    license: null,
    selfie: null,
  });

  const [agreement, setAgreement] = useState(false);

  const calculatePrice = () => {
    if (!formData.startDateTime || !formData.endDateTime) return 100;
    const start = new Date(formData.startDateTime).getTime();
    const end = new Date(formData.endDateTime).getTime();
    const diffTime = end - start;
    if (diffTime <= 0) return 100; // Minimum RM100
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays * 100;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files: fileList } = e.target;
    if (fileList && fileList.length > 0) {
      setFiles((prev) => ({ ...prev, [name]: fileList[0] }));
    }
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sigCanvas.current?.isEmpty()) {
      alert('Please provide your digital signature.');
      return;
    }
    if (!agreement) {
      alert('You must agree to the terms.');
      return;
    }
    
    setLoading(true);
    try {
      const signatureImage = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') as string;
      const { generateAndUploadPDF } = await import('../lib/pdfGenerator');
      
      const totalPrice = calculatePrice();

      // 1. Upload Selfie to Storage
      let selfiePath = null;
      if (files.selfie) {
        const { data, error } = await supabase.storage
          .from('verification-documents')
          .upload(`selfies/${Date.now()}_${files.selfie.name}`, files.selfie);
        if (error) throw error;
        selfiePath = data.path;
      }

      // 2. Upload IC and License
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

      // 3. Generate and Upload PDF Contract
      const { pdfPath } = await generateAndUploadPDF(formData, signatureImage, files.selfie, totalPrice);

      // 4. Insert Borrower
      const { data: borrower, error: borrowerError } = await supabase.from('borrowers').insert({
        full_name: formData.fullName,
        ic_number: formData.icNumber,
        driving_license_number: formData.drivingLicense,
        current_address: formData.address,
        emergency_contact_name: formData.emergencyContactName,
        emergency_contact_phone: formData.emergencyContactPhone
      }).select().single();

      if (borrowerError) throw borrowerError;

      // 5. Insert Booking
      const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
        borrower_id: borrower.id,
        vehicle_model: 'Proton Persona',
        start_datetime: formData.startDateTime,
        end_datetime: formData.endDateTime,
        maintenance_share_amount: totalPrice,
        payment_status: 'Pending' // Set explicit initial state for payment
      }).select().single();

      if (bookingError) throw bookingError;
      
      setCurrentBookingId(booking.id);

      // 6. Insert Media
      await supabase.from('verification_media').insert({
        booking_id: booking.id,
        ic_photo_url: icPath,
        license_photo_url: licensePath,
        selfie_ic_url: selfiePath,
        digital_signature_url: pdfPath 
      });
      
      setStep(4); // Move to Payment Step
    } catch (error) {
      console.error(error);
      alert('An error occurred during submission. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/create-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: currentBookingId,
          fullName: formData.fullName,
          email: 'customer@example.com', // If you have auth email, pass it here
          amount: calculatePrice(),
          icNumber: formData.icNumber
        })
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to ToyyibPay
      } else {
        throw new Error('No URL returned from ToyyibPay');
      }
    } catch (error) {
      console.error(error);
      alert('Payment initialization failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="glass-container max-w-2xl w-full">
      {step < 4 && (
        <div className="mb-6 flex justify-between items-center text-sm">
          <span className={step >= 1 ? 'text-accent-color font-bold' : 'text-text-secondary'}>1. Booking & Profile</span>
          <span className="text-border-color">──</span>
          <span className={step >= 2 ? 'text-accent-color font-bold' : 'text-text-secondary'}>2. KYC</span>
          <span className="text-border-color">──</span>
          <span className={step >= 3 ? 'text-accent-color font-bold' : 'text-text-secondary'}>3. Agreement</span>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="mb-4">Booking Details & Profile</h2>
          
          <div className="flex gap-4 mb-4">
            <div className="form-group w-full">
              <label className="form-label">Start Date & Time</label>
              <input type="datetime-local" name="startDateTime" value={formData.startDateTime} onChange={handleInputChange} className="form-input" required />
            </div>
            <div className="form-group w-full">
              <label className="form-label">End Date & Time</label>
              <input type="datetime-local" name="endDateTime" value={formData.endDateTime} onChange={handleInputChange} className="form-input" required />
            </div>
          </div>
          
          <div className="p-4 mb-4 rounded-lg bg-surface-hover text-center">
            <p className="text-sm text-text-secondary mb-1">Estimated Cost (RM 100/day)</p>
            <h3 className="text-2xl text-accent-color">RM {calculatePrice().toFixed(2)}</h3>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="form-input" required />
          </div>
          <div className="flex gap-4">
            <div className="form-group w-full">
              <label className="form-label">IC Number</label>
              <input type="text" name="icNumber" value={formData.icNumber} onChange={handleInputChange} className="form-input" required />
            </div>
            <div className="form-group w-full">
              <label className="form-label">Driving License Number</label>
              <input type="text" name="drivingLicense" value={formData.drivingLicense} onChange={handleInputChange} className="form-input" required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Current Address</label>
            <textarea name="address" value={formData.address} onChange={handleInputChange} className="form-textarea" rows={3} required />
          </div>
          <div className="form-group">
            <label className="form-label">Emergency Contact (Parents / Next of Kin)</label>
            <div className="flex gap-4">
              <input type="text" name="emergencyContactName" placeholder="Name" value={formData.emergencyContactName} onChange={handleInputChange} className="form-input w-full" required />
              <input type="tel" name="emergencyContactPhone" placeholder="Phone Number" value={formData.emergencyContactPhone} onChange={handleInputChange} className="form-input w-full" required />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button className="btn btn-primary" onClick={nextStep} disabled={!formData.fullName || !formData.icNumber || !formData.startDateTime}>Next Step</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="mb-4">KYC & Identity Verification</h2>
          <div className="form-group">
            <label className="form-label">Front of IC</label>
            <input type="file" name="icFront" accept="image/*" onChange={handleFileChange} className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Back of IC</label>
            <input type="file" name="icBack" accept="image/*" onChange={handleFileChange} className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Driving License</label>
            <input type="file" name="license" accept="image/*" onChange={handleFileChange} className="form-input" />
          </div>
          
          <div className="p-4 mb-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '8px' }}>
            <h3 className="text-accent-color">Identity Verification Photo</h3>
            <p className="text-sm mb-2">Take a clear selfie holding your physical IC next to your face for security verification.</p>
            <input type="file" name="selfie" accept="image/*" capture="user" onChange={handleFileChange} className="form-input w-full bg-transparent border-none p-0" />
          </div>

          <div className="flex justify-between mt-4">
            <button className="btn btn-secondary" onClick={prevStep}>Back</button>
            <button className="btn btn-primary" onClick={nextStep}>Next Step</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="mb-4">Vehicle Loan Agreement</h2>
          
          <div className="terms-box">
            <h4>PERJANJIAN PINJAMAN KENDERAAN PERSENDIRIAN (VEHICLE BAILMENT)</h4>
            <p className="mb-2"><strong>1. PENGAKUAN PINJAMAN:</strong> Pemilik bersetuju meminjamkan kenderaan Proton Persona kepada Peminjam bagi tempoh slot masa yang dipersetujui untuk kegunaan logistik peribadi. Transaksi ini berkonsepkan perkongsian kos penyelenggaraan (Car Sharing) dan bukannya sewaan komersial.</p>
            <p className="mb-2"><strong>2. TANGGUNGJAWAB KEROSAKAN & KEMALANGAN:</strong> Peminjam mengaku bertanggungjawab sepenuhnya ke atas keselamatan kenderaan sepanjang tempoh jagaan. Sekiranya berlaku sebarang kemalangan, kerosakan, atau kehilangan kenderaan akibat kecuaian peminjam, Peminjam WAJIB menanggung 100% kos pembaikan kenderaan Pemilik serta ganti rugi pihak ketiga secara tunai atau ansuran.</p>
            <p className="mb-2"><strong>3. SAMAN & PENYALAHGUNAAN:</strong> Sebarang saman lalu lintas (PDRM/JPJ/PBT) atau salah guna kenderaan untuk aktiviti jenayah sepanjang tempoh slot ini adalah tanggungan mutlak Peminjam.</p>
            <p><strong>4. CAGARAN KESELAMATAN:</strong> Peminjam bersetuju mendepositkan wang jaminan (Security Deposit) yang akan dipulangkan semula dalam tempoh 3-5 hari selepas kenderaan dipulangkan dengan selamat.</p>
            <p className="mt-4 text-accent-color font-bold">Total Cost: RM {calculatePrice().toFixed(2)}</p>
          </div>

          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={agreement} onChange={(e) => setAgreement(e.target.checked)} className="w-5 h-5 accent-accent-color" />
            <span className="text-sm">I fully understand and agree to the terms of this vehicle loan agreement</span>
          </label>

          <div className="form-group">
            <label className="form-label">Digital Signature</label>
            <div className="signature-container bg-white">
              <SignatureCanvas 
                ref={sigCanvas} 
                canvasProps={{ className: 'w-full h-40', style: { width: '100%', height: '160px' } }}
                penColor="black"
              />
            </div>
            <button className="text-sm text-text-secondary hover:text-text-primary text-right" onClick={() => sigCanvas.current?.clear()}>Clear Signature</button>
          </div>

          <div className="flex justify-between mt-4">
            <button className="btn btn-secondary" onClick={prevStep} disabled={loading}>Back</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !agreement}>
              {loading ? 'Processing...' : 'Sign & Proceed to Payment'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="text-center py-8">
           <h2 className="mb-2">Payment Required</h2>
           <p className="text-text-secondary mb-6">Your verification is submitted successfully. Please complete the payment to finalize the booking.</p>
           
           <div className="p-6 mb-6 rounded-lg border border-border-color bg-surface-hover inline-block text-left w-full max-w-sm mx-auto">
              <div className="flex justify-between mb-2 border-b border-border-color pb-2">
                <span>Vehicle:</span>
                <span className="font-bold text-white">Proton Persona</span>
              </div>
              <div className="flex justify-between mb-2 border-b border-border-color pb-2">
                <span>Booking Amount:</span>
                <span className="font-bold text-white">RM {calculatePrice().toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-accent-color font-bold text-lg">Total to Pay:</span>
                <span className="font-bold text-accent-color text-lg">RM {calculatePrice().toFixed(2)}</span>
              </div>
           </div>

           <div>
            <button className="btn btn-primary w-full max-w-sm mb-2" onClick={handleSimulatePayment} disabled={loading}>
              {loading ? 'Redirecting to FPX / Bank...' : 'Pay with FPX / Bank (Simulate)'}
            </button>
            <p className="text-xs text-text-secondary mt-4">(This is a simulated payment gateway. Clicking Pay will update your Supabase database payment_status to 'Paid')</p>
           </div>
        </div>
      )}

      {step === 5 && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-color bg-opacity-20 text-success-color mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 className="mb-2">Booking & Verification Complete!</h2>
          <p className="mb-6">Your details have been securely saved, agreement signed, and payment received.</p>
          <button className="btn btn-primary" onClick={() => {
            setStep(1);
            setFormData({ ...formData, startDateTime: '', endDateTime: '' });
            setAgreement(false);
          }}>Start New Application</button>
        </div>
      )}
    </div>
  );
}
