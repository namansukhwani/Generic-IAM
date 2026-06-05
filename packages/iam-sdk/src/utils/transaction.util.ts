import { DataSource, EntityManager } from 'typeorm';

/**
 * Execute operations within a transaction.
 * Automatically handles connection, transaction lifecycle (start, commit, rollback), and cleanup.
 */
export async function runInTransaction<T>(
  dataSource: DataSource,
  operation: (manager: EntityManager) => Promise<T>,
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE',
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction(isolationLevel);

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
