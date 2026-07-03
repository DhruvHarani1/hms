import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding HMS database...');

  // 1. One hostel (multi-tenant ready, single tenant for MVP)
  const hostel = await prisma.hostel.upsert({
    where: { code: 'HMS-001' },
    update: {},
    create: {
      name: 'Sunrise Boys Hostel',
      code: 'HMS-001',
      city: 'Pune',
      contactEmail: 'office@sunrisehostel.test',
      timezone: 'Asia/Kolkata',
    },
  });

  const password = await argon2.hash('Password123!');

  // 2. Warden
  const warden = await prisma.user.upsert({
    where: { email: 'warden@hostel.test' },
    update: {},
    create: {
      hostelId: hostel.id,
      role: 'warden',
      fullName: 'Warden Sharma',
      email: 'warden@hostel.test',
      phone: '+91-9000000000',
      passwordHash: password,
    },
  });

  // 3. Sample students
  const students = [
    { name: 'Aarav Patel', email: 'aarav@hostel.test', room: 'A-101', roll: 'CS2101' },
    { name: 'Rohan Verma', email: 'rohan@hostel.test', room: 'A-102', roll: 'CS2102' },
    { name: 'Karan Singh', email: 'karan@hostel.test', room: 'B-201', roll: 'ME2103' },
  ];

  for (const s of students) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        hostelId: hostel.id,
        role: 'student',
        fullName: s.name,
        email: s.email,
        passwordHash: password,
        studentProfile: {
          create: {
            hostelId: hostel.id,
            rollNo: s.roll,
            roomNumber: s.room,
            course: 'B.Tech',
            year: 2,
          },
        },
      },
    });
  }

  // 4. Complaint categories
  const categories = [
    { name: 'Electrical', priority: 'high' as const },
    { name: 'Plumbing / Water', priority: 'high' as const },
    { name: 'Wi-Fi / Internet', priority: 'medium' as const },
    { name: 'Cleaning', priority: 'low' as const },
    { name: 'Furniture', priority: 'medium' as const },
    { name: 'Other', priority: 'low' as const },
  ];
  for (const c of categories) {
    const exists = await prisma.complaintCategory.findFirst({
      where: { hostelId: hostel.id, name: c.name },
    });
    if (!exists) {
      await prisma.complaintCategory.create({
        data: {
          hostelId: hostel.id,
          name: c.name,
          defaultPriority: c.priority,
        },
      });
    }
  }

  // 5. A welcome notice
  const noticeExists = await prisma.notice.findFirst({
    where: { hostelId: hostel.id, title: 'Welcome to the hostel app!' },
  });
  if (!noticeExists) {
    await prisma.notice.create({
      data: {
        hostelId: hostel.id,
        title: 'Welcome to the hostel app!',
        body: 'You can now mark meals, file complaints, and get instant meal-ready alerts.',
        category: 'announcement',
        pinned: true,
        publishedAt: new Date(),
        createdBy: warden.id,
      },
    });
  }

  console.log('✅ Seed complete.');
  console.log('   Warden login:  warden@hostel.test / Password123!');
  console.log('   Student login: aarav@hostel.test  / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
