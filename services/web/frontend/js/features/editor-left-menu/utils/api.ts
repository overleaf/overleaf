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

export type ProjectSettingsScope = {
  compiler: ProjectCompiler
  imageName: string
  rootDoc_id: string
  spellCheckLanguage: string
}

type SaveUserSettings = Partial<
  UserSettingsScope & {
    spellCheckLanguage: ProjectSettingsScope['spellCheckLanguage']
  }
>

export function saveUserSettings(data: SaveUserSettings) {
  postJSON('/user/settings', {
    body: {
      _csrf: window.csrfToken,
      ...data,
    },
  })
}

// server asks for "rootDocId" but client has "rootDoc_id"
type ProjectSettingsRequestBody = Partial<
  Omit<ProjectSettingsScope, 'rootDoc_id'> & {
    rootDocId: string
  }
>

export const saveProjectSettings = async (
  projectId: string,
  data: Partial<ProjectSettingsScope>
) => {
  let reqData: ProjectSettingsRequestBody = {}

  if (data.rootDoc_id) {
    const val = data.rootDoc_id
    delete data.rootDoc_id
    reqData = {
      ...data,
      rootDocId: val,
    }
  } else {
    reqData = data
  }

  await postJSON<never>(`/project/${projectId}/settings`, {
    body: {
      _csrf: window.csrfToken,
      ...reqData,
    },
  })
}
