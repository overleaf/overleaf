import FileTreeContext from '../../../../../frontend/js/features/file-tree/components/file-tree-context'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

export default (children, options = {}) => {
  let { contextProps = {}, ...renderOptions } = options
  contextProps = {
    projectId: '123abc',
    projectRootFolder: [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [],
        fileRefs: [],
        folders: [],
      },
    ],
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
    ...contextProps,
  }
  const {
    refProviders,
    reindexReferences,
    setRefProviderEnabled,
    setStartedFreeTrial,
    onSelect,
    ...editorContextProps
  } = contextProps
  return renderWithEditorContext(
    <FileTreeContext
      refProviders={refProviders}
      reindexReferences={reindexReferences}
      setRefProviderEnabled={setRefProviderEnabled}
      setStartedFreeTrial={setStartedFreeTrial}
      onSelect={onSelect}
    >
      {children}
    </FileTreeContext>,
    editorContextProps,
    renderOptions
  )
}
