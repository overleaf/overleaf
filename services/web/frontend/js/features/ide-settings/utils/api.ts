import type { ProjectCompiler } from '../../../../../types/project-settings'
import { sendMB } from '../../../infrastructure/event-tracking'
import { postJSON } from '../../../infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { UserSettings } from '../../../../../types/user-settings'

export interface ProjectSettings {
  compiler: ProjectCompiler
  imageName: string
  // Optional: a project that has never set png2pdf sends no value, which the
  // compile context treats as "no preference, use the local default".
  png2pdf?: boolean
  rootDocId: string
  spellCheckLanguage: string
  name: string
  mainBibliographyDocId?: string
  referenceFormat?: 'bibtex' | 'biblatex'
}

type SaveUserSettings = Partial<
  UserSettings & {
    spellCheckLanguage: ProjectSettings['spellCheckLanguage']
  }
>

export function saveUserSettings(
  key: keyof SaveUserSettings,
  value: SaveUserSettings[keyof SaveUserSettings]
) {
  sendMB('setting-changed', {
    changedSetting: key,
    changedSettingVal: value,
  })

  postJSON('/user/settings', {
    body: {
      [key]: value,
    },
  }).catch(debugConsole.error)
}

export const saveProjectSettings = async (
  projectId: string,
  data: Partial<ProjectSettings>
) => {
  await postJSON<never>(`/project/${projectId}/settings`, {
    body: {
      ...data,
    },
  })
}
