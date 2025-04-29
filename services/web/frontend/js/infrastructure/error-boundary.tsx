import { captureException } from './error-reporter'
import { withErrorBoundary as rebWithErrorBoundary } from 'react-error-boundary'
import { ComponentType, ErrorInfo } from 'react'
import { FallbackProps } from 'react-error-boundary/dist/declarations/src/types'

function errorHandler(error: Error, errorInfo: ErrorInfo) {
  captureException(error, {
    extra: {
      componentStack: errorInfo.componentStack,
    },
    tags: {
      handler: 'react-error-boundary',
    },
  })
}

function DefaultFallbackComponent() {
  return <></>
}

function withErrorBoundary(
  WrappedComponent: ComponentType<any>,
  FallbackComponent?: ComponentType<FallbackProps>
) {
  return rebWithErrorBoundary(WrappedComponent, {
    onError: errorHandler,
    FallbackComponent: FallbackComponent || DefaultFallbackComponent,
  })
}

export default withErrorBoundary
