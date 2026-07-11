import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { colors, radius } from '@/src/lib/theme';
import { useChatConversations } from '@/src/hooks/useChat';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export default function ChatListScreen() {
  const { conversations, loading, refresh } = useChatConversations();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [showNewDM, setShowNewDM] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Request media library permission once on screen mount.
  useEffect(() => {
    MediaLibrary.requestPermissionsAsync().catch(() => {});
  }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/chat/users');
      setUsers(res.data);
    } catch {}
  };

  const startDM = async (otherId: string) => {
    try {
      const res = await api.post('/chat/conversations', {
        type: 'direct',
        memberIds: [otherId],
      });
      setShowNewDM(false);
      router.push(`/(${user?.role === 'warden' || user?.role === 'staff' ? 'warden' : user?.role === 'cook' ? 'cook' : 'student'})/chat/${res.data.id}`);
    } catch {}
  };

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>💬 Chat</Text>
          <Pressable
            onPress={() => {
              loadUsers();
              setShowNewDM(true);
            }}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.pill,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ New</Text>
          </Pressable>
        </View>

        {loading && conversations.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : conversations.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>No conversations yet</Text>
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6 }}>
              Tap "+ New" to start a chat with someone
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(c) => c.id}
            onRefresh={refresh}
            refreshing={false}
            renderItem={({ item: conv }) => (
              <Pressable
                onPress={() => {
                  const roleGroup = user?.role === 'warden' || user?.role === 'staff' ? 'warden' : user?.role === 'cook' ? 'cook' : 'student';
                  router.push(`/(${roleGroup})/chat/${conv.id}`);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  backgroundColor: colors.card,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                {/* Avatar */}
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: conv.type === 'group' ? colors.primarySoft : '#f1f5f9',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>
                    {conv.type === 'group' ? '👥' : '👤'}
                  </Text>
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: conv.unreadCount > 0 ? '800' : '600',
                        color: colors.text,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {conv.name}
                    </Text>
                    {conv.lastMessage && (
                      <Text style={{ fontSize: 11, color: colors.muted, marginLeft: 8 }}>
                        {timeAgo(conv.lastMessage.createdAt)}
                      </Text>
                    )}
                  </View>
                  {conv.lastMessage && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          color: conv.unreadCount > 0 ? colors.text : colors.muted,
                          fontWeight: conv.unreadCount > 0 ? '600' : '400',
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {conv.type === 'group' ? `${conv.lastMessage.senderName}: ` : ''}
                        {conv.lastMessage.content}
                      </Text>
                      {conv.unreadCount > 0 && (
                        <View
                          style={{
                            backgroundColor: colors.primary,
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 5,
                            marginLeft: 8,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* New DM modal */}
      <Modal visible={showNewDM} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '75%',
              paddingTop: 16,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>New message</Text>
              <Pressable onPress={() => setShowNewDM(false)}>
                <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700' }}>Close</Text>
              </Pressable>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name..."
                placeholderTextColor={colors.muted}
                style={{
                  backgroundColor: colors.bg,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            </View>

            <FlatList
              data={filteredUsers}
              keyExtractor={(u) => u.id}
              renderItem={({ item: u }) => (
                <Pressable
                  onPress={() => startDM(u.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#f1f5f9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>👤</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{u.fullName}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{u.role}</Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>No users found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
