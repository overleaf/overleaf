import type { ProjectCompiler } from '../../../../../types/project-settings'
import { sendMB } from '../../../infrastructure/event-tracking'
import { postJSON } from '../../../infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { UserSettings } from '../../../../../types/user-settings'

export interface ProjectSettings {
  compiler: ProjectCompiler
  imageName: string
  rootDocId: string
  spellCheckLanguage: string
  name: string
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
