import { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import Tooltip from '../../../shared/components/tooltip'
import Close from '@/shared/components/close'
import { useEditorContext } from '@/shared/context/editor-context'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useUserContext } from '@/shared/context/user-context'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'

const CODE_EDITOR_TOOLTIP_TIMEOUT = 1000
export const codeEditorModePrompt = 'code-editor-mode-prompt'

export const EditorSwitchBeginnerTooltip = ({
  children,
}: {
  children: ReactElement
}) => {
  const toolbarRef = useRef<any>(null)
  const user = useUserContext()
  const { inactiveTutorials } = useEditorContext()
  const { t } = useTranslation()
  const [codeEditorOpened] = useScopeValue('editor.codeEditorOpened')
  const { completeTutorial } = useTutorial(codeEditorModePrompt, {
    location: 'logs',
    name: codeEditorModePrompt,
  })
  const [tooltipShown, setTooltipShown] = useState(false)

  const shouldShowCodeEditorTooltip = useCallback(() => {
    if (inactiveTutorials.includes(codeEditorModePrompt)) {
      return false
    }

    if (getMeta('ol-usedLatex') !== 'never') {
      // only show tooltip to the users that never used LaTeX (submitted in onboarding data collection)
      return false
    }

    if (codeEditorOpened) {
      // dont show tooltip if code editor was opened at some point
      return false
    }

    const msSinceSignedUp =
      user.signUpDate && Date.now() - new Date(user.signUpDate).getTime()

    if (msSinceSignedUp && msSinceSignedUp < 24 * 60 * 60 * 1000) {
      // dont show tooltip if user has signed up is less than 24 hours
      return false
    }

    return true
  }, [codeEditorOpened, inactiveTutorials, user.signUpDate])

  const showCodeEditorTooltip = useCallback(() => {
    if (toolbarRef.current && 'show' in toolbarRef.current) {
      toolbarRef.current.show()
      setTooltipShown(true)
    }
  }, [])

  const hideCodeEditorTooltip = useCallback(() => {
    if (toolbarRef.current && 'hide' in toolbarRef.current) {
      toolbarRef.current.hide()
      setTooltipShown(false)
    }
  }, [])

  useEffect(() => {
    if (tooltipShown && codeEditorOpened) {
      hideCodeEditorTooltip()
    }
  }, [codeEditorOpened, hideCodeEditorTooltip, tooltipShown])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (shouldShowCodeEditorTooltip()) {
        showCodeEditorTooltip()
      }
    }, CODE_EDITOR_TOOLTIP_TIMEOUT)

    return () => clearTimeout(timeout)
  }, [showCodeEditorTooltip, shouldShowCodeEditorTooltip])

  return (
    <Tooltip
      id="editor-switch-tooltip"
      description={
        <div>
          <Close
            variant="dark"
            onDismiss={() => {
              hideCodeEditorTooltip()
              completeTutorial({ event: 'promo-click', action: 'complete' })
            }}
          />
          <div className="tooltip-title">{t('code_editor_tooltip_title')}</div>
          <div>{t('code_editor_tooltip_message')}</div>
        </div>
      }
      tooltipProps={{
        className: 'editor-switch-tooltip',
      }}
      overlayProps={{
        ref: toolbarRef,
        placement: 'bottom',
        shouldUpdatePosition: true,
        // @ts-ignore
        // trigger: null is used to prevent the tooltip from showing on hover
        // but it is not allowed in the type definition
        trigger: null,
      }}
    >
      {children}
    </Tooltip>
  )
}
