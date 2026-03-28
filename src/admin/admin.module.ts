import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WaitlistService } from '../waitlist/waitlist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([]), // Entities injected with @InjectRepository('name')
  ],
  controllers: [AdminController],
  providers: [AdminService, WaitlistService],
  exports: [AdminService, WaitlistService],
})
export class AdminModule {}
