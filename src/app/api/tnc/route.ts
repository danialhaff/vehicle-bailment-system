import { jsPDF } from 'jspdf';

export async function GET() {
  const doc = new jsPDF();

  // Header & Styling
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('TERMA & SYARAT PERSETUJUAN PINJAMAN KENDERAAN', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('Helvetica', 'oblique');
  doc.text('(VEHICLE BAILMENT AGREEMENT TERMS & CONDITIONS)', 105, 27, { align: 'center' });

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(20, 32, 190, 32);

  // Clauses list
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85); // slate-700

  const clauses = [
    {
      num: '1.',
      title: 'DUIT BAYARAN SEBAGAI SAGUHATI (VEHICLE MAINTENANCE SHARE)',
      body: 'Peminjam memahami dan bersetuju bahawa transaksi ini adalah berdasarkan konsep perkongsian kos penyelenggaraan (Car Sharing) persendirian untuk kegunaan logistik peribadi. Sebarang bayaran yang dibuat dikira sepenuhnya sebagai wang "saguhati" / sumbangan sukarela penyelenggaraan kenderaan dan BUKAN sewaan komersial.'
    },
    {
      num: '2.',
      title: 'TEKNOLOGI AUTOMATIK ENJIN CUT-OFF (SAFETY ENGINE SHUTDOWN)',
      body: 'Kenderaan ini dilengkapi dengan peranti keselamatan penjejakan GPS dan sistem enjin cut-off automatik. Sekiranya kenderaan dikesan dipandu keluar dari radius perjalanan yang dibenarkan tanpa kebenaran bertulis daripada pemilik, enjin kenderaan akan dimatikan (cut off) secara automatik demi faktor keselamatan.'
    },
    {
      num: '3.',
      title: 'ZON PICKUP & HANDOVER (DESIGNATED HANDOVER LOCATIONS)',
      body: 'Peminjam diwajibkan untuk mengambil (pickup) dan mengembalikan kenderaan di kawasan/lokasi pickup rasmi yang telah ditetapkan di dalam borang tempahan. Sebarang pengambilan atau pemulangan di luar kawasan adalah tidak dibenarkan kecuali dengan persetujuan bertulis pemilik.'
    },
    {
      num: '4.',
      title: 'WANG CAGARAN KESELAMATAN RM50 (SECURITY DEPOSIT)',
      body: 'Wang cagaran keselamatan (Security Deposit) sebanyak RM50.00 wajib didepositkan semasa tempahan dibuat. Wang cagaran ini diasingkan daripada sumbangan penyelenggaraan harian dan akan dipulangkan sepenuhnya kepada Peminjam dalam tempoh 3 hingga 5 hari bekerja selepas kenderaan dikembalikan dengan selamat tanpa sebarang isu.'
    },
    {
      num: '5.',
      title: 'DOKUMENTASI FOTO SEBELUM & SELEPAS (FUEL & PHYSICAL INSPECTION)',
      body: 'Peminjam WAJIB mengambil dan memuat naik foto bukti jelas bagi: (1) takat penunjuk minyak (fuel gauge) dan (2) keadaan fizikal kenderaan (luaran kereta dari sekeliling arah) sejurus sebelum trip bermula (semasa mengambil kunci) dan sejurus selepas trip tamat (semasa mengembalikan kunci).'
    },
    {
      num: '6.',
      title: 'PENOLAKAN WANG CAGARAN & CAJ LEBIHAN (OVERCHARGE POLICY)',
      body: 'Pemilik berhak untuk memotong atau membatalkan pemulangan wang cagaran RM50 sekiranya Peminjam didapati melanggar terma perjanjian, meninggalkan kenderaan dalam keadaan kotor, penunjuk minyak berkurangan, atau lewat memulangkan kenderaan. Kelewatan memulangkan kenderaan melebihi slot masa akan dikenakan caj tambahan (Overcharge Fee) sebanyak RM20.00 untuk setiap jam kelewatan.'
    },
    {
      num: '7.',
      title: 'TANGGUNGJAWAB PENUH KEROSAKAN, SAMAN & KEMALANGAN',
      body: 'Peminjam bertanggungjawab 100% ke atas keselamatan kenderaan sepanjang tempoh slot pinjaman. Sebarang kerosakan mekanikal akibat penyalahgunaan, saman lalu lintas (PDRM, JPJ, PBT) atau tuntutan kemalangan pihak ketiga/sendiri adalah tanggungan mutlak Peminjam.'
    }
  ];

  let y = 39;
  clauses.forEach((c) => {
    // Check page boundaries
    if (y > 265) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${c.num} ${c.title}`, 20, y);
    
    y += 5;
    
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const splitBody = doc.splitTextToSize(c.body, 170);
    doc.text(splitBody, 20, y);
    
    y += splitBody.length * 4.8 + 6;
  });

  // Footer note
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('Helvetica', 'oblique');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Dokumen ini dijana secara digital untuk kegunaan KongsiRide dan dipersetujui secara sah.', 105, y + 4, { align: 'center' });

  const pdfBuffer = doc.output('arraybuffer');

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Terma_dan_Syarat_KongsiRide.pdf"'
    }
  });
}
