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
import useBrowserWindow from '../hooks/use-browser-window'
import { useProjectContext } from './project-context'
import { useDetachContext } from './detach-context'
import getMeta from '../../utils/meta'
import { useUserContext } from './user-context'
import { saveProjectSettings } from '@/features/editor-left-menu/utils/api'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { WritefullAPI } from './types/writefull-instance'
import { Cobranding } from '../../../../types/cobranding'
import { SymbolWithCharacter } from '../../../../modules/symbol-palette/frontend/js/data/symbols'

type UpgradeTrackChangesModal = {
  show: boolean
  location?: string
}

export const EditorContext = createContext<
  | {
      cobranding?: Cobranding
      hasPremiumCompile?: boolean
      renameProject: (newName: string) => void
      insertSymbol?: (symbol: SymbolWithCharacter) => void
      isProjectOwner: boolean
      isRestrictedTokenMember?: boolean
      isPendingEditor: boolean
      hasSuggestionsLeft: boolean
      suggestionsLeft: number
      setSuggestionsLeft: (value: number) => void
      premiumSuggestionResetDate: Date
      setPremiumSuggestionResetDate: (date: Date) => void
      hasTokensLeft: boolean
      tokensLeft: number
      setTokensLeft: (value: number) => void
      tokenResetDate: Date
      setTokenResetDate: (date: Date) => void
      writefullInstance: WritefullAPI | null
      setWritefullInstance: (instance: WritefullAPI) => void
      upgradeTrackChangesModal: UpgradeTrackChangesModal
      setUpgradeTrackChangesModal: Dispatch<
        SetStateAction<UpgradeTrackChangesModal>
      >
    }
  | undefined
>(undefined)

export const EditorProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const { id: userId, featureUsage } = useUserContext()
  const { role } = useDetachContext()
  const { showGenericMessageModal } = useModalsContext()

  const {
    features,
    projectId,
    project,
    name: projectName,
    updateProject,
  } = useProjectContext()
  const { owner, members } = project || {}

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
        submitBtnHtmlNoBreaks: brandVariation.submit_button_html_no_br,
      }
    )
  }, [])

  const [suggestionsLeft, setSuggestionsLeft] = useState<number>(() => {
    return featureUsage?.aiFeatureUsage?.remainingUsage || 0
  })

  const hasSuggestionsLeft = useMemo(
    () => suggestionsLeft > 0,
    [suggestionsLeft]
  )

  const [premiumSuggestionResetDate, setPremiumSuggestionResetDate] =
    useState<Date>(() => {
      return featureUsage?.aiFeatureUsage?.resetDate
        ? new Date(featureUsage.aiFeatureUsage.resetDate)
        : new Date()
    })

  const [tokensLeft, setTokensLeft] = useState<number>(() => {
    return featureUsage?.aiWorkbench?.remainingTokens || 0
  })

  const hasTokensLeft = useMemo(() => tokensLeft > 0, [tokensLeft])

  const [tokenResetDate, setTokenResetDate] = useState<Date>(() => {
    return featureUsage?.aiWorkbench?.resetDate
      ? new Date(featureUsage.aiWorkbench.resetDate)
      : new Date()
  })

  const [showUpgradeModal, setShowUpgradeModal] =
    useState<UpgradeTrackChangesModal>({ show: false })

  const isPendingEditor = useMemo(
    () =>
      Boolean(
        members?.some(
          member =>
            member._id === userId &&
            (member.pendingEditor || member.pendingReviewer)
        )
      ),
    [members, userId]
  )

  const renameProject = useCallback(
    (newName: string) => {
      const oldName = projectName
      if (newName !== oldName) {
        updateProject({ name: newName })
        saveProjectSettings(projectId, { name: newName }).catch(
          (response: any) => {
            updateProject({ name: oldName })
            const { data, status } = response

            showGenericMessageModal(
              'Error renaming project',
              status === 400 ? data : 'Please try again in a moment'
            )
          }
        )
      }
    },
    [projectName, updateProject, projectId, showGenericMessageModal]
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

  const insertSymbol = useCallback((symbol: SymbolWithCharacter) => {
    window.dispatchEvent(
      new CustomEvent('editor:insert-symbol', {
        detail: symbol,
      })
    )
  }, [])

  const [writefullInstance, setWritefullInstance] =
    useState<WritefullAPI | null>(null)

  const value = useMemo(
    () => ({
      cobranding,
      hasPremiumCompile: features?.compileGroup === 'priority',
      renameProject,
      isProjectOwner: owner?._id === userId,
      isRestrictedTokenMember: getMeta('ol-isRestrictedTokenMember'),
      isPendingEditor,
      insertSymbol,
      hasSuggestionsLeft,
      suggestionsLeft,
      setSuggestionsLeft,
      premiumSuggestionResetDate,
      setPremiumSuggestionResetDate,
      hasTokensLeft,
      tokensLeft,
      setTokensLeft,
      tokenResetDate,
      setTokenResetDate,
      writefullInstance,
      setWritefullInstance,
      upgradeTrackChangesModal: showUpgradeModal,
      setUpgradeTrackChangesModal: setShowUpgradeModal,
    }),
    [
      cobranding,
      features?.compileGroup,
      owner,
      userId,
      renameProject,
      isPendingEditor,
      insertSymbol,
      hasSuggestionsLeft,
      suggestionsLeft,
      setSuggestionsLeft,
      premiumSuggestionResetDate,
      setPremiumSuggestionResetDate,
      hasTokensLeft,
      tokensLeft,
      setTokensLeft,
      tokenResetDate,
      setTokenResetDate,
      writefullInstance,
      setWritefullInstance,
      showUpgradeModal,
      setShowUpgradeModal,
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
