import type { Meta } from '@/utils/meta'

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T

/**
 * Set values on window.metaAttributesCache, for use in Storybook stories
 */
export const useMeta = (meta: DeepPartial<Meta>) => {
  for (const [key, value] of Object.entries(meta)) {
    window.metaAttributesCache.set(key, value)
  }
}
