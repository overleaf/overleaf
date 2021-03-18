import React from 'react'
import { render } from '@testing-library/react'
import FileTreeContext from '../../../../../frontend/js/features/file-tree/components/file-tree-context'

export default (children, options = {}) => {
  let { contextProps = {}, ...renderOptions } = options
  contextProps = {
    projectId: '123abc',
    rootFolder: [
      {
        docs: [],
        fileRefs: [],
        folders: []
      }
    ],
    hasWritePermissions: true,
    hasFeature: () => true,
    refProviders: {},
    reindexReferences: () => {
      console.log('reindex references')
    },
    setRefProviderEnabled: provider => {
      console.log(`ref provider ${provider} enabled`)
    },
    setStartedFreeTrial: () => {
      console.log('started free trial')
    },
    onSelect: () => {},
    ...contextProps
  }
  return render(
    <FileTreeContext {...contextProps}>{children}</FileTreeContext>,
    renderOptions
  )
}
