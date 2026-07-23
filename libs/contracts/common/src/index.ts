/** Stable opaque entity identifier (UUID string). */
export type EntityId = string;

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
