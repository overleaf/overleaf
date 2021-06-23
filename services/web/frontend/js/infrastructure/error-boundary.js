import { captureException } from './error-reporter'
import { ErrorBoundary } from 'react-error-boundary'

function errorHandler(error, componentStack) {
  captureException(error, scope => {
    scope.setExtra('componentStack', componentStack)
    scope.setTag('handler', 'react-error-boundary')
    return scope
  })
}

function DefaultFallbackComponent() {
  return <></>
}

function withErrorBoundary(WrappedComponent, FallbackComponent) {
  function ErrorBoundaryWrapper(props) {
    return (
      <ErrorBoundary
        FallbackComponent={FallbackComponent || DefaultFallbackComponent}
        onError={errorHandler}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
  ErrorBoundaryWrapper.propTypes = WrappedComponent.propTypes
  ErrorBoundaryWrapper.displayName = `WithErrorBoundaryWrapper${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  }`
  return ErrorBoundaryWrapper
}

export default withErrorBoundary
