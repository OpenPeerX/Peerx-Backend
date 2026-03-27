import { IsEnum } from 'class-validator';
import { WaitlistStatus } from './waitlist-query.dto';

export class PatchWaitlistStatusDto {
  @IsEnum(WaitlistStatus)
  status: WaitlistStatus;
}
