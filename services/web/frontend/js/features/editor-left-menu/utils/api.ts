import type {
  FontFamily,
  LineHeight,
  OverallTheme,
} from '../../source-editor/extensions/theme'
import type {
  Keybindings,
  PdfViewer,
  ProjectCompiler,
} from '../../../../../types/project-settings'
import { sendMB } from '../../../infrastructure/event-tracking'
import { postJSON } from '../../../infrastructure/fetch-json'

export type UserSettings = {
  pdfViewer: PdfViewer
  autoComplete: boolean
  autoPairDelimiters: boolean
  syntaxValidation: boolean
  editorTheme: string
  overallTheme: OverallTheme
  mode: Keybindings
  fontSize: string
  fontFamily: FontFamily
  lineHeight: LineHeight
}

export type ProjectSettings = {
  compiler: ProjectCompiler
  imageName: string
  rootDocId: string
  spellCheckLanguage: string
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
  }).catch(console.error)
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
