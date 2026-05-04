import { SessionPayload } from '@/lib/auth';

export const PERMISSIONS = {
  MANAGE_RBAC: 'MANAGE_RBAC',
  MANAGE_PRODUCTS: 'MANAGE_PRODUCTS',
  MANAGE_CATEGORIES: 'MANAGE_CATEGORIES',
  MANAGE_ORDERS: 'MANAGE_ORDERS',
  MANAGE_SETTINGS: 'MANAGE_SETTINGS',
  VIEW_ALL: 'VIEW_ALL'
};

export function hasPermission(session: SessionPayload | null, requiredPermission: string): boolean {
  if (!session) return false;
  if (!session.permissions) return false;
  
  if (session.permissions.includes(requiredPermission)) {
    return true;
  }
  
  return false;
}
