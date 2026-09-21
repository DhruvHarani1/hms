import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateRoomDto, JoinRoomDto, MoveDto } from './dto/games.dto';

@Controller('games')
export class GamesController {
  constructor(private games: GamesService) {}

  @Post('rooms')
  createRoom(@Req() req: any, @Body() dto: CreateRoomDto) {
    return this.games.createRoom(req.user.userId, req.user.hostelId, dto.gameType);
  }

  @Get('rooms')
  listOpenRooms(@Req() req: any, @Query('gameType') gameType?: string) {
    return this.games.listOpenRooms(req.user.hostelId, gameType);
  }

  @Post('rooms/join')
  joinRoom(@Req() req: any, @Body() dto: JoinRoomDto) {
    return this.games.joinRoom(req.user.userId, req.user.hostelId, dto.code);
  }

  @Get('rooms/:id')
  getRoom(@Req() req: any, @Param('id') id: string) {
    return this.games.getRoom(id, req.user.userId);
  }

  @Post('rooms/:id/start')
  startGame(@Req() req: any, @Param('id') id: string) {
    return this.games.startGame(id, req.user.userId);
  }

  @Post('rooms/:id/move')
  makeMove(@Req() req: any, @Param('id') id: string, @Body() dto: MoveDto) {
    return this.games.makeMove(id, req.user.userId, dto.action, dto.payload);
  }

  @Post('rooms/:id/leave')
  leaveRoom(@Req() req: any, @Param('id') id: string) {
    return this.games.leaveRoom(id, req.user.userId);
  }
}
