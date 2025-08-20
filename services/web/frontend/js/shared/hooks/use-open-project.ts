import { useCallback } from 'react'
import { useLocation } from './use-location'

export default function useOpenProject() {
  const location = useLocation()

  const openProject = useCallback(
    (projectId: string) => {
      location.assign(`/project/${projectId}`)
    },
    [location]
  )

  return openProject
}
