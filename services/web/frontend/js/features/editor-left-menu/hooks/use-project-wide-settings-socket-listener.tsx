import { useCallback, useEffect } from 'react'
import { ProjectCompiler } from '../../../../../types/project-settings'
import { useIdeContext } from '../../../shared/context/ide-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import type { ProjectSettingsScope } from '../utils/api'

export default function useProjectWideSettingsSocketListener() {
  const ide = useIdeContext()

  const [projectScope, setProjectScope] = useScopeValue<
    ProjectSettingsScope | undefined
  >('project', true)

  const setCompiler = useCallback(
    (compiler: ProjectCompiler) => {
      if (projectScope) {
        setProjectScope({ ...projectScope, compiler })
      }
    },
    [projectScope, setProjectScope]
  )

  const setImageName = useCallback(
    (imageName: string) => {
      if (projectScope) {
        setProjectScope({ ...projectScope, imageName })
      }
    },
    [projectScope, setProjectScope]
  )

  const setSpellCheckLanguage = useCallback(
    (spellCheckLanguage: string) => {
      if (projectScope) {
        setProjectScope({ ...projectScope, spellCheckLanguage })
      }
    },
    [projectScope, setProjectScope]
  )

  useEffect(() => {
    // data is not available on initial mounting
    const dataAvailable = !!projectScope

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
  }, [
    ide?.socket,
    projectScope,
    setCompiler,
    setImageName,
    setSpellCheckLanguage,
  ])
}
