import { MergeAndOverride } from '../../../../types/utils'

type PolymorphicComponentOwnProps<E extends React.ElementType> = {
  as?: E
}

export type PolymorphicComponentProps<E extends React.ElementType> =
  MergeAndOverride<React.ComponentProps<E>, PolymorphicComponentOwnProps<E>>

function PolymorphicComponent<E extends React.ElementType = 'div'>({
  as,
  ...props
}: PolymorphicComponentProps<E>) {
  const Component = as || 'div'

  return <Component {...props} />
}

export default PolymorphicComponent
