import React from 'react'
import { ErrorBoundary } from 'react-error-boundary'

function errorHandler(error, componentStack) {
  if (window.Raven) {
    Raven.captureException(error, {
      extra: { componentStack },
      tags: { mechanism: 'react-error-boundary' }
    })
  }
}

function withErrorBoundary(WrappedComponent, FallbackComponent) {
  function ErrorBoundaryWrapper(props) {
    return (
      <ErrorBoundary
        fallbackRender={FallbackComponent || null}
        onError={errorHandler}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
  ErrorBoundaryWrapper.propTypes = WrappedComponent.propTypes
  ErrorBoundaryWrapper.displayName = `WithErrorBoundaryWrapper${WrappedComponent.displayName ||
    WrappedComponent.name ||
    'Component'}`
  return ErrorBoundaryWrapper
}

export default withErrorBoundary
