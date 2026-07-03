import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';

/** Polls the unread-notification count for the header bell badge. */
export function useUnread() {
  const { data } = useQuery({
    queryKey: ['unread'],
    queryFn: async () => (await api.get('/notifications/unread-count')).data,
    refetchInterval: 20000, // light poll so the badge stays fresh
  });
  return data?.unread ?? 0;
}
