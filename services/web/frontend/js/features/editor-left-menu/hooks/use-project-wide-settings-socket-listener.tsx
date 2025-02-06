import { useCallback, useEffect } from 'react'
import { useIdeContext } from '../../../shared/context/ide-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import type { ProjectSettings } from '../utils/api'

export default function useProjectWideSettingsSocketListener() {
  const { socket } = useIdeContext()

  const [project, setProject] = useScopeValue<ProjectSettings | undefined>(
    'project'
  )

  const setCompiler = useCallback(
    (compiler: ProjectSettings['compiler']) => {
      if (project) {
        setProject({ ...project, compiler })
      }
    },
    [project, setProject]
  )

  const setImageName = useCallback(
    (imageName: ProjectSettings['imageName']) => {
      if (project) {
        setProject({ ...project, imageName })
      }
    },
    [project, setProject]
  )

  const setSpellCheckLanguage = useCallback(
    (spellCheckLanguage: ProjectSettings['spellCheckLanguage']) => {
      if (project) {
        setProject({ ...project, spellCheckLanguage })
      }
    },
    [project, setProject]
  )

  useEffect(() => {
    // data is not available on initial mounting
    const dataAvailable = !!project

    if (dataAvailable && socket) {
      socket.on('compilerUpdated', setCompiler)
      socket.on('imageNameUpdated', setImageName)
      socket.on('spellCheckLanguageUpdated', setSpellCheckLanguage)
      return () => {
        socket.removeListener('compilerUpdated', setCompiler)
        socket.removeListener('imageNameUpdated', setImageName)
        socket.removeListener(
          'spellCheckLanguageUpdated',
          setSpellCheckLanguage
        )
      }
    }
  }, [socket, project, setCompiler, setImageName, setSpellCheckLanguage])
}
