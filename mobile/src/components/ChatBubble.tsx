import { View, Text, Image, Pressable } from 'react-native';
import { colors, radius } from '@/src/lib/theme';
import { CachedMessage } from '@/src/lib/chatCache';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function ChatBubble({
  message,
  isMe,
  showSender,
  onImagePress,
}: {
  message: CachedMessage;
  isMe: boolean;
  showSender: boolean;
  onImagePress?: (url: string) => void;
}) {
  return (
    <View
      style={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        marginBottom: 6,
        marginHorizontal: 12,
      }}
    >
      {showSender && !isMe && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.primary,
            marginBottom: 2,
            marginLeft: 12,
          }}
        >
          {message.senderName}
        </Text>
      )}
      <View
        style={{
          backgroundColor: isMe ? colors.primary : colors.card,
          borderRadius: radius.lg,
          borderTopRightRadius: isMe ? 4 : radius.lg,
          borderTopLeftRadius: isMe ? radius.lg : 4,
          padding: message.type === 'image' ? 4 : 12,
          paddingBottom: 6,
          borderWidth: isMe ? 0 : 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        }}
      >
        {message.type === 'image' && message.imageUrl ? (
          <Pressable onPress={() => onImagePress?.(message.imageUrl!)}>
            <Image
              source={{ uri: message.imageUrl }}
              style={{
                width: 220,
                height: 220,
                borderRadius: radius.md,
                backgroundColor: colors.skeleton,
              }}
              resizeMode="cover"
            />
            {message.content && !message.content.startsWith('hms/') && (
              <Text
                style={{
                  color: isMe ? '#fff' : colors.text,
                  fontSize: 14,
                  marginTop: 6,
                  marginHorizontal: 8,
                }}
              >
                {message.content}
              </Text>
            )}
          </Pressable>
        ) : (
          <Text
            style={{
              color: isMe ? '#fff' : colors.text,
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {message.content}
          </Text>
        )}
        <Text
          style={{
            color: isMe ? 'rgba(255,255,255,0.6)' : colors.muted,
            fontSize: 10,
            textAlign: 'right',
            marginTop: 2,
          }}
        >
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}
