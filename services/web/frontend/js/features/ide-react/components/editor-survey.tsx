import OLButton from '@/shared/components/ol/ol-button'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import { OLToast } from '@/shared/components/ol/ol-toast'
import { OLToastContainer } from '@/shared/components/ol/ol-toast-container'
import { useEditorContext } from '@/shared/context/editor-context'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { sendMB } from '@/infrastructure/event-tracking'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import { useTranslation } from 'react-i18next'

type EditorSurveyPage = 'ease-of-use' | 'meets-my-needs' | 'thank-you'

export default memo(function EditorSurvey() {
  return (
    <OLToastContainer className="editor-survey-toast">
      <EditorSurveyContent />
    </OLToastContainer>
  )
})

const TUTORIAL_KEY = 'editor-popup-ux-survey'

const EditorSurveyContent = () => {
  const [easeOfUse, setEaseOfUse] = useState<number | null>(null)
  const [meetsMyNeeds, setMeetsMyNeeds] = useState<number | null>(null)
  const [page, setPage] = useState<EditorSurveyPage>('ease-of-use')
  const { inactiveTutorials } = useEditorContext()
  const hasCompletedSurvey = inactiveTutorials.includes(TUTORIAL_KEY)
  const newEditor = useIsNewEditorEnabled()

  const { t } = useTranslation()

  const {
    tryShowingPopup: tryShowingSurvey,
    showPopup: showSurvey,
    dismissTutorial: dismissSurvey,
    completeTutorial: completeSurvey,
  } = useTutorial(TUTORIAL_KEY, {
    name: TUTORIAL_KEY,
  })

  useEffect(() => {
    if (!hasCompletedSurvey) {
      tryShowingSurvey()
    }
  }, [hasCompletedSurvey, tryShowingSurvey])

  const onSubmit = useCallback(() => {
    sendMB('editor-survey-submit', {
      easeOfUse,
      meetsMyNeeds,
      newEditor,
    })
    setPage('thank-you')
    completeSurvey({ event: 'promo-click', action: 'complete' })
  }, [easeOfUse, meetsMyNeeds, completeSurvey, newEditor])

  if (!showSurvey && page !== 'thank-you') {
    return null
  }

  if (page === 'ease-of-use') {
    return (
      <OLToast
        className="editor-survey-question-toast"
        content={
          <EditorSurveyQuestion
            questionText={t('overleaf_is_easy_to_use')}
            name="ease-of-use"
            buttonText={t('next')}
            onButtonClick={() => setPage('meets-my-needs')}
            value={easeOfUse}
            onValueChange={setEaseOfUse}
            onDismiss={dismissSurvey}
          />
        }
        type="info"
      />
    )
  }
  if (page === 'meets-my-needs') {
    return (
      <OLToast
        className="editor-survey-question-toast"
        content={
          <EditorSurveyQuestion
            questionText={t('overleafs_functionality_meets_my_needs')}
            name="meets-my-needs"
            buttonText={t('submit_title')}
            onButtonClick={onSubmit}
            value={meetsMyNeeds}
            onValueChange={setMeetsMyNeeds}
            onDismiss={dismissSurvey}
          />
        }
        type="info"
      />
    )
  }

  return <OLToast type="info" content={t('thank_you')} autoHide delay={3000} />
}

const EditorSurveyQuestion = ({
  onDismiss,
  name,
  questionText,
  buttonText,
  onButtonClick,
  value,
  onValueChange,
}: {
  onDismiss: () => void
  name: string
  questionText: string
  buttonText: string
  onButtonClick: () => void
  value: number | null
  onValueChange: (newValue: number) => void
}) => {
  const { t } = useTranslation()

  const options = useMemo(
    () => [
      {
        value: 1,
        description: t('strongly_disagree'),
      },
      {
        value: 2,
        description: t('disagree'),
      },
      {
        value: 3,
        description: t('neither_agree_nor_disagree'),
      },
      {
        value: 4,
        description: t('agree'),
      },
      {
        value: 5,
        description: t('strongly_agree'),
      },
    ],
    [t]
  )

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value
      if (newValue) {
        onValueChange(Number(newValue))
      }
    },
    [onValueChange]
  )

  return (
    <div className="editor-survey-question">
      <div className="editor-survey-question-top-line">
        <div>{t('your_feedback_matters_answer_two_quick_questions')}</div>
        <OLIconButton
          variant="ghost"
          size="sm"
          icon="close"
          accessibilityLabel={t('close')}
          onClick={onDismiss}
        />
      </div>
      <div>
        <label className="editor-survey-question-label" htmlFor={name}>
          {questionText}
        </label>
        <OLForm className="editor-survey-question-form">
          <OLFormGroup className="editor-survey-question-options">
            {options.map(({ value: optionValue, description }) => (
              <OLFormCheckbox
                key={optionValue}
                name={name}
                type="radio"
                value={optionValue}
                id={optionValue.toString()}
                label={optionValue}
                checked={optionValue === value}
                onChange={onChange}
                aria-label={`${optionValue} ${description}`}
              />
            ))}
          </OLFormGroup>
        </OLForm>
        <div className="editor-survey-option-labels">
          <div>{t('strongly_disagree')}</div>
          <div>{t('strongly_agree')}</div>
        </div>
      </div>
      <OLButton
        size="sm"
        variant="secondary"
        onClick={onButtonClick}
        disabled={!value}
      >
        {buttonText}
      </OLButton>
    </div>
  )
}
