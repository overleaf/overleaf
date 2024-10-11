import getMeta from '@/utils/meta'

// The reason this is a function is to ensure that the meta tag is read before
// any isBootstrap5 check is performed
export const isBootstrap5 = () => getMeta('ol-bootstrapVersion') === 5

/* eslint-disable no-redeclare */
export function bsVersion<A>({ bs5 }: { bs5: A }): A | undefined
export function bsVersion<B>({ bs3 }: { bs3: B }): B | undefined
export function bsVersion<A, B>({ bs5, bs3 }: { bs5: A; bs3: B }): A | B
export function bsVersion({ bs5, bs3 }: { bs5?: unknown; bs3?: unknown }) {
  return isBootstrap5() ? bs5 : bs3
}

export const bsVersionIcon = ({
  bs5,
  bs3,
}: {
  bs5?: { type: string }
  bs3?: { type: string; fw?: boolean }
}) => {
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
