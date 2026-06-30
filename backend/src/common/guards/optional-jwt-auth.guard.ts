import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard but never rejects: it populates request.user when a valid bearer token is
 * present and otherwise leaves it undefined. Used on public endpoints that want to tailor the
 * response to the caller when they happen to be authenticated (e.g. GET /agents).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return (user || undefined) as TUser;
  }
}
