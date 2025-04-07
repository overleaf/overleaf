import { ReactElement, useCallback, useEffect, useState } from 'react'
import Close from '@/shared/components/close'
import { useEditorContext } from '@/shared/context/editor-context'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useUserContext } from '@/shared/context/user-context'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import OLPopover from '@/features/ui/components/ol/ol-popover'
import OLOverlay from '@/features/ui/components/ol/ol-overlay'

const CODE_EDITOR_POPOVER_TIMEOUT = 1000
export const codeEditorModePrompt = 'code-editor-mode-prompt'

export const EditorSwitchBeginnerPopover = ({
  children,
  targetRef,
}: {
  children: ReactElement
  targetRef: React.RefObject<HTMLElement>
}) => {
  const user = useUserContext()
  const { inactiveTutorials } = useEditorContext()
  const { t } = useTranslation()
  const [codeEditorOpened] = useScopeValue('editor.codeEditorOpened')
  const { completeTutorial } = useTutorial(codeEditorModePrompt, {
    location: 'logs',
    name: codeEditorModePrompt,
  })
  const [popoverShown, setPopoverShown] = useState(false)

  const shouldShowCodeEditorPopover = useCallback(() => {
    if (inactiveTutorials.includes(codeEditorModePrompt)) {
      return false
    }

    if (getMeta('ol-usedLatex') !== 'never') {
      // only show popover to the users that never used LaTeX (submitted in onboarding data collection)
      return false
    }

    if (codeEditorOpened) {
      // dont show popover if code editor was opened at some point
      return false
    }

    const msSinceSignedUp =
      user.signUpDate && Date.now() - new Date(user.signUpDate).getTime()

    if (msSinceSignedUp && msSinceSignedUp < 24 * 60 * 60 * 1000) {
      // dont show popover if user has signed up is less than 24 hours
      return false
    }

    return true
  }, [codeEditorOpened, inactiveTutorials, user.signUpDate])

  useEffect(() => {
    if (popoverShown && codeEditorOpened) {
      setPopoverShown(false)
    }
  }, [codeEditorOpened, popoverShown])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (shouldShowCodeEditorPopover()) {
        setPopoverShown(true)
      }
    }, CODE_EDITOR_POPOVER_TIMEOUT)

    return () => clearTimeout(timeout)
  }, [shouldShowCodeEditorPopover])

  return (
    <>
      {children}
      <OLOverlay
        placement="bottom"
        show={popoverShown}
        rootClose
        onHide={() => setPopoverShown(false)}
        target={targetRef.current}
      >
        <OLPopover id="editor-switch-popover">
          <div>
            <Close
              variant="dark"
              onDismiss={() => {
                setPopoverShown(false)
                completeTutorial({ event: 'promo-click', action: 'complete' })
              }}
            />
            <div className="tooltip-title">
              {t('code_editor_tooltip_title')}
            </div>
            <div>{t('code_editor_tooltip_message')}</div>
          </div>
        </OLPopover>
      </OLOverlay>
    </>
  )
}
