import { ReactNode, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '@/shared/components/badge'
import { postJSON } from '@/infrastructure/fetch-json'
import { Button } from 'react-bootstrap'
import getMeta from '@/utils/meta'

export type UserFeatures = {
  [key: string]: boolean
}

type IntegrationLinkingWidgetProps = {
  logo: ReactNode
  title: string
  description: string
  helpPath?: string
  labsEnabled?: boolean
  experimentName: string
  setErrorMessage: (message: string) => void
}

export function LabsExperimentWidget({
  logo,
  title,
  description,
  helpPath,
  labsEnabled,
  experimentName,
  setErrorMessage,
}: IntegrationLinkingWidgetProps) {
  const { t } = useTranslation()
  const userFeatures = getMeta('ol-features') as UserFeatures

  const [enabled, setEnabled] = useState(() => {
    return userFeatures[experimentName] === true
  })

  const experimentsErrorMessage = t(
    'we_are_unable_to_opt_you_into_this_experiment'
  )

  const handleEnable = useCallback(async () => {
    try {
      const enablePath = `/labs/participate/experiments/${experimentName}/opt-in`
      await postJSON(enablePath)
      setEnabled(true)
    } catch (err) {
      setErrorMessage(experimentsErrorMessage)
    }
  }, [experimentName, setErrorMessage, experimentsErrorMessage])

  const handleDisable = useCallback(async () => {
    try {
      const disablePath = `/labs/participate/experiments/${experimentName}/opt-out`
      await postJSON(disablePath)
      setEnabled(false)
    } catch (err) {
      setErrorMessage(experimentsErrorMessage)
    }
  }, [experimentName, setErrorMessage, experimentsErrorMessage])

  return (
    <div className="labs-experiment-widget-container">
      <div className="p-2">{logo}</div>
      <div className="description-container">
        <div className="title-row">
          <h3 className="h4">{title}</h3>
          {enabled && <Badge bsStyle="info">{t('enabled')}</Badge>}
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
      <div>
        {labsEnabled && (
          <ActionButton
            enabled={enabled}
            handleDisable={handleDisable}
            handleEnable={handleEnable}
          />
        )}
      </div>
    </div>
  )
}

type ActionButtonProps = {
  enabled?: boolean
  handleEnable: () => void
  handleDisable: () => void
}

function ActionButton({
  enabled,
  handleEnable,
  handleDisable,
}: ActionButtonProps) {
  const { t } = useTranslation()

  if (enabled) {
    return (
      <Button
        bsStyle="secondary"
        onClick={handleDisable}
        className="btn btn-secondary"
      >
        {t('turn_off')}
      </Button>
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
