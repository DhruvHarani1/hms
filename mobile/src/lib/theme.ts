export const colors = {
  primary: '#4f46e5',
  primaryDark: '#4338ca',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  breakfast: '#f59e0b',
  lunch: '#ea580c',
  dinner: '#6366f1',
  primarySoft: '#eef2ff',
  skeleton: '#e9edf3',
};

export const spacing = (n: number) => n * 8;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// Shared status → color map (complaints, etc.)
export const statusColor: Record<string, string> = {
  pending: colors.warning,
  in_progress: colors.primary,
  resolved: colors.success,
  closed: colors.muted,
};
