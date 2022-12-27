import { useEffect } from 'react'
import { ProjectCompiler } from '../../../../../types/project-settings'
import { useIdeContext } from '../../../shared/context/ide-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'

export default function useProjectWideSettingsSocketListener() {
  const ide = useIdeContext()

  const [compiler, setCompiler] =
    useScopeValue<ProjectCompiler>('project.compiler')
  const [imageName, setImageName] = useScopeValue<string>('project.imageName')
  const [spellCheckLanguage, setSpellCheckLanguage] = useScopeValue<string>(
    'project.spellCheckLanguage'
  )

  useEffect(() => {
    // data is not available on initial mounting
    const dataAvailable = compiler && imageName && spellCheckLanguage

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
    compiler,
    setCompiler,
    imageName,
    setImageName,
    spellCheckLanguage,
    setSpellCheckLanguage,
  ])
}
