import { forwardRef } from 'react'

export const fixedForwardRef = <
  T,
  P = object,
  A extends Record<string, React.FunctionComponent> = Record<
    string,
    React.FunctionComponent
  >,
>(
  render: (props: P, ref: React.Ref<T>) => React.ReactElement | null,
  propsToAttach: A = {} as A
): ((props: P & React.RefAttributes<T>) => React.ReactElement | null) & A => {
  const ForwardReferredComponent = forwardRef(render) as any

  for (const i in propsToAttach) {
    ForwardReferredComponent[i] = propsToAttach[i]
  }

  return ForwardReferredComponent
}
