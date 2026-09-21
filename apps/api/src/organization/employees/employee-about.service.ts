import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type {
  EmployeeAboutResponse,
  PatchEmployeeAboutSubtabRequest,
} from '@loom/contracts-employees';
import {
  AboutValidationError,
  canonicalizeAboutMutation,
  isAboutSubtabId,
  projectEmployeeAbout,
  validateAboutSubtabPatch,
} from '@loom/employee-about-catalog';
import { User } from '../../platform/identity/user.entity';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import { EmployeeAccessService } from '../access/employee-access.service';
import { EmployeeAbout } from './employee-about.entity';
import { EmployeeAboutFacade } from './employee-about.facade';
import {
  canEditEmployeeAbout,
  resolveHasAboutSurface,
} from './employee-about-authz';

@Injectable()
export class EmployeeAboutService {
  constructor(
    @InjectRepository(EmployeeAbout)
    private readonly aboutRepo: Repository<EmployeeAbout>,
    private readonly facade: EmployeeAboutFacade,
    private readonly access: EmployeeAccessService,
    private readonly authorization: AuthorizationContextService,
    private readonly dataSource: DataSource,
  ) {}

  async get(actor: User, employeeId: string): Promise<EmployeeAboutResponse> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const authz = await this.authorization.resolve(actor.id);
    const hasAboutSurface = resolveHasAboutSurface(authz);
    if (!hasAboutSurface) {
      throw new ForbiddenException('About surface not granted');
    }

    const row = await this.aboutRepo.findOne({
      where: { employeeId: employee.id },
    });
    const answers = (row?.answers ?? {}) as Record<string, unknown>;
    const projected = projectEmployeeAbout({ answers });

    const inManagedDept = await this.access.isTargetInManagedDepartments(
      actor,
      employee,
    );
    const canEdit = canEditEmployeeAbout({
      authz,
      isOwner: this.access.isOwner(actor, employee),
      inManagedDept,
      hasAboutSurface,
    });

    return {
      answers: projected.answers,
      subtabs: projected.subtabs,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      canEdit,
    };
  }

  async patchSubtab(
    actor: User,
    employeeId: string,
    body: PatchEmployeeAboutSubtabRequest,
  ): Promise<EmployeeAboutResponse> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const authz = await this.authorization.resolve(actor.id);
    const hasAboutSurface = resolveHasAboutSurface(authz);
    if (!hasAboutSurface) {
      throw new ForbiddenException('About surface not granted');
    }

    const inManagedDept = await this.access.isTargetInManagedDepartments(
      actor,
      employee,
    );
    const canEdit = canEditEmployeeAbout({
      authz,
      isOwner: this.access.isOwner(actor, employee),
      inManagedDept,
      hasAboutSurface,
    });
    if (!canEdit) {
      throw new ForbiddenException('Cannot edit About');
    }

    if (!isAboutSubtabId(body.subtabId)) {
      throw new BadRequestException('Invalid subtabId');
    }

    let set: Record<string, unknown>;
    let clearKeys: string[];
    try {
      const validated = validateAboutSubtabPatch({
        subtabId: body.subtabId,
        values: body.values ?? {},
      });
      const canon = canonicalizeAboutMutation(validated.set);
      set = canon.set;
      clearKeys = [...new Set([...validated.clearKeys, ...canon.clearKeys])];
    } catch (err) {
      if (err instanceof AboutValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    await this.dataSource.transaction(async (manager) => {
      await this.facade.mergeAnswers(manager, employee.id, {
        set,
        clearKeys,
        source: { kind: 'manual', actorUserId: actor.id },
      });
    });

    return this.get(actor, employeeId);
  }
}
