export function callFnsInSequence<
  Args,
  Fn extends ((...args: Args[]) => void) | void
>(...fns: Fn[]) {
  return (...args: Args[]) => fns.forEach(fn => fn?.(...args))
}
