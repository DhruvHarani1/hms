import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { colors } from '@/src/lib/theme';
import { useChatMessages } from '@/src/hooks/useChat';
import { ChatBubble } from '@/src/components/ChatBubble';
import { ChatInput } from '@/src/components/ChatInput';
import { useAuth } from '@/src/stores/auth';
import { CachedMessage } from '@/src/lib/chatCache';
import { api } from '@/src/lib/api';
import { useState } from 'react';

export default function ChatMessagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { messages, loading, sendMessage } = useChatMessages(id);
  const user = useAuth((s) => s.user);
  const flatListRef = useRef<FlatList>(null);
  const [convName, setConvName] = useState('Chat');
  const [convType, setConvType] = useState<'direct' | 'group'>('direct');

  // Fetch conversation info for the header.
  useEffect(() => {
    api
      .get(`/chat/conversations/${id}`)
      .then((res) => {
        const conv = res.data;
        setConvType(conv.type);
        if (conv.type === 'direct') {
          const other = conv.members.find((m: any) => m.user.id !== user?.id);
          setConvName(other?.user.fullName ?? 'Chat');
        } else {
          setConvName(conv.name ?? 'Group');
        }
      })
      .catch(() => {});
  }, [id, user?.id]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const renderItem = ({ item, index }: { item: CachedMessage; index: number }) => {
    const isMe = item.senderId === user?.id;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showSender = convType === 'group' && (!prevMsg || prevMsg.senderId !== item.senderId);

    return (
      <ChatBubble
        message={item}
        isMe={isMe}
        showSender={showSender}
      />
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: convName,
          headerBackTitle: 'Chat',
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {loading && messages.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : messages.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>👋</Text>
              <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center' }}>
                No messages yet. Say hello!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingVertical: 12 }}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
            />
          )}
          <ChatInput onSend={sendMessage} conversationId={id} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
