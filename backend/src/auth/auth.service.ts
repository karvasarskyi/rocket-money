import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  generateUserToken(userId: string): string {
    return this.jwt.sign({ sub: userId }, { expiresIn: '7d' });
  }

  generateAdminToken(adminId: string): string {
    return this.jwt.sign({ sub: adminId, admin: true }, { expiresIn: '12h' });
  }
}
