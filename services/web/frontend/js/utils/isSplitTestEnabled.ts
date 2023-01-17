import getMeta from './meta'

export default function isSplitTestEnabled(name: string) {
  return getMeta('ol-splitTestVariants')?.[name] === 'enabled'
}
