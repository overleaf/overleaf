const shallowEqual = (arr1: unknown[], arr2: unknown[]) =>
  arr1.length === arr2.length && !arr1.some((val, index) => val !== arr2[index])

// Compares props for a component, but comparing the specified props using
// shallow array comparison rather than identity
export default function comparePropsWithShallowArrayCompare<
  T extends Record<string, unknown>,
>(...args: Array<keyof T>) {
  return (prevProps: T, nextProps: T) => {
    for (const k in prevProps) {
      const prev = prevProps[k]
      const next = nextProps[k]
      if (Object.is(prev, next)) {
        continue
      }

      if (!args.includes(k)) {
        return false
      }

      if (
        !Array.isArray(prev) ||
        !Array.isArray(next) ||
        !shallowEqual(prev, next)
      ) {
        return false
      }
    }
    return true
  }
}
