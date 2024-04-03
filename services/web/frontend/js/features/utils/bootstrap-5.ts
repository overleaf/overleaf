import getMeta from '@/utils/meta'

export const isBootstrap5 = getMeta('ol-bootstrapVersion') === 5

export const bsClassName = ({ bs5, bs3 }: { bs5: string; bs3: string }) => {
  return isBootstrap5 ? bs5 : bs3
}
