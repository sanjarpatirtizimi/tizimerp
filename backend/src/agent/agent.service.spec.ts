import { DriverStatus, SyncStatus } from '@prisma/client';
import { AgentService } from './agent.service';

describe('AgentService', () => {
  function createPrisma() {
    const prisma = {
      driverDeviceRegistration: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      driver: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: { deleteMany: jest.fn() },
      otpCode: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    return prisma;
  }

  it('listPending ignores deleted drivers and FAILED jobs', async () => {
    const prisma = createPrisma();
    prisma.driverDeviceRegistration.findMany.mockResolvedValue([
      {
        id: 'reg-1',
        driverId: 'drv-1',
        driver: { id: 'drv-1', fullName: 'Ali', photoUrl: '/p' },
      },
    ]);
    const service = new AgentService(prisma as never);

    const jobs = await service.listPending('faceid2');

    expect(prisma.driverDeviceRegistration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deviceId: 'faceid2',
          hikvisionFaceId: null,
          pairingExpiresAt: null,
          syncStatus: SyncStatus.PENDING,
          driver: {
            deletedAt: null,
            status: { not: DriverStatus.BLOCKED },
          },
        }),
      }),
    );
    expect(jobs).toEqual([
      {
        registrationId: 'reg-1',
        driverId: 'drv-1',
        employeeNo: 'drv-1',
        fullName: 'Ali',
        photoUrl: '/api/public/driver-photos/drv-1',
      },
    ]);
  });

  it('resetEnrollmentBacklog removes waiting drivers and pending photo-push jobs', async () => {
    const prisma = createPrisma();
    prisma.driver.findMany.mockResolvedValue([
      { id: 'wait-1', phone: '+998901234567' },
    ]);
    prisma.driverDeviceRegistration.deleteMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 5 });
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    prisma.otpCode.deleteMany.mockResolvedValue({ count: 1 });
    prisma.driver.update.mockResolvedValue({});

    const service = new AgentService(prisma as never);
    const result = await service.resetEnrollmentBacklog();

    expect(result).toEqual({ clearedJobs: 5, removedDrivers: 1 });
    expect(prisma.driverDeviceRegistration.deleteMany).toHaveBeenNthCalledWith(
      1,
      { where: { driverId: { in: ['wait-1'] } } },
    );
    expect(prisma.driver.update).toHaveBeenCalledWith({
      where: { id: 'wait-1' },
      data: expect.objectContaining({
        status: DriverStatus.BLOCKED,
        phone: 'deleted:wait-1:+998901234567',
        photoBytes: null,
      }),
    });
    expect(prisma.driverDeviceRegistration.deleteMany).toHaveBeenNthCalledWith(
      2,
      {
        where: {
          hikvisionFaceId: null,
          pairingExpiresAt: null,
          syncStatus: { in: [SyncStatus.PENDING, SyncStatus.FAILED] },
        },
      },
    );
  });

  it('resetEnrollmentBacklog keeps stamped drivers and only clears leftover jobs', async () => {
    const prisma = createPrisma();
    prisma.driver.findMany.mockResolvedValue([]);
    prisma.driverDeviceRegistration.deleteMany.mockResolvedValue({ count: 29 });

    const service = new AgentService(prisma as never);
    const result = await service.resetEnrollmentBacklog();

    expect(result).toEqual({ clearedJobs: 29, removedDrivers: 0 });
    expect(prisma.driver.update).not.toHaveBeenCalled();
    expect(prisma.driverDeviceRegistration.deleteMany).toHaveBeenCalledTimes(1);
  });
});
