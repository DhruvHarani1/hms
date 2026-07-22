import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  Keyboard,
  Image,
  Modal,
  Pressable,
  Dimensions,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { colors } from '@/src/lib/theme';

import { useChatMessages } from '@/src/hooks/useChat';
import { ChatBubble } from '@/src/components/ChatBubble';
import { ChatInput } from '@/src/components/ChatInput';
import { useAuth } from '@/src/stores/auth';
import { CachedMessage } from '@/src/lib/chatCache';
import { api } from '@/src/lib/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ChatMessagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { messages, loading, sendMessage } = useChatMessages(id);
  const user = useAuth((s) => s.user);
  const flatListRef = useRef<FlatList>(null);
  const [convName, setConvName] = useState('Chat');
  const [convType, setConvType] = useState<'direct' | 'group'>('direct');

  // ── Keyboard handling (reliable Android fix) ──
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ── Full-screen image viewer ──
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleImagePress = useCallback((url: string) => {
    setViewerImage(url);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!viewerImage || saving) return;
    setSaving(true);

    try {
      // Request media library permission.
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save images.');
        setSaving(false);
        return;
      }

      // Download to local cache first.
      const filename = `chat_${Date.now()}.jpg`;
      const localUri = (FileSystem.cacheDirectory ?? '') + filename;
      const download = await FileSystem.downloadAsync(viewerImage, localUri);

      if (download.status === 200) {
        // Create a media asset from the downloaded file
        const asset = await MediaLibrary.createAssetAsync(download.uri);
        
        // Find or create the "AIFDMS" album in the gallery
        const album = await MediaLibrary.getAlbumAsync('AIFDMS');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('AIFDMS', asset, false);
        }
        Alert.alert('✅ Saved', 'Image saved to your AIFDMS gallery folder.');
      } else {
        Alert.alert('Error', 'Failed to download image.');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to save image: ' + (err?.message ?? err));
    }
    setSaving(false);
  }, [viewerImage, saving]);

  // ── Fetch conversation info ──
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

  // Auto-scroll on new messages.
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
        onImagePress={handleImagePress}
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
        <View style={{ flex: 1 }}>
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
          {/* Keyboard spacer for Android */}
          {Platform.OS === 'android' && keyboardHeight > 0 && (
            <View style={{ height: keyboardHeight }} />
          )}
        </View>
      </SafeAreaView>

      {/* Full-screen image viewer */}
      <Modal visible={!!viewerImage} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
          {/* Close button */}
          <Pressable
            onPress={() => setViewerImage(null)}
            style={{
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 10,
              backgroundColor: 'rgba(255,255,255,0.2)',
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>✕</Text>
          </Pressable>

          {/* Image */}
          {viewerImage && (
            <Image
              source={{ uri: viewerImage }}
              style={{ width: SCREEN_W, height: SCREEN_H * 0.65 }}
              resizeMode="contain"
            />
          )}

          {/* Download button */}
          <Pressable
            onPress={handleDownload}
            disabled={saving}
            style={{
              position: 'absolute',
              bottom: 60,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 30,
              gap: 8,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={{ color: '#fff', fontSize: 18 }}>📥</Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  Save to Gallery
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
