export interface JwtPayload {
  sub: string;
  tenant_id?: string | null;
  identity_type: string;
  service_name?: string;
  impersonator_id?: string;
  email?: string;
}
