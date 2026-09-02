import { useCallback } from 'react'
import type { ProjectSettings } from '../utils/api'
import useRootDocId from './use-root-doc-id'
import useSaveProjectSettings from './use-save-project-settings'
import useSetSpellCheckLanguage from './use-set-spell-check-language'
import { debugConsole } from '@/utils/debugging'
import { useProjectContext } from '@/shared/context/project-context'
import getMeta from '@/utils/meta'

export default function useProjectWideSettings() {
  // The value will be undefined on mount
  const { project } = useProjectContext()
  const png2pdfEnabled = Boolean(getMeta('ol-canUsePng2Pdf'))
  const saveProjectSettings = useSaveProjectSettings()

  const setCompiler = useCallback(
    async (newCompiler: ProjectSettings['compiler']) => {
      await saveProjectSettings('compiler', newCompiler).catch(
        debugConsole.error
      )
    },
    [saveProjectSettings]
  )

  const setImageName = useCallback(
    async (newImageName: ProjectSettings['imageName']) => {
      await saveProjectSettings('imageName', newImageName).catch(
        debugConsole.error
      )
    },
    [saveProjectSettings]
  )

  const setReferenceFormat = useCallback(
    async (newReferenceFormat: ProjectSettings['referenceFormat']) => {
      await saveProjectSettings('referenceFormat', newReferenceFormat).catch(
        debugConsole.error
      )
    },
    [saveProjectSettings]
  )

  const setPng2pdf = useCallback(
    async (newPng2pdf: ProjectSettings['png2pdf']) => {
      await saveProjectSettings('png2pdf', newPng2pdf).catch(debugConsole.error)
    },
    [saveProjectSettings]
  )

  const { setRootDocId, rootDocId } = useRootDocId()
  const setSpellCheckLanguage = useSetSpellCheckLanguage()

  return {
    compiler: project?.compiler,
    setCompiler,
    imageName: project?.imageName,
    setImageName,
    referenceFormat: project?.referenceFormat,
    setReferenceFormat,
    png2pdf: project?.png2pdf ?? png2pdfEnabled,
    setPng2pdf,
    rootDocId,
    setRootDocId,
    spellCheckLanguage: project?.spellCheckLanguage,
    setSpellCheckLanguage,
  }
}
