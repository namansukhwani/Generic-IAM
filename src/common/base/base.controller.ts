import { Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { BaseService } from './base.service';
import type { DeepPartial, FindOneOptions } from 'typeorm';
import { ObjectLiteral } from 'typeorm';

export class BaseController<T extends ObjectLiteral> {
  constructor(protected readonly baseService: BaseService<T>) {}

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.baseService.findPaginated(page, limit);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.baseService.findOne({
      where: { id },
    } as unknown as FindOneOptions<T>);
  }

  @Post()
  async create(@Body() dto: DeepPartial<T>) {
    return this.baseService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: DeepPartial<T>) {
    return this.baseService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.baseService.remove(id);
    return { deleted: true };
  }
}
