import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private uploads: UploadsService,
  ) {}

  // ─────────────── Users ───────────────

  /** List all active users in the hostel (for starting new DMs). */
  async listHostelUsers(userId: string, hostelId: string) {
    return this.prisma.user.findMany({
      where: {
        hostelId,
        status: 'active',
        deletedAt: null,
        id: { not: userId },
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  // ─────────────── Conversations ───────────────

  /** List all conversations for a user (sorted by most recent message). */
  async listConversations(userId: string, hostelId: string) {
    // Auto-create the hostel-wide group if it doesn't exist yet.
    await this.ensureHostelGroup(hostelId, userId);
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: { user: { select: { id: true, fullName: true, avatarUrl: true, role: true } } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, fullName: true } } },
            },
          },
        },
      },
    });

    // Compute unread counts and format.
    return memberships
      .map((m) => {
        const conv = m.conversation;
        const lastMsg = conv.messages[0] ?? null;
        const unread = m.lastReadAt
          ? conv.messages.filter((msg) => msg.createdAt > m.lastReadAt!).length
          : lastMsg ? 1 : 0;

        return {
          id: conv.id,
          type: conv.type,
          name: conv.type === 'direct'
            ? conv.members.find((mem) => mem.userId !== userId)?.user.fullName ?? 'Unknown'
            : conv.name,
          avatarUrl: conv.type === 'direct'
            ? conv.members.find((mem) => mem.userId !== userId)?.user.avatarUrl ?? null
            : conv.avatarUrl,
          members: conv.members.map((mem) => ({
            id: mem.user.id,
            fullName: mem.user.fullName,
            avatarUrl: mem.user.avatarUrl,
            role: mem.user.role,
          })),
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                senderId: lastMsg.senderId,
                senderName: lastMsg.sender.fullName,
                type: lastMsg.type,
                content: lastMsg.type === 'text' ? lastMsg.content : '📷 Photo',
                createdAt: lastMsg.createdAt,
              }
            : null,
          unreadCount: 0,
          updatedAt: conv.updatedAt,
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /** Get unread counts efficiently. */
  async getUnreadCounts(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true },
    });

    let total = 0;
    const perConversation: Record<string, number> = {};

    for (const m of memberships) {
      const count = await this.prisma.message.count({
        where: {
          conversationId: m.conversationId,
          senderId: { not: userId },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });
      perConversation[m.conversationId] = count;
      total += count;
    }

    return { total, perConversation };
  }

  /** Create a conversation (DM or group). */
  async createConversation(userId: string, hostelId: string, dto: CreateConversationDto) {
    if (dto.type === 'direct') {
      if (dto.memberIds.length !== 1) {
        throw new BadRequestException('Direct messages require exactly 1 other member.');
      }
      const otherId = dto.memberIds[0];
      if (otherId === userId) {
        throw new BadRequestException('Cannot create a conversation with yourself.');
      }

      // Check if DM already exists between these two users.
      const existing = await this.prisma.conversation.findFirst({
        where: {
          hostelId,
          type: 'direct',
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: otherId } } },
          ],
        },
        select: { id: true },
      });

      if (existing) return { id: existing.id, existing: true };
    }

    if (dto.type === 'group' && !dto.name) {
      throw new BadRequestException('Group conversations require a name.');
    }

    // All member IDs including the creator.
    const allMemberIds = [...new Set([userId, ...dto.memberIds])];

    // Verify all members are active users in the same hostel.
    const validUsers = await this.prisma.user.count({
      where: { id: { in: allMemberIds }, hostelId, status: 'active', deletedAt: null },
    });
    if (validUsers !== allMemberIds.length) {
      throw new BadRequestException('Some members are not active users in this hostel.');
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        hostelId,
        type: dto.type,
        name: dto.name,
        createdBy: userId,
        members: {
          create: allMemberIds.map((id) => ({ userId: id })),
        },
      },
    });

    return { id: conversation.id, existing: false };
  }

  /** Get conversation details (with membership check). */
  async getConversation(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this conversation.');

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true, role: true } } },
        },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');

    return conversation;
  }

  // ─────────────── Messages ───────────────

  /** Get messages in a conversation (paginated, for polling). */
  async getMessages(conversationId: string, userId: string, after?: string, limit = 50) {
    // Verify membership.
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this conversation.');

    const where: any = { conversationId };

    if (after) {
      // Fetch messages after the given message ID (by createdAt).
      const afterMsg = await this.prisma.message.findUnique({ where: { id: after }, select: { createdAt: true } });
      if (afterMsg) {
        where.createdAt = { gt: afterMsg.createdAt };
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    // If image message, generate signed Cloudinary URL.
    return messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.sender.fullName,
      senderAvatar: msg.sender.avatarUrl,
      type: msg.type,
      content: msg.content,
      imageUrl: msg.type === 'image' && this.uploads.isConfigured()
        ? this.uploads.signedViewUrl(msg.content)
        : null,
      createdAt: msg.createdAt,
    }));
  }

  /** Send a message. */
  async sendMessage(conversationId: string, userId: string, dto: SendMessageDto) {
    // Verify membership.
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      include: { conversation: { select: { hostelId: true, type: true, name: true } } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this conversation.');

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type: dto.type ?? 'text',
        content: dto.content,
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    // Touch conversation updatedAt (for sorting).
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Push notification to other members (fire-and-forget).
    const otherMembers = await this.prisma.conversationMember.findMany({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    });

    if (otherMembers.length > 0) {
      const senderName = message.sender.fullName;
      const preview = dto.type === 'image' ? '📷 Photo' : dto.content.slice(0, 100);
      const conv = member.conversation;
      const title = conv.type === 'group'
        ? `${senderName} in ${conv.name}`
        : senderName;

      this.notifications
        .notifySpecificUsers(otherMembers.map((m) => m.userId), {
          hostelId: conv.hostelId,
          type: 'individual',
          title,
          body: preview,
          data: { screen: 'chat', conversationId },
        })
        .catch(() => {}); // fire-and-forget
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.sender.fullName,
      senderAvatar: message.sender.avatarUrl,
      type: message.type,
      content: message.content,
      imageUrl: message.type === 'image' && this.uploads.isConfigured()
        ? this.uploads.signedViewUrl(message.content)
        : null,
      createdAt: message.createdAt,
    };
  }

  /** Mark conversation as read. */
  async markRead(conversationId: string, userId: string) {
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
    return { success: true };
  }

  // ─────────────── Group Management ───────────────

  /** Add a member to a group conversation (warden only enforced at controller). */
  async addMember(conversationId: string, newUserId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found.');
    if (conv.type !== 'group') throw new BadRequestException('Can only add members to group conversations.');

    // Verify user is in the same hostel.
    const user = await this.prisma.user.findFirst({
      where: { id: newUserId, hostelId: conv.hostelId, status: 'active', deletedAt: null },
    });
    if (!user) throw new BadRequestException('User not found or not in the same hostel.');

    await this.prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId, userId: newUserId } },
      create: { conversationId, userId: newUserId },
      update: {},
    });

    return { success: true };
  }

  /** Remove a member from a group conversation. */
  async removeMember(conversationId: string, removeUserId: string) {
    await this.prisma.conversationMember.deleteMany({
      where: { conversationId, userId: removeUserId },
    });
    return { success: true };
  }

  // ─────────────── Hostel Group Auto-Create ───────────────

  /** Ensure the default hostel-wide group exists, create if not. */
  async ensureHostelGroup(hostelId: string, creatorId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { hostelId, type: 'group', name: '🏨 Hostel Group' },
      select: { id: true },
    });
    if (existing) return existing.id;

    // Create hostel-wide group with all active users.
    const activeUsers = await this.prisma.user.findMany({
      where: { hostelId, status: 'active', deletedAt: null },
      select: { id: true },
    });

    const conv = await this.prisma.conversation.create({
      data: {
        hostelId,
        type: 'group',
        name: '🏨 Hostel Group',
        createdBy: creatorId,
        members: { create: activeUsers.map((u) => ({ userId: u.id })) },
      },
    });

    return conv.id;
  }

  /** Add a user to the hostel group (called when user is approved). */
  async addToHostelGroup(hostelId: string, userId: string) {
    const hostelGroup = await this.prisma.conversation.findFirst({
      where: { hostelId, type: 'group', name: '🏨 Hostel Group' },
      select: { id: true },
    });
    if (!hostelGroup) return;

    await this.prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: hostelGroup.id, userId } },
      create: { conversationId: hostelGroup.id, userId },
      update: {},
    });
  }
}
