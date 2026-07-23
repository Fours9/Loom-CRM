import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole, UserStatus } from './user.enums';

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  isDepartmentManager: boolean;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  count(): Promise<number> {
    return this.users.count();
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    role: UserRole;
    isDepartmentManager?: boolean;
    mustChangePassword?: boolean;
  }): Promise<User> {
    const user = this.users.create({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      isDepartmentManager: input.isDepartmentManager ?? false,
      status: UserStatus.Active,
      mustChangePassword: input.mustChangePassword ?? true,
      tokenVersion: 0,
      passwordChangedAt: null,
      lastLoginAt: null,
    });
    return this.users.save(user);
  }

  async save(user: User): Promise<User> {
    return this.users.save(user);
  }

  async deleteById(id: string): Promise<void> {
    await this.users.delete({ id });
  }

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isDepartmentManager: user.isDepartmentManager,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
