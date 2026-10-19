import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CreditsModule } from '../credits/credits.module';
import { DropService } from './drafts/drop.service';
import { ChangesController } from './changes.controller';
import { ChatController } from './chat.controller';
import { CreditsController } from './credits.controller';
import { MeService } from './me/me.service';
import { NewPageController } from './new-page.controller';
import { RequestsController } from './requests.controller';
import { UatController } from './uat.controller';

/**
 * The client portal (screens 1–15). Contract only for now: every route is
 * real and documented, and each handler names the ticket that builds it. A
 * ticket that adds a service splits its domain into its own module.
 */
@Module({
  imports: [AuthModule, CreditsModule],
  controllers: [RequestsController, ChatController, ChangesController, NewPageController, UatController, CreditsController],
  providers: [MeService, DropService],
})
export class PortalModule {}
