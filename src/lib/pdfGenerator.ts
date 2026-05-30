import { jsPDF } from 'jspdf';
import { supabase } from './supabaseClient';

export async function generateAndUploadPDF(
  formData: any,
  signatureImage: string,
  selfieImage: File | null,
  totalPrice: number
) {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.text('PERJANJIAN PINJAMAN KENDERAAN PERSENDIRIAN', 105, 20, { align: 'center' });
  doc.text('(VEHICLE BAILMENT)', 105, 28, { align: 'center' });
  
  // Borrower Details
  doc.setFontSize(12);
  doc.text(`Name: ${formData.fullName}`, 20, 45);
  doc.text(`IC Number: ${formData.icNumber}`, 20, 55);
  doc.text(`License Number: ${formData.drivingLicense}`, 20, 65);
  doc.text(`Address: ${formData.address}`, 20, 75);
  doc.text(`Emergency Contact: ${formData.emergencyContactName} (${formData.emergencyContactPhone})`, 20, 85);

  // Booking Details
  doc.setFontSize(11);
  doc.text(`Booking Start: ${new Date(formData.startDateTime).toLocaleString()}`, 20, 95);
  doc.text(`Booking End: ${new Date(formData.endDateTime).toLocaleString()}`, 20, 105);
  doc.text(`Total Maintenance Share (Cost): RM ${totalPrice.toFixed(2)}`, 20, 115);

  // Agreement Terms
  doc.setFontSize(10);
  const terms = [
    "1. PENGAKUAN PINJAMAN: Pemilik bersetuju meminjamkan kenderaan Proton Persona...",
    "2. TANGGUNGJAWAB KEROSAKAN & KEMALANGAN: Peminjam mengaku bertanggungjawab...",
    "3. SAMAN & PENYALAHGUNAAN: Sebarang saman lalu lintas adalah tanggungan Peminjam.",
    "4. CAGARAN KESELAMATAN: Peminjam bersetuju mendepositkan wang jaminan."
  ];
  
  let y = 130;
  terms.forEach(term => {
    doc.text(term, 20, y, { maxWidth: 170 });
    y += 15;
  });

  // Digital Signature
  doc.text('Signature:', 20, y + 10);
  doc.addImage(signatureImage, 'PNG', 20, y + 15, 60, 30);
  
  // Generate File Name
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = formData.fullName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const pdfName = `AGR_${dateStr}_${safeName}.pdf`;

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
