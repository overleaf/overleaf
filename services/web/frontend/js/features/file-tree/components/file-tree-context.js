import PropTypes from 'prop-types'

import { FileTreeMainProvider } from '../contexts/file-tree-main'
import { FileTreeActionableProvider } from '../contexts/file-tree-actionable'
import { FileTreeMutableProvider } from '../contexts/file-tree-mutable'
import { FileTreeSelectableProvider } from '../contexts/file-tree-selectable'
import { FileTreeDraggableProvider } from '../contexts/file-tree-draggable'

// renders all the contexts needed for the file tree:
// FileTreeMain: generic store
// FileTreeActionable: global UI state for actions (rename, delete, etc.)
// FileTreeMutable: provides entities mutation operations
// FileTreeSelectable: handles selection and multi-selection
function FileTreeContext({
  refProviders,
  reindexReferences,
  setRefProviderEnabled,
  setStartedFreeTrial,
  onSelect,
  children,
}) {
  return (
    <FileTreeMainProvider
      refProviders={refProviders}
      setRefProviderEnabled={setRefProviderEnabled}
      setStartedFreeTrial={setStartedFreeTrial}
      reindexReferences={reindexReferences}
    >
      <FileTreeMutableProvider>
        <FileTreeSelectableProvider onSelect={onSelect}>
          <FileTreeActionableProvider>
            <FileTreeDraggableProvider>{children}</FileTreeDraggableProvider>
          </FileTreeActionableProvider>
        </FileTreeSelectableProvider>
      </FileTreeMutableProvider>
    </FileTreeMainProvider>
  )
}

FileTreeContext.propTypes = {
  reindexReferences: PropTypes.func.isRequired,
  refProviders: PropTypes.object.isRequired,
  setRefProviderEnabled: PropTypes.func.isRequired,
  setStartedFreeTrial: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
}

export default FileTreeContext
