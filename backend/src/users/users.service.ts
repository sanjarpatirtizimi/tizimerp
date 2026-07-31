import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException(
        'A staff account with this phone number already exists',
      );
    }

    const passwordHash = await this.authService.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role,
        passwordHash,
      },
    });

    return this.sanitize(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.sanitize(u));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
    return this.sanitize(user);
  }

  private sanitize<T extends { passwordHash: string }>(
    user: T,
  ): Omit<T, 'passwordHash'> {
    const rest: Partial<T> = { ...user };
    delete rest.passwordHash;
    return rest as Omit<T, 'passwordHash'>;
  }
}
