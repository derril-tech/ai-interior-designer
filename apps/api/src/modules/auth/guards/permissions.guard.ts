import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => {
    return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
        Reflect.defineMetadata(PERMISSIONS_KEY, permissions, descriptor?.value || target);
    };
};

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private authService: AuthService,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredPermissions) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        const hasPermission = this.authService.hasAnyPermission(
            user.permissions,
            requiredPermissions,
        );

        if (!hasPermission) {
            throw new ForbiddenException(
                `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
            );
        }

        return true;
    }
}
