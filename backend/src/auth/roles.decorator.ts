/**
 * @file backend/src/auth/roles.decorator.ts
 * @module Backend.Auth.RolesDecorator
 *
 * @summary
 *  Decorator para definir roles necessárias num endpoint/controller.
 *
 * @description
 *  Usa metadata Nest (`SetMetadata`) para armazenar um array de Role(s) sob a key ROLES_KEY.
 *  O RolesGuard lê esta metadata e aplica a autorização.
 *
 * @usage
 *  @Roles(Role.ADMIN)
 *  @UseGuards(AccessJwtGuard) // tipicamente em conjunto
 *  someAdminEndpoint() { ... }
 */

import { SetMetadata } from "@nestjs/common";
import { Role } from "@prisma/client";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
