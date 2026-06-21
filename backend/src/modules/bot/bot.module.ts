import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BotLauncherService } from './bot-launcher.service';
import { BotRegistryService } from './bot-registry.service';
import { BotCallbackController } from './bot-callback.controller';
import { BotRegistryController } from './bot-registry.controller';

@Module({
  imports: [HttpModule],
  providers: [BotLauncherService, BotRegistryService],
  controllers: [BotCallbackController, BotRegistryController],
  exports: [BotLauncherService, BotRegistryService],
})
export class BotModule {}
