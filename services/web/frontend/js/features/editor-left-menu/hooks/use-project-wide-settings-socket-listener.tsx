import { useCallback, useEffect } from 'react'
import { useIdeContext } from '../../../shared/context/ide-context'
import { useProjectContext } from '@/shared/context/project-context'
import type { ProjectSettings } from '../utils/api'

export default function useProjectWideSettingsSocketListener() {
  const { socket } = useIdeContext()

  const { project, updateProject } = useProjectContext()

  const setTypstVersion = useCallback(
    (typstVersion: ProjectSettings['typstVersion']) => {
      if (project) {
        updateProject({ typstVersion })
      }
    },
    [project, updateProject]
  )

  const setCompiler = useCallback(
    (compiler: ProjectSettings['compiler']) => {
      if (project) {
        updateProject({ compiler })
      }
    },
    [project, updateProject]
  )

  const setImageName = useCallback(
    (imageName: ProjectSettings['imageName']) => {
      if (project) {
        updateProject({ imageName })
      }
    },
    [project, updateProject]
  )

  const setSpellCheckLanguage = useCallback(
    (spellCheckLanguage: ProjectSettings['spellCheckLanguage']) => {
      if (project) {
        updateProject({ spellCheckLanguage })
      }
    },
    [project, updateProject]
  )

  useEffect(() => {
    // data is not available on initial mounting
    const dataAvailable = !!project

    if (dataAvailable && socket) {
      socket.on('compilerUpdated', setCompiler)
      socket.on('typstVersionUpdated', setTypstVersion)
      socket.on('imageNameUpdated', setImageName)
      socket.on('spellCheckLanguageUpdated', setSpellCheckLanguage)
      return () => {
        socket.removeListener('compilerUpdated', setCompiler)
        socket.removeListener('setTypstVersion', setTypstVersion)
        socket.removeListener('imageNameUpdated', setImageName)
        socket.removeListener(
          'spellCheckLanguageUpdated',
          setSpellCheckLanguage
        )
      }
    }
  }, [socket, project, setCompiler, setTypstVersion, setImageName, setSpellCheckLanguage])
}
