/**
 * One-time migration script to backfill User.fullName with surname.
 *
 * For every student who has a surname in StudentProfile, this script
 * appends the surname to User.fullName (if not already there).
 *
 * Usage:
 *   cd p:\MHM\backend
 *   npx ts-node scripts/backfill-fullname.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const students = await prisma.user.findMany({
    where: {
      role: 'student',
      deletedAt: null,
      studentProfile: { surname: { not: '' } },
    },
    include: { studentProfile: true },
  });

  let updated = 0;
  for (const s of students) {
    const surname = s.studentProfile?.surname?.trim();
    if (!surname) continue;

    const currentName = (s.fullName || '').trim();
    if (!currentName) continue;

    // Skip if fullName already ends with the surname
    if (currentName.toLowerCase().endsWith(surname.toLowerCase())) {
      console.log(`  SKIP  ${currentName} (already has surname)`);
      continue;
    }

    const newName = `${currentName} ${surname}`;
    await prisma.user.update({
      where: { id: s.id },
      data: { fullName: newName },
    });
    console.log(`  ✓  ${currentName} → ${newName}`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} / ${students.length} students.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
