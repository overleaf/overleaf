import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'

function useViewerPermissions() {
  const { permissionsLevel } = useIdeReactContext()
  return permissionsLevel === 'readOnly'
}

export default useViewerPermissions
