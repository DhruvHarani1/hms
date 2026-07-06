import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class StudentPdfService {
  constructor(
    private prisma: PrismaService,
    private uploads: UploadsService,
  ) {}

  /** Fetch a stored document as a Buffer (via signed URL). Null on failure. */
  private async fetchImage(key?: string | null): Promise<Buffer | null> {
    if (!key || !this.uploads.isConfigured()) return null;
    try {
      const url = this.uploads.signedViewUrl(key);
      const res = await fetch(url);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }

  async build(hostelId: string, studentId: string): Promise<Buffer> {
    const s = await this.prisma.user.findFirst({
      where: { id: studentId, hostelId, role: 'student' },
      include: { studentProfile: true, hostel: true },
    });
    if (!s) throw new NotFoundException('Student not found');
    const p = s.studentProfile;

    const doc = new PDFDocument({ margin: 44, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const fmtDate = (d?: Date | null) =>
      d ? new Date(d).toISOString().slice(0, 10) : '—';
    const yn = (v?: string | null) => (v ? 'Yes' : 'No');

    // Header
    doc
      .fontSize(18)
      .fillColor('#4f46e5')
      .text('AIFDMS Hostel', { align: 'center' });
    doc
      .fontSize(12)
      .fillColor('#334155')
      .text('Student Profile', { align: 'center' });
    doc.moveDown(1);

    const row = (label: string, value: any) => {
      doc.fontSize(10).fillColor('#64748b').text(label, { continued: true });
      doc
        .fillColor('#0f172a')
        .text('   ' + (value ?? '—'));
      doc.moveDown(0.25);
    };
    const section = (title: string) => {
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#4f46e5').text(title);
      doc
        .moveTo(doc.x, doc.y)
        .lineTo(551, doc.y)
        .strokeColor('#e2e8f0')
        .stroke();
      doc.moveDown(0.4);
    };

    section('Personal');
    row('Name:', s.fullName);
    row("Father's name:", p?.fatherName);
    row('Surname:', p?.surname);
    row('Date of birth:', fmtDate(p?.dob));
    row('Gender:', p?.gender);
    row('Blood group:', p?.bloodGroup);

    section('Contact');
    row('Mobile:', s.phone);
    row('Email:', s.email);
    row('Address:', p?.address);
    row('Guardian phone:', p?.guardianPhone);
    row('Emergency contact:', p?.emergencyContact);

    section('Academic');
    row('Course:', p?.course);
    row('Year:', p?.year);
    row('Institute name:', p?.instituteName);
    row('Institute address:', p?.instituteAddress);
    row('Date of joining:', fmtDate(p?.admissionDate));

    section('Documents');
    row('Photo uploaded:', yn(p?.photoKey));
    row('Aadhaar card uploaded:', yn(p?.aadhaarKey));
    row('Course proof uploaded:', yn(p?.courseProofKey));

    doc.moveDown(1.5);
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(
        `Generated ${new Date().toISOString().slice(0, 10)} · AIFDMS Hostel App`,
        { align: 'center' },
      );

    // Pages 2-4: document images (only if uploaded).
    const [photo, aadhaar, course] = await Promise.all([
      this.fetchImage(p?.photoKey),
      this.fetchImage(p?.aadhaarKey),
      this.fetchImage(p?.courseProofKey),
    ]);
    const imagePage = (title: string, buf: Buffer | null) => {
      if (!buf) return;
      doc.addPage();
      doc.fontSize(14).fillColor('#4f46e5').text(title, { align: 'center' });
      doc.moveDown(1);
      try {
        doc.image(buf, { fit: [460, 640], align: 'center', valign: 'center' });
      } catch {
        doc.fontSize(10).fillColor('#dc2626').text('Could not render image.');
      }
    };
    imagePage('Profile Photo', photo);
    imagePage('Aadhaar Card', aadhaar);
    imagePage('Course Proof', course);

    doc.end();
    return done;
  }
}
