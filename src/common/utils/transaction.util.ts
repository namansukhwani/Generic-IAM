import { DataSource, EntityManager } from 'typeorm';

export interface RunInTransactionOptions {
  isolationLevel?:
    | 'READ UNCOMMITTED'
    | 'READ COMMITTED'
    | 'REPEATABLE READ'
    | 'SERIALIZABLE';
  /**
   * When provided and already inside an active transaction (e.g. from
   * TenantTransactionInterceptor), the operation joins that transaction
   * instead of opening a new QueryRunner.  The caller owns commit/rollback.
   */
  existingManager?: EntityManager;
}

export async function runInTransaction<T>(
  dataSource: DataSource,
  operation: (manager: EntityManager) => Promise<T>,
  options?: RunInTransactionOptions,
): Promise<T> {
  const existing = options?.existingManager;
  if (existing?.queryRunner?.isTransactionActive) {
    return operation(existing);
  }

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction(options?.isolationLevel);

  try {
    const result = await operation(queryRunner.manager);
    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
