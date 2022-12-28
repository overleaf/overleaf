import { useCallback, useEffect } from 'react'
import { ProjectCompiler } from '../../../../../types/project-settings'
import { useIdeContext } from '../../../shared/context/ide-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'

type UseProjectWideSettingsSocketListener = {
  onListen: () => void
}

export default function useProjectWideSettingsSocketListener({
  onListen,
}: UseProjectWideSettingsSocketListener) {
  const ide = useIdeContext()

  const [compilerScope, setCompilerScope] =
    useScopeValue<ProjectCompiler>('project.compiler')
  const [imageNameScope, setImageNameScope] =
    useScopeValue<string>('project.imageName')
  const [spellCheckLanguageScope, setSpellCheckLanguageScope] =
    useScopeValue<string>('project.spellCheckLanguage')

  const setCompiler = useCallback(
    (compiler: ProjectCompiler) => {
      onListen()
      setCompilerScope(compiler)
    },
    [setCompilerScope, onListen]
  )

  const setImageName = useCallback(
    (imageName: string) => {
      onListen()
      setImageNameScope(imageName)
    },
    [setImageNameScope, onListen]
  )

  const setSpellCheckLanguage = useCallback(
    (spellCheckLanguage: string) => {
      onListen()
      setSpellCheckLanguageScope(spellCheckLanguage)
    },
    [setSpellCheckLanguageScope, onListen]
  )

  useEffect(() => {
    // data is not available on initial mounting
    const dataAvailable =
      compilerScope && imageNameScope && spellCheckLanguageScope

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
    compilerScope,
    setCompiler,
    imageNameScope,
    setImageName,
    spellCheckLanguageScope,
    setSpellCheckLanguage,
  ])
}
