import { jsPDF } from 'jspdf';
import { supabase } from './supabaseClient';

export async function generateAndUploadPDF(
  formData: any,
  signatureImage: string,
  selfieImage: File | null,
  maintenanceShare: number,
  securityDeposit: number,
  totalPrice: number
) {
  const doc = new jsPDF();
  
  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('PERJANJIAN PERKONGSIAN KOS & PINJAMAN KENDERAAN PERSENDIRIAN', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('(VEHICLE BAILMENT AGREEMENT)', 105, 27, { align: 'center' });
  
  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, 32, 190, 32);

  // Borrower Details
  doc.setFontSize(10.5);
  doc.setFont('Helvetica', 'bold');
  doc.text('A. MAKLUMAT PEMINJAM (BORROWER)', 20, 42);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Nama Penuh (IC): ${formData.fullName.toUpperCase()}`, 20, 49);
  doc.text(`No. Kad Pengenalan: ${formData.icNumber}`, 20, 56);
  doc.text(`No. Lesen Memandu: ${formData.drivingLicense}`, 20, 63);
  doc.text(`Alamat Kediaman: ${formData.address}`, 20, 70);
  doc.text(`Hubungan Kecemasan: ${formData.emergencyContactName} (${formData.emergencyContactPhone})`, 20, 77);

  // Booking Details
  doc.setFontSize(10.5);
  doc.setFont('Helvetica', 'bold');
  doc.text('B. MAKLUMAT PINJAMAN & PECAHAN KOS', 20, 89);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Model Kenderaan: PROTON PERSONA (Auto)`, 20, 96);
  doc.text(`Tarikh & Masa Mula: ${new Date(formData.startDateTime).toLocaleString('ms-MY')}`, 20, 103);
  doc.text(`Tarikh & Masa Tamat: ${new Date(formData.endDateTime).toLocaleString('ms-MY')}`, 20, 110);
  
  // Pricing Breakdown Table
  doc.setFont('Helvetica', 'bold');
  doc.text(`Sumbangan Penyelenggaraan Kereta (Maintenance Share):`, 20, 120);
  doc.setFont('Helvetica', 'normal');
  doc.text(`RM ${maintenanceShare.toFixed(2)}`, 150, 120);

  doc.setFont('Helvetica', 'bold');
  doc.text(`Wang Cagaran Keselamatan (Security Deposit - Refundable):`, 20, 127);
  doc.setFont('Helvetica', 'normal');
  doc.text(`RM ${securityDeposit.toFixed(2)}`, 150, 127);

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 131, 190, 131);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`JUMLAH BESAR BAYARAN (TOTAL PAID):`, 20, 137);
  doc.text(`RM ${totalPrice.toFixed(2)}`, 150, 137);

  // Agreement Terms Title
  doc.setFontSize(10.5);
  doc.text('C. RINGKASAN TERMA & SYARAT UTAMA', 20, 149);

  // Agreement Terms (Bahasa Malaysia)
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  
  const terms = [
    "1. Duit bayaran dikira sebagai wang saguhati / sumbangan kos penyelenggaraan (car sharing) persendirian dan BUKAN sewaan komersial.",
    "2. Kenderaan dipasang peranti keselamatan enjin cut-off automatik sekiranya didapati keluar dari radius perjalanan tanpa izin.",
    "3. Peminjam WAJIB mengambil (pickup) dan mengembalikan kenderaan di kawasan pickup rasmi yang telah ditetapkan.",
    "4. Cagaran keselamatan RM50 akan dipulangkan semula dalam tempoh 3-5 hari bekerja selepas kenderaan dipulangkan dengan selamat.",
    "5. Peminjam WAJIB mengambil dan memuat naik foto bukti penunjuk minyak (fuel gauge) dan luaran kereta sebelum dan selepas pemanduan.",
    "6. Pemilik berhak menolak wang cagaran RM50 sekiranya lewat (caj overcharge RM20/jam), kereta kotor, minyak kurang, atau syarat dilanggar.",
    "7. Peminjam bertanggungjawab 100% ke atas sebarang saman (PDRM, JPJ, PBT) dan kos pembaikan kerosakan/kemalangan sepanjang trip."
  ];
  
  let y = 155;
  terms.forEach(term => {
    const splitText = doc.splitTextToSize(term, 170);
    doc.text(splitText, 20, y);
    y += splitText.length * 4 + 1.5;
  });

  // Digital Signature
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('DANDATANGAN DIGITAL PEMINJAM (E-SIGNATURE):', 20, 200);
  
  // Add signature image
  doc.addImage(signatureImage, 'PNG', 20, 204, 55, 22);
  
  // Meta Details on pdf
  doc.setFont('Helvetica', 'oblique');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const timeGenerated = new Date().toLocaleString('ms-MY');
  doc.text(`Dokumen e-perjanjian ini dijana secara digital pada ${timeGenerated} setelah pembayaran FPX disahkan.`, 20, 232);

  // Generate File Name
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = formData.fullName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const pdfName = `VBS_AGR_${dateStr}_${safeName}.pdf`;

  // Output as Blob
  const pdfBlob = doc.output('blob');
  
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('verification-documents')
    .upload(`contracts/${pdfName}`, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true
    });
    
  if (error) {
    throw error;
  }
  
  return { pdfPath: data.path, pdfName };
}
