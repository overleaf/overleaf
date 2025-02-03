import { useEditorContext } from '../context/editor-context'

function useViewerPermissions() {
  const { permissionsLevel } = useEditorContext()
  return permissionsLevel === 'readOnly'
}

export default useViewerPermissions
