import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MFAController } from './mfa.controller';
import { MFAService } from './mfa.service';
import { Auth } from './entities/auth.entity';
import { Session } from './entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Auth, Session])],
  controllers: [AuthController, MFAController],
  providers: [AuthService, MFAService],
})
export class AuthModule {}
