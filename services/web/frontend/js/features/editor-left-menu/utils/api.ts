import {
  FontFamily,
  LineHeight,
  OverallTheme,
} from '../../../../../modules/source-editor/frontend/js/extensions/theme'
import {
  Keybindings,
  PdfViewer,
  ProjectCompiler,
} from '../../../../../types/project-settings'
import { postJSON } from '../../../infrastructure/fetch-json'

export type UserSettingsScope = {
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

export function saveUserSettings(data: Partial<UserSettingsScope>) {
  postJSON('/user/settings', {
    body: data,
  })
}

export type ProjectSettingsScope = {
  compiler: ProjectCompiler
  imageName: string
  rootDoc_id: string
  spellCheckLanguage: string
}

export const saveProjectSettings = async (
  projectId: string,
  data: Partial<ProjectSettingsScope>
) => {
  await postJSON<never>(`/project/${projectId}/settings`, {
    body: data,
  })
}
