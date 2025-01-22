import { PartialMeta } from '@/utils/meta'

/**
 * Set values on window.metaAttributesCache, for use in Storybook stories
 */
export const useMeta = (meta: PartialMeta) => {
  for (const [key, value] of Object.entries(meta)) {
    window.metaAttributesCache.set(key as keyof PartialMeta, value)
  }
}
