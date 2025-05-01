import {
  forwardRef,
  PropsWithoutRef,
  ReactElement,
  Ref,
  RefAttributes,
  FunctionComponent,
} from 'react'

export const fixedForwardRef = <
  T,
  P = object,
  A extends Record<string, FunctionComponent> = Record<
    string,
    FunctionComponent
  >,
>(
  render: (props: PropsWithoutRef<P>, ref: Ref<T>) => ReactElement | null,
  propsToAttach: A = {} as A
): ((props: P & RefAttributes<T>) => ReactElement | null) & A => {
  const ForwardReferredComponent = forwardRef(render) as any

  for (const i in propsToAttach) {
    ForwardReferredComponent[i] = propsToAttach[i]
  }

  return ForwardReferredComponent
}
