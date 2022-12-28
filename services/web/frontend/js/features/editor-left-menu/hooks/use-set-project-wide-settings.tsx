import { useCallback } from 'react'
import { ProjectCompiler } from '../../../../../types/project-settings'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { ProjectSettingsScope, saveProjectSettings } from '../utils/api'
import useSetRootDocId from './use-set-root-doc-id'
import useSetSpellCheckLanguage from './use-set-spell-check-language'

type UseSetProjectWideSettings = {
  ignoreUpdates: boolean
}

export default function useSetProjectWideSettings({
  ignoreUpdates,
}: UseSetProjectWideSettings) {
  // The value will be undefined on mount
  const [project, setProject] = useScopeValue<ProjectSettingsScope | undefined>(
    'project',
    true
  )
  const { _id: projectId } = useProjectContext()

  const setCompiler = useCallback(
    (compiler: ProjectCompiler) => {
      const allowUpdate = !ignoreUpdates && project?.compiler

      if (allowUpdate) {
        setProject({ ...project, compiler })
        saveProjectSettings({ projectId, compiler })
      }
    },
    [projectId, project, setProject, ignoreUpdates]
  )

  const setImageName = useCallback(
    (imageName: string) => {
      const allowUpdate = !ignoreUpdates && project?.imageName

      if (allowUpdate) {
        setProject({ ...project, imageName })
        saveProjectSettings({ projectId, imageName })
      }
    },
    [projectId, project, setProject, ignoreUpdates]
  )

  const setRootDocId = useSetRootDocId({ ignoreUpdates })
  const setSpellCheckLanguage = useSetSpellCheckLanguage({ ignoreUpdates })

  return {
    compiler: project?.compiler,
    setCompiler,
    imageName: project?.imageName,
    setImageName,
    rootDocId: project?.rootDoc_id,
    setRootDocId,
    spellCheckLanguage: project?.spellCheckLanguage,
    setSpellCheckLanguage,
  }
}
