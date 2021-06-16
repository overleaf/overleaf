import React from 'react'
import { ContextRoot } from '../../js/shared/context/root-context'

// Unfortunately, we cannot currently use decorators here, since we need to
// set a value on window, before the contexts are rendered.
// When using decorators, the contexts are rendered before the story, so we
// don't have the opportunity to set the window value first.
export function withContextRoot(Story, scope) {
  const ide = {
    ...window._ide,
    $scope: {
      ...window._ide.$scope,
      ...scope,
    },
  }

  return (
    <ContextRoot ide={ide} settings={{}}>
      {Story}
    </ContextRoot>
  )
}
