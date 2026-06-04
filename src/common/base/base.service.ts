import { Repository, FindManyOptions, FindOneOptions, ObjectLiteral } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PaginatedResponse } from '../interfaces/paginated-response.interface';

export class BaseService<T extends ObjectLiteral> {
  constructor(protected readonly repository: Repository<T>) {}

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  async findPaginated(
    page: number = 1,
    limit: number = 10,
    options?: FindManyOptions<T>,
  ): Promise<PaginatedResponse<T>> {
    const [data, total] = await this.repository.findAndCount({
      ...options,
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(options: FindOneOptions<T>): Promise<T> {
    const entity = await this.repository.findOne(options);
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }
    return entity;
  }

  async create(dto: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(dto);
    return this.repository.save(entity);
  }

  async update(id: string | number, dto: DeepPartial<T>): Promise<T> {
    // Requires findOne options format compatible with the generic type
    // We assume the entity has an 'id' field
    const options = { where: { id } } as unknown as FindOneOptions<T>;
    const entity = await this.findOne(options);
    const updatedEntity = this.repository.merge(entity, dto);
    return this.repository.save(updatedEntity);
  }

  async remove(id: string | number): Promise<void> {
    const options = { where: { id } } as unknown as FindOneOptions<T>;
    const entity = await this.findOne(options);
    await this.repository.remove(entity);
  }
}
