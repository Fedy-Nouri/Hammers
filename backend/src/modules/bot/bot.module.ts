import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BotLauncherService } from './bot-launcher.service';
import { BotCallbackController } from './bot-callback.controller';

@Module({
  imports: [HttpModule],
  providers: [BotLauncherService],
  controllers: [BotCallbackController],
  exports: [BotLauncherService],
})
export class BotModule {}
