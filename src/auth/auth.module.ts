import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, LegalController, MeController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, MeController, LegalController],
  providers: [AuthService, AuthGuard, PasswordService],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
