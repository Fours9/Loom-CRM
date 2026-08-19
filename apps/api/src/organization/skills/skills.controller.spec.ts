import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

describe('SkillsController DELETE wiring', () => {
  function makeController() {
    const skills = {
      hardDeleteSkill: jest.fn(async () => undefined),
      hardDeleteGroup: jest.fn(async () => undefined),
      softDeleteSkill: jest.fn(async () => undefined),
      softDeleteGroup: jest.fn(async () => undefined),
    };
    const controller = new SkillsController(skills as unknown as SkillsService);
    return { controller, skills };
  }

  it('DELETE skill calls hardDeleteSkill, not softDeleteSkill', async () => {
    const { controller, skills } = makeController();
    await expect(controller.removeSkill('skill-1')).resolves.toEqual({ ok: true });
    expect(skills.hardDeleteSkill).toHaveBeenCalledWith('skill-1');
    expect(skills.softDeleteSkill).not.toHaveBeenCalled();
  });

  it('DELETE group calls hardDeleteGroup, not softDeleteGroup', async () => {
    const { controller, skills } = makeController();
    await expect(controller.removeGroup('group-1')).resolves.toEqual({ ok: true });
    expect(skills.hardDeleteGroup).toHaveBeenCalledWith('group-1');
    expect(skills.softDeleteGroup).not.toHaveBeenCalled();
  });
});
