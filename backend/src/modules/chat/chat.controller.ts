import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto, AddMemberDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private chat: ChatService) {}

  /** List all my conversations. */
  @Get('conversations')
  listConversations(@Req() req: any) {
    return this.chat.listConversations(req.user.userId, req.user.hostelId);
  }

  /** Get total unread count (for badge). */
  @Get('unread')
  getUnread(@Req() req: any) {
    return this.chat.getUnreadCounts(req.user.userId);
  }

  /** List hostel users for starting new DMs. */
  @Get('users')
  listUsers(@Req() req: any) {
    return this.chat.listHostelUsers(req.user.userId, req.user.hostelId);
  }
  /** Create a new conversation (DM or group). */
  @Post('conversations')
  createConversation(@Req() req: any, @Body() dto: CreateConversationDto) {
    // Only wardens can create groups.
    if (dto.type === 'group' && !['warden', 'staff', 'super_admin'].includes(req.user.role)) {
      throw new ForbiddenException('Only wardens can create group conversations.');
    }
    return this.chat.createConversation(req.user.userId, req.user.hostelId, dto);
  }

  /** Get conversation details. */
  @Get('conversations/:id')
  getConversation(@Req() req: any, @Param('id') id: string) {
    return this.chat.getConversation(id, req.user.userId);
  }

  /** Get messages (polling endpoint). */
  @Get('conversations/:id/messages')
  getMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chat.getMessages(id, req.user.userId, after, limit ? parseInt(limit, 10) : 50);
  }

  /** Send a message. */
  @Post('conversations/:id/messages')
  sendMessage(@Req() req: any, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chat.sendMessage(id, req.user.userId, dto);
  }

  /** Mark conversation as read. */
  @Patch('conversations/:id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.chat.markRead(id, req.user.userId);
  }

  /** Add member to group (warden only). */
  @Post('conversations/:id/members')
  addMember(@Req() req: any, @Param('id') id: string, @Body() dto: AddMemberDto) {
    if (!['warden', 'staff', 'super_admin'].includes(req.user.role)) {
      throw new ForbiddenException('Only wardens can manage group members.');
    }
    return this.chat.addMember(id, dto.userId);
  }

  /** Remove member from group (warden only). */
  @Delete('conversations/:id/members/:userId')
  removeMember(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    if (!['warden', 'staff', 'super_admin'].includes(req.user.role)) {
      throw new ForbiddenException('Only wardens can manage group members.');
    }
    return this.chat.removeMember(id, userId);
  }
}
