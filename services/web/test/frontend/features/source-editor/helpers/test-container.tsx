import { FC, ComponentProps, PropsWithChildren, Suspense } from 'react'
import { withTestContainerErrorBoundary } from '../../../helpers/error-boundary'

const style = { width: 785, height: 785 }

const TestContainerWithoutErrorBoundary: FC<
  PropsWithChildren<ComponentProps<'div'>>
> = ({ children, ...rest }) => (
  <div style={style} {...rest}>
    <Suspense fallback={null}>{children}</Suspense>
  </div>
)

// react-error-boundary version 5 requires an error boundary when using
// useErrorBoundary, which we do in several components
export const TestContainer = withTestContainerErrorBoundary(
  TestContainerWithoutErrorBoundary
)
