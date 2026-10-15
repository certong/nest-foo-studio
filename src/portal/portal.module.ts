import { Module } from '@nestjs/common';
import { ChangesController } from './changes.controller';
import { ChatController } from './chat.controller';
import { CreditsController } from './credits.controller';
import { NewPageController } from './new-page.controller';
import { RequestsController } from './requests.controller';
import { UatController } from './uat.controller';

/**
 * The client portal (screens 1–15). Contract only for now: every route is
 * real and documented, and each handler names the ticket that builds it. A
 * ticket that adds a service splits its domain into its own module.
 */
@Module({
  controllers: [RequestsController, ChatController, ChangesController, NewPageController, UatController, CreditsController],
})
export class PortalModule {}
