import {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import useScopeValue from '../hooks/use-scope-value'
import useBrowserWindow from '../hooks/use-browser-window'
import { useIdeContext } from './ide-context'
import { useProjectContext } from './project-context'
import { useDetachContext } from './detach-context'
import getMeta from '../../utils/meta'
import { useUserContext } from './user-context'
import { saveProjectSettings } from '@/features/editor-left-menu/utils/api'
import { PermissionsLevel } from '@/features/ide-react/types/permissions'

type writefullAdButtons = '' | 'try-it' | 'log-in'

export const EditorContext = createContext<
  | {
      cobranding?: {
        logoImgUrl: string
        brandVariationName: string
        brandVariationId: number
        brandId: number
        brandVariationHomeUrl: string
        publishGuideHtml?: string
        partner?: string
        brandedMenu?: boolean
        submitBtnHtml?: string
      }
      hasPremiumCompile?: boolean
      loading?: boolean
      renameProject: (newName: string) => void
      setPermissionsLevel: (permissionsLevel: PermissionsLevel) => void
      showSymbolPalette?: boolean
      toggleSymbolPalette?: () => void
      insertSymbol?: (symbol: string) => void
      isProjectOwner: boolean
      isRestrictedTokenMember?: boolean
      permissionsLevel: 'readOnly' | 'readAndWrite' | 'owner'
      deactivateTutorial: (tutorial: string) => void
      inactiveTutorials: [string]
      currentPopup: string | null
      setCurrentPopup: Dispatch<SetStateAction<string | null>>
      writefullAdClicked: writefullAdButtons
      setWritefullAdClicked: Dispatch<SetStateAction<writefullAdButtons>>
    }
  | undefined
>(undefined)

export const EditorProvider: FC = ({ children }) => {
  const ide = useIdeContext()
  const { id: userId } = useUserContext()
  const { role } = useDetachContext()

  const { owner, features, _id: projectId } = useProjectContext()

  const cobranding = useMemo(() => {
    return (
      window.brandVariation && {
        logoImgUrl: window.brandVariation.logo_url,
        brandVariationName: window.brandVariation.name,
        brandVariationId: window.brandVariation.id,
        brandId: window.brandVariation.brand_id,
        brandVariationHomeUrl: window.brandVariation.home_url,
        publishGuideHtml: window.brandVariation.publish_guide_html,
        partner: window.brandVariation.partner,
        brandedMenu: window.brandVariation.branded_menu,
        submitBtnHtml: window.brandVariation.submit_button_html,
      }
    )
  }, [])

  const [loading] = useScopeValue('state.loading')
  const [projectName, setProjectName] = useScopeValue('project.name')
  const [permissionsLevel, setPermissionsLevel] =
    useScopeValue('permissionsLevel')
  const [showSymbolPalette] = useScopeValue('editor.showSymbolPalette')
  const [toggleSymbolPalette] = useScopeValue('editor.toggleSymbolPalette')

  const [inactiveTutorials, setInactiveTutorials] = useState(() =>
    getMeta('ol-inactiveTutorials', [])
  )

  const [writefullAdClicked, setWritefullAdClicked] =
    useState<writefullAdButtons>('')

  const [currentPopup, setCurrentPopup] = useState<string | null>(null)

  const deactivateTutorial = useCallback(
    tutorialKey => {
      setInactiveTutorials([...inactiveTutorials, tutorialKey])
    },
    [inactiveTutorials]
  )

  useEffect(() => {
    if (ide?.socket) {
      ide.socket.on('projectNameUpdated', setProjectName)
      return () =>
        ide.socket.removeListener('projectNameUpdated', setProjectName)
    }
  }, [ide?.socket, setProjectName])

  const renameProject = useCallback(
    (newName: string) => {
      setProjectName((oldName: string) => {
        if (oldName !== newName) {
          saveProjectSettings(projectId, { name: newName }).catch(
            (response: any) => {
              setProjectName(oldName)
              const { data, status } = response
              if (status === 400) {
                return ide.showGenericMessageModal(
                  'Error renaming project',
                  data
                )
              } else {
                return ide.showGenericMessageModal(
                  'Error renaming project',
                  'Please try again in a moment'
                )
              }
            }
          )
        }
        return newName
      })
    },
    [ide, setProjectName, projectId]
  )

  const { setTitle } = useBrowserWindow()
  useEffect(() => {
    const parts = []

    if (role === 'detached') {
      parts.push('[PDF]')
    }

    if (projectName) {
      parts.push(projectName)
      parts.push('-')
    }

    parts.push('Online LaTeX Editor')
    parts.push(window.ExposedSettings.appName)

    const title = parts.join(' ')

    setTitle(title)
  }, [projectName, setTitle, role])

  const insertSymbol = useCallback((symbol: string) => {
    window.dispatchEvent(
      new CustomEvent('editor:insert-symbol', {
        detail: symbol,
      })
    )
  }, [])

  const value = useMemo(
    () => ({
      cobranding,
      hasPremiumCompile: features?.compileGroup === 'priority',
      loading,
      renameProject,
      permissionsLevel,
      setPermissionsLevel,
      isProjectOwner: owner?._id === userId,
      isRestrictedTokenMember: getMeta('ol-isRestrictedTokenMember'),
      showSymbolPalette,
      toggleSymbolPalette,
      insertSymbol,
      inactiveTutorials,
      deactivateTutorial,
      currentPopup,
      setCurrentPopup,
      writefullAdClicked,
      setWritefullAdClicked,
    }),
    [
      cobranding,
      features?.compileGroup,
      owner,
      userId,
      loading,
      renameProject,
      permissionsLevel,
      setPermissionsLevel,
      showSymbolPalette,
      toggleSymbolPalette,
      insertSymbol,
      inactiveTutorials,
      deactivateTutorial,
      currentPopup,
      setCurrentPopup,
      writefullAdClicked,
      setWritefullAdClicked,
    ]
  )

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}
export function useEditorContext() {
  const context = useContext(EditorContext)

  if (!context) {
    throw new Error('useEditorContext is only available inside EditorProvider')
  }

  return context
}
