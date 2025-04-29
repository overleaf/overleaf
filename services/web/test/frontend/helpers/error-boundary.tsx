import { ComponentType, FC } from 'react'
import withErrorBoundary from '@/infrastructure/error-boundary'

const FallbackComponent: FC = () => {
  return <>An error occurred within the test container</>
}

export const withTestContainerErrorBoundary = function <T>(
  Component: ComponentType<T>
) {
  return withErrorBoundary(Component, FallbackComponent)
}
