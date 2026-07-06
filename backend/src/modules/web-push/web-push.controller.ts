import { Body, Controller, Get, Post, HttpCode } from '@nestjs/common';
import { WebPushService } from './web-push.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

@Controller('web-push')
export class WebPushController {
  constructor(private readonly service: WebPushService) {}

  @Public()
  @Get('public-key')
  publicKey() {
    return { key: this.service.publicKey() };
  }

  @Post('subscribe')
  @HttpCode(200)
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body('subscription') subscription: any,
  ) {
    await this.service.saveSubscription(user.userId, subscription);
    return { success: true };
  }

  @Post('unsubscribe')
  @HttpCode(200)
  async unsubscribe(@Body('endpoint') endpoint: string) {
    if (endpoint) await this.service.removeSubscription(endpoint);
    return { success: true };
  }
}
