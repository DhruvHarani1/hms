/**
 * Formats a student or user name to ensure Name + Surname is displayed across the platform.
 * Example:
 *   formatStudentName({ fullName: 'Rahul', studentProfile: { surname: 'Sharma' } }) -> 'Rahul Sharma'
 *   formatStudentName({ fullName: 'Rahul Sharma', surname: 'Sharma' }) -> 'Rahul Sharma'
 */
export function formatStudentName(
  user?: {
    fullName?: string | null;
    name?: string | null;
    surname?: string | null;
    studentProfile?: { surname?: string | null } | null;
  } | null,
  fallbackSurname?: string | null,
): string {
  if (!user) return '';
  const fullName = (user.fullName || user.name || '').trim();
  const surname = (
    user.studentProfile?.surname ||
    user.surname ||
    fallbackSurname ||
    ''
  ).trim();

  if (!fullName) return surname;
  if (!surname) return fullName;

  // Prevent duplicating if fullName already contains the surname
  if (fullName.toLowerCase().endsWith(surname.toLowerCase())) {
    return fullName;
  }

  return `${fullName} ${surname}`;
}
