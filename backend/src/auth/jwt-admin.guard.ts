import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthedRequest, JwtPayload } from '../common/types';
import { extractBearer } from './jwt-auth.guard';

@Injectable()
export class JwtAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearer(req);
    if (!token) throw new UnauthorizedException('Missing admin token');
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
    if (!payload.admin) throw new UnauthorizedException('Admin access required');
    const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub }, select: { id: true } });
    if (!admin) throw new UnauthorizedException('Admin not found');
    req.user = payload;
    return true;
  }
}
