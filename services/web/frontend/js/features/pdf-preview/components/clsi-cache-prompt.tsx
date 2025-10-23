import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sendMB } from '../../../infrastructure/event-tracking'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useProjectContext } from '../../../shared/context/project-context'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLButton from '@/shared/components/ol/ol-button'
import '../../../../stylesheets/pages/editor/clsi-cache-prompt.scss'
import { fallBackToClsiCache } from '@/features/pdf-preview/util/pdf-caching-flags'
import { useNewEditorVariant } from '@/features/ide-redesign/utils/new-editor-utils'

const SAY_THANKS_TIMEOUT = 10 * 1000

function ClsiCachePromptContent() {
  const { clsiCachePromptVariant, clsiCachePromptSegmentation } =
    useCompileContext()
  const { projectId } = useProjectContext()
  const newEditorVariant = useNewEditorVariant()

  const [hasRatedProject, setHasRatedProject] = usePersistedState(
    `clsi-cache-prompt:${clsiCachePromptVariant}:${projectId}`,
    false,
    { listen: true }
  )
  const [dismiss, setDismiss] = usePersistedState(
    `clsi-cache-prompt:dismiss`,
    false,
    { listen: true }
  )
  const [sayThanks, setSayThanks] = useState(false)

  function sendEvent(feedback: string) {
    sendMB('clsi-cache-prompt', {
      projectId,
      clsiCacheEnabled: fallBackToClsiCache,
      clsiCachePromptVariant,
      newEditorVariant,
      ...clsiCachePromptSegmentation[clsiCachePromptVariant],
      feedback,
    })
  }

  function submitFeedback(feedback: string) {
    sendEvent(feedback)
    setHasRatedProject(true)
    setSayThanks(true)
    window.setTimeout(() => {
      setSayThanks(false)
    }, SAY_THANKS_TIMEOUT)
  }

  function dismissFeedback() {
    sendEvent('dismiss')
    setDismiss(true)
  }

  const { t } = useTranslation()
  if (clsiCachePromptVariant === 'default') return null
  switch (true) {
    case sayThanks:
      return (
        <OLNotification
          type="info"
          className="clsi-cache-prompt"
          onDismiss={() => setSayThanks(false)}
          content={t('clsi_cache_prompt_thanks')}
        />
      )
    case dismiss || hasRatedProject:
      return null
    case clsiCachePromptSegmentation?.[clsiCachePromptVariant] != null: {
      let question: string
      let answers: Record<string, string>
      switch (clsiCachePromptVariant) {
        case 'compile': {
          question = t('clsi_cache_prompt_compile_question')
          answers = {
            slower: t('clsi_cache_prompt_compile_slower'),
            same: t('clsi_cache_prompt_compile_same'),
            faster: t('clsi_cache_prompt_compile_faster'),
          }
          break
        }
        case 'preview':
        case 'preview-error': {
          question = t('clsi_cache_prompt_preview_question')
          answers = {
            less: t('clsi_cache_prompt_preview_less'),
            same: t('clsi_cache_prompt_preview_same'),
            more: t('clsi_cache_prompt_preview_more'),
          }
          break
        }
        case 'synctex': {
          question = t('clsi_cache_prompt_synctex_question')
          answers = {
            less: t('clsi_cache_prompt_synctex_less'),
            same: t('clsi_cache_prompt_synctex_same'),
            more: t('clsi_cache_prompt_synctex_more'),
          }
          break
        }
      }
      return (
        <OLNotification
          type="info"
          className="clsi-cache-prompt"
          customIcon={<></>}
          isDismissible
          onDismiss={dismissFeedback}
          content={
            <>
              {question}
              <br />
              {Object.entries(answers).map(([feedback, text]) => (
                <OLButton
                  variant="secondary"
                  size="sm"
                  onClick={() => submitFeedback(feedback)}
                  key={feedback}
                >
                  {text}
                </OLButton>
              ))}
            </>
          }
        />
      )
    }
    default:
      return null
  }
}

function ClsiCachePrompt() {
  const { clsiCachePromptVariant, showLogs } = useCompileContext()

  const onlyInLogsPane = clsiCachePromptVariant === 'preview-error'
  if (clsiCachePromptVariant === 'default' || showLogs !== onlyInLogsPane) {
    return null
  }
  return <ClsiCachePromptContent />
}

export default memo(ClsiCachePrompt)
