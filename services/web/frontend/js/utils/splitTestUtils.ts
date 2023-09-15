import getMeta from './meta'

export function isSplitTestEnabled(name: string) {
  return getMeta('ol-splitTestVariants')?.[name] === 'enabled'
}

export function getSplitTestVariant(name: string, fallback?: string) {
  return getMeta('ol-splitTestVariants')?.[name] || fallback
}

export function parseIntFromSplitTest(name: string, defaultValue: number) {
  const v = getMeta('ol-splitTestVariants')?.[name]
  const n = parseInt(v, 10)
  if (v === 'default' || Number.isNaN(n)) {
    return defaultValue
  }
  return n
}
