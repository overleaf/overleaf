import { ReactNode, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '@/shared/components/badge'
import Tooltip from '@/shared/components/tooltip'
import { postJSON } from '@/infrastructure/fetch-json'
import { Button } from 'react-bootstrap'
import getMeta from '@/utils/meta'

type IntegrationLinkingWidgetProps = {
  logo: ReactNode
  title: string
  description: string
  helpPath?: string
  labsEnabled?: boolean
  experimentName: string
  setErrorMessage: (message: string) => void
  optedIn: boolean
  setOptedIn: (optedIn: boolean) => void
}

export function LabsExperimentWidget({
  logo,
  title,
  description,
  helpPath,
  labsEnabled,
  experimentName,
  setErrorMessage,
  optedIn,
  setOptedIn,
}: IntegrationLinkingWidgetProps) {
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
      <div className="p-2">{logo}</div>
      <div className="description-container">
        <div className="title-row">
          <h3 className="h4">{title}</h3>
          {optedIn && <Badge bsStyle="info">{t('enabled')}</Badge>}
        </div>
        <p className="small">
          {description}{' '}
          {helpPath && (
            <a href={helpPath} target="_blank" rel="noreferrer">
              {t('learn_more')}
            </a>
          )}
        </p>
      </div>
      {disabled && (
        <div className="disabled-explanation">{t('experiment_full')}</div>
      )}
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
      <Button
        bsStyle="secondary"
        onClick={handleDisable}
        className="btn btn-secondary"
      >
        {t('turn_off')}
      </Button>
    )
  } else if (disabled) {
    return (
      <Tooltip
        id="experiment-disabled"
        description={t('this_experiment_isnt_accepting_new_participants')}
        overlayProps={{ delay: 0 }}
      >
        <Button bsStyle="secondary" className="btn btn-primary" disabled>
          {t('turn_on')}
        </Button>
      </Tooltip>
    )
  } else {
    return (
      <Button
        bsStyle="primary"
        onClick={handleEnable}
        className="btn btn-primary"
      >
        {t('turn_on')}
      </Button>
    )
  }
}

export default LabsExperimentWidget
