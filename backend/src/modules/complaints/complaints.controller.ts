import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import {
  CreateComplaintDto,
  ReplyComplaintDto,
  UpdateComplaintDto,
} from './dto/complaints.dto';

@Controller()
export class ComplaintsController {
  constructor(private readonly service: ComplaintsService) {}

  @Get('complaint-categories')
  categories(@CurrentUser() user: AuthUser) {
    return this.service.categories(user.hostelId);
  }

  @Post('complaints')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateComplaintDto) {
    return this.service.create(user, dto);
  }

  @Get('complaints')
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.service.list(user, { status, priority });
  }

  @Get('complaints/:id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Roles('warden', 'staff')
  @Patch('complaints/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateComplaintDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Post('complaints/:id/replies')
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplyComplaintDto,
  ) {
    return this.service.reply(user, id, dto);
  }
}
