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
import { useModalsContext } from '@/features/ide-react/context/modals-context'

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
      renameProject: (newName: string) => void
      setPermissionsLevel: (permissionsLevel: PermissionsLevel) => void
      showSymbolPalette?: boolean
      toggleSymbolPalette?: () => void
      insertSymbol?: (symbol: string) => void
      isProjectOwner: boolean
      isRestrictedTokenMember?: boolean
      isPendingEditor: boolean
      permissionsLevel: PermissionsLevel
      deactivateTutorial: (tutorial: string) => void
      inactiveTutorials: string[]
      currentPopup: string | null
      setCurrentPopup: Dispatch<SetStateAction<string | null>>
      setOutOfSync: (value: boolean) => void
      assistantUpgraded: boolean
      setAssistantUpgraded: (value: boolean) => void
      hasPremiumSuggestion: boolean
      setHasPremiumSuggestion: (value: boolean) => void
      setPremiumSuggestionResetDate: (date: Date) => void
      premiumSuggestionResetDate: Date
    }
  | undefined
>(undefined)

export const EditorProvider: FC = ({ children }) => {
  const { socket } = useIdeContext()
  const { id: userId, featureUsage } = useUserContext()
  const { role } = useDetachContext()
  const { showGenericMessageModal } = useModalsContext()

  const { owner, features, _id: projectId, members } = useProjectContext()

  const cobranding = useMemo(() => {
    const brandVariation = getMeta('ol-brandVariation')
    return (
      brandVariation && {
        logoImgUrl: brandVariation.logo_url,
        brandVariationName: brandVariation.name,
        brandVariationId: brandVariation.id,
        brandId: brandVariation.brand_id,
        brandVariationHomeUrl: brandVariation.home_url,
        publishGuideHtml: brandVariation.publish_guide_html,
        partner: brandVariation.partner,
        brandedMenu: brandVariation.branded_menu,
        submitBtnHtml: brandVariation.submit_button_html,
      }
    )
  }, [])

  const [projectName, setProjectName] = useScopeValue('project.name')
  const [permissionsLevel, setPermissionsLevel] =
    useScopeValue('permissionsLevel')
  const [outOfSync, setOutOfSync] = useState(false)
  const [showSymbolPalette] = useScopeValue('editor.showSymbolPalette')
  const [toggleSymbolPalette] = useScopeValue('editor.toggleSymbolPalette')

  const [inactiveTutorials, setInactiveTutorials] = useState(
    () => getMeta('ol-inactiveTutorials') || []
  )

  const [currentPopup, setCurrentPopup] = useState<string | null>(null)
  const [assistantUpgraded, setAssistantUpgraded] = useState(false)
  const [hasPremiumSuggestion, setHasPremiumSuggestion] = useState<boolean>(
    () => {
      return Boolean(
        featureUsage?.aiErrorAssistant &&
          featureUsage?.aiErrorAssistant.remainingUsage > 0
      )
    }
  )
  const [premiumSuggestionResetDate, setPremiumSuggestionResetDate] =
    useState<Date>(() => {
      return featureUsage?.aiErrorAssistant?.resetDate
        ? new Date(featureUsage.aiErrorAssistant.resetDate)
        : new Date()
    })

  const isPendingEditor = useMemo(
    () =>
      members?.some(member => member._id === userId && member.pendingEditor),
    [members, userId]
  )

  const deactivateTutorial = useCallback(
    tutorialKey => {
      setInactiveTutorials([...inactiveTutorials, tutorialKey])
    },
    [inactiveTutorials]
  )

  useEffect(() => {
    if (socket) {
      socket.on('projectNameUpdated', setProjectName)
      return () => socket.removeListener('projectNameUpdated', setProjectName)
    }
  }, [socket, setProjectName])

  const renameProject = useCallback(
    (newName: string) => {
      setProjectName((oldName: string) => {
        if (oldName !== newName) {
          saveProjectSettings(projectId, { name: newName }).catch(
            (response: any) => {
              setProjectName(oldName)
              const { data, status } = response

              showGenericMessageModal(
                'Error renaming project',
                status === 400 ? data : 'Please try again in a moment'
              )
            }
          )
        }
        return newName
      })
    },
    [setProjectName, projectId, showGenericMessageModal]
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
    parts.push(getMeta('ol-ExposedSettings').appName)

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
      renameProject,
      permissionsLevel: outOfSync ? 'readOnly' : permissionsLevel,
      setPermissionsLevel,
      isProjectOwner: owner?._id === userId,
      isRestrictedTokenMember: getMeta('ol-isRestrictedTokenMember'),
      isPendingEditor,
      showSymbolPalette,
      toggleSymbolPalette,
      insertSymbol,
      inactiveTutorials,
      deactivateTutorial,
      currentPopup,
      setCurrentPopup,
      setOutOfSync,
      hasPremiumSuggestion,
      setHasPremiumSuggestion,
      premiumSuggestionResetDate,
      setPremiumSuggestionResetDate,
      assistantUpgraded,
      setAssistantUpgraded,
    }),
    [
      cobranding,
      features?.compileGroup,
      owner,
      userId,
      renameProject,
      permissionsLevel,
      setPermissionsLevel,
      isPendingEditor,
      showSymbolPalette,
      toggleSymbolPalette,
      insertSymbol,
      inactiveTutorials,
      deactivateTutorial,
      currentPopup,
      setCurrentPopup,
      outOfSync,
      setOutOfSync,
      hasPremiumSuggestion,
      setHasPremiumSuggestion,
      premiumSuggestionResetDate,
      setPremiumSuggestionResetDate,
      assistantUpgraded,
      setAssistantUpgraded,
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
