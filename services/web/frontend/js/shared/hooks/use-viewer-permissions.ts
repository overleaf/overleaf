import { useEditorContext } from '../context/editor-context'
import getMeta from '@/utils/meta'

function useViewerPermissions() {
  const { permissionsLevel } = useEditorContext()

  const hasViewerPermissions =
    getMeta('ol-linkSharingWarning') && permissionsLevel === 'readOnly'
  return hasViewerPermissions
}

export default useViewerPermissions
