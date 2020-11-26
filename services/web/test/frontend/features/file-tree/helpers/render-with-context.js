import React from 'react'
import { render } from '@testing-library/react'
import FileTreeContext from '../../../../../frontend/js/features/file-tree/components/file-tree-context'

export default (children, options = {}) => {
  let { contextProps = {}, ...renderOptions } = options
  contextProps = {
    projectId: '123abc',
    rootFolder: [{}],
    hasWritePermissions: true,
    onSelect: () => {},
    ...contextProps
  }
  return render(
    <FileTreeContext {...contextProps}>{children}</FileTreeContext>,
    renderOptions
  )
}
