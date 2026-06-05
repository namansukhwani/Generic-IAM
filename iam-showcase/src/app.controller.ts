import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import {
  JwtAuthGuard,
  PermissionGuard,
  AclGuard,
  RequirePermissions,
  RequireAcl,
  SYSTEM_PERMISSIONS,
} from '@iam/nestjs-sdk';

@Controller('demo')
@UseGuards(JwtAuthGuard, PermissionGuard, AclGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(':id')
  @RequirePermissions(SYSTEM_PERMISSIONS.PAYROLL.READ)
  @RequireAcl('Payroll', 'read')
  getDemo(@Param('id') id: string): string {
    return `${this.appService.getHello()} for Payroll ${id}`;
  }
}
