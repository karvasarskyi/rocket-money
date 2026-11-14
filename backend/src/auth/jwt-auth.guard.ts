import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthedRequest, JwtPayload } from '../common/types';

export function extractBearer(req: AuthedRequest): string | null {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  return type === 'Bearer' && token ? token : null;
}

/** Authenticates Mini App users by JWT and rejects blocked accounts. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearer(req);
    if (!token) throw new UnauthorizedException('Missing access token');
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (payload.admin) throw new UnauthorizedException('Admin tokens cannot be used here');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isBlocked: true } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.isBlocked) throw new ForbiddenException('Your account has been blocked. Contact support.');
    req.user = payload;
    return true;
  }
}
