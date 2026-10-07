import { buildRequestsListQuery } from './requests-list-query';

describe('buildRequestsListQuery', () => {
  const base = {
    statusGroups: [] as string[],
    types: [] as string[],
    departmentIds: [] as string[],
    positionId: '',
    page: 1,
    pageSize: 20,
    sortBy: 'createdAt' as const,
    sortDir: 'desc' as const,
  };

  it('omits empty plural filters and empty positionId', () => {
    expect(buildRequestsListQuery(base)).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });
  });

  it('maps nonempty arrays to sorted + deduped plural keys (inclusive OR)', () => {
    expect(
      buildRequestsListQuery({
        ...base,
        statusGroups: ['approved', 'pending', 'pending'],
        types: ['vacation', 'day_off'],
        departmentIds: ['dep-b', 'dep-a', 'dep-a'],
      }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
      statusGroups: ['approved', 'pending'],
      types: ['day_off', 'vacation'],
      departmentIds: ['dep-a', 'dep-b'],
    });
  });

  it('includes positionId when set', () => {
    expect(buildRequestsListQuery({ ...base, positionId: 'pos-1' })).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
      positionId: 'pos-1',
    });
  });

  it('produces a stable query regardless of input array order', () => {
    const a = buildRequestsListQuery({
      ...base,
      statusGroups: ['rejected', 'approved'],
      types: ['vacation', 'day_off'],
    });
    const b = buildRequestsListQuery({
      ...base,
      statusGroups: ['approved', 'rejected'],
      types: ['day_off', 'vacation'],
    });
    expect(a).toEqual(b);
  });

  it('carries page/pageSize/sortBy/sortDir through unchanged', () => {
    expect(
      buildRequestsListQuery({
        ...base,
        page: 3,
        pageSize: 50,
        sortBy: 'startDate',
        sortDir: 'asc',
      }),
    ).toEqual({
      page: 3,
      pageSize: 50,
      sortBy: 'startDate',
      sortDir: 'asc',
    });
  });
});
