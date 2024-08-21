import getMeta from '@/utils/meta'

// The reason this is a function is to ensure that the meta tag is read before
// any isBootstrap5 check is performed
export const isBootstrap5 = () => getMeta('ol-bootstrapVersion') === 5

export const bsVersion = ({ bs5, bs3 }: { bs5?: string; bs3?: string }) => {
  return isBootstrap5() ? bs5 : bs3
}

// get all `aria-*` and `data-*` attributes
export const getAriaAndDataProps = (obj: Record<string, unknown>) => {
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        acc[key] = value
      }
      return acc
    },
    {} as Record<string, unknown>
  )
}
