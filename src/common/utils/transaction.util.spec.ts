import { DataSource } from 'typeorm';
import { runInTransaction } from './transaction.util';

describe('runInTransaction Utility', () => {
  let mockManager: any;
  let mockQueryRunner: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: mockManager,
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };
  });

  it('should successfully run work, commit, and release query runner', async () => {
    const dummyResult = { success: true };
    const work = jest.fn().mockResolvedValue(dummyResult);

    const result = await runInTransaction(mockDataSource, work);

    expect(result).toBe(dummyResult);
    expect(mockDataSource.createQueryRunner).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.connect).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(mockManager);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should rollback and release if work throws an error', async () => {
    const workError = new Error('Database write error');
    const work = jest.fn().mockRejectedValue(workError);

    await expect(runInTransaction(mockDataSource, work)).rejects.toThrow(
      'Database write error',
    );

    expect(mockDataSource.createQueryRunner).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.connect).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(mockManager);
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should pass isolation level if provided', async () => {
    const work = jest.fn().mockResolvedValue('ok');

    await runInTransaction(mockDataSource, work, 'SERIALIZABLE');

    expect(mockQueryRunner.startTransaction).toHaveBeenCalledWith(
      'SERIALIZABLE',
    );
  });
});
