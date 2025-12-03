import { ReactNode, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import OLBadge from '@/shared/components/ol/ol-badge'
import { postJSON } from '@/infrastructure/fetch-json'
import OLButton from '@/shared/components/ol/ol-button'
import getMeta from '@/utils/meta'
import Notification from '../notification'

export type LabsExperimentWidgetProps = {
  logo: ReactNode
  title: string
  description: string | ReactNode
  optedInDescription?: string | ReactNode
  helpPath?: string
  labsEnabled?: boolean
  experimentName: string
  setErrorMessage: (message: string) => void
  optedIn: boolean
  setOptedIn: (optedIn: boolean) => void
  feedbackLink?: string
}

/** @knipignore */
export function LabsExperimentWidget({
  logo,
  title,
  description,
  optedInDescription,
  helpPath,
  labsEnabled,
  experimentName,
  setErrorMessage,
  optedIn,
  setOptedIn,
  feedbackLink,
}: LabsExperimentWidgetProps) {
  const { t } = useTranslation()

  const experimentsErrorMessage = t(
    'we_are_unable_to_opt_you_into_this_experiment'
  )

  const allowedExperiments = getMeta('ol-allowedExperiments')
  const disabled = !allowedExperiments.includes(experimentName) && !optedIn

  const handleEnable = useCallback(async () => {
    try {
      const enablePath = `/labs/participate/experiments/${experimentName}/opt-in`
      await postJSON(enablePath)
      setOptedIn(true)
    } catch (err) {
      setErrorMessage(experimentsErrorMessage)
    }
  }, [experimentName, setErrorMessage, experimentsErrorMessage, setOptedIn])

  const handleDisable = useCallback(async () => {
    try {
      const disablePath = `/labs/participate/experiments/${experimentName}/opt-out`
      await postJSON(disablePath)
      setOptedIn(false)
    } catch (err) {
      setErrorMessage(experimentsErrorMessage)
    }
  }, [experimentName, setErrorMessage, experimentsErrorMessage, setOptedIn])

  return (
    <div
      className={`labs-experiment-widget-container ${disabled ? 'disabled-experiment' : ''}`}
    >
      <div className="experiment-logo-container">{logo}</div>
      <div className="description-container">
        <div className="title-row">
          <h3 className="h4">{title}</h3>
          {optedIn && <OLBadge bg="info">{t('enabled')}</OLBadge>}
        </div>
        <p className="small">
          {optedIn && optedInDescription ? optedInDescription : description}{' '}
          {helpPath && (
            <a href={helpPath} target="_blank" rel="noreferrer">
              {t('learn_more')}
            </a>
          )}
        </p>
      </div>
      <div>
        {optedIn && feedbackLink && (
          <OLButton
            variant="ghost"
            href={feedbackLink}
            target="_blank"
            rel="noreferrer"
          >
            {t('give_feedback')}
          </OLButton>
        )}
      </div>
      <div>
        {labsEnabled && (
          <ActionButton
            optedIn={optedIn}
            handleDisable={handleDisable}
            handleEnable={handleEnable}
            disabled={disabled}
          />
        )}
      </div>
      {disabled && (
        <>
          <div />
          <Notification
            type="info"
            content={t('experiment_full_check_back_soon')}
          />
          <div />
          <div />
        </>
      )}
    </div>
  )
}

type ActionButtonProps = {
  optedIn?: boolean
  disabled?: boolean
  handleEnable: () => void
  handleDisable: () => void
}

function ActionButton({
  optedIn,
  disabled,
  handleEnable,
  handleDisable,
}: ActionButtonProps) {
  const { t } = useTranslation()

  if (optedIn) {
    return (
      <OLButton variant="secondary" onClick={handleDisable}>
        {t('disable')}
      </OLButton>
    )
  } else if (disabled) {
    return (
      <OLButton variant="primary" disabled>
        {t('enable')}
      </OLButton>
    )
  } else {
    return (
      <OLButton variant="primary" onClick={handleEnable}>
        {t('enable')}
      </OLButton>
    )
  }
}

export default LabsExperimentWidget
