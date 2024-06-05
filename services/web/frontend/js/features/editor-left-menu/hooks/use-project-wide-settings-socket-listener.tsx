import { useCallback, useEffect } from 'react'
import { useIdeContext } from '../../../shared/context/ide-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import type { ProjectSettings } from '../utils/api'

export default function useProjectWideSettingsSocketListener() {
  const ide = useIdeContext()

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

    if (dataAvailable && ide?.socket) {
      ide.socket.on('compilerUpdated', setCompiler)
      ide.socket.on('imageNameUpdated', setImageName)
      ide.socket.on('spellCheckLanguageUpdated', setSpellCheckLanguage)
      return () => {
        ide.socket.removeListener('compilerUpdated', setCompiler)
        ide.socket.removeListener('imageNameUpdated', setImageName)
        ide.socket.removeListener(
          'spellCheckLanguageUpdated',
          setSpellCheckLanguage
        )
      }
    }
  }, [ide?.socket, project, setCompiler, setImageName, setSpellCheckLanguage])
}
