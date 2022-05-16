/**
 * Set values on window.metaAttributesCache, for use in Storybook stories
 */
export const useMeta = (meta: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(meta)) {
    window.metaAttributesCache.set(key, value)
  }
}
