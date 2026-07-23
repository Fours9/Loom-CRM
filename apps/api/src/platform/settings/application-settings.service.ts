import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationSetting } from './application-setting.entity';

@Injectable()
export class ApplicationSettingsService {
  constructor(
    @InjectRepository(ApplicationSetting)
    private readonly repo: Repository<ApplicationSetting>,
  ) {}

  async get(key: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.repo.save({ key, value });
  }
}
