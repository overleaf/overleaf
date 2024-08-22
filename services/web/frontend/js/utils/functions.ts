export function callFnsInSequence<
  Args extends Array<any>,
  Fn extends ((...args: Args) => void) | void,
>(...fns: Fn[]) {
  return (...args: Args) => fns.forEach(fn => fn?.(...args))
}
