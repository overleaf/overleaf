import { memo, useCallback, useEffect } from 'react'
import { Button } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import { startFreeTrial } from '../../../main/account-upgrade'

function CompileTimeWarning() {
  const { t } = useTranslation()

  const { showCompileTimeWarning, setShowCompileTimeWarning } =
    useDetachCompileContext()

  useEffect(() => {
    if (showCompileTimeWarning) {
      eventTracking.sendMB('compile-time-warning-displayed', {})
    }
  }, [showCompileTimeWarning])

  const closeWarning = () => {
    eventTracking.sendMB('compile-time-warning-dismissed', {})
    setShowCompileTimeWarning(false)
  }

  const handleUpgradeClick = useCallback(event => {
    event.preventDefault()
    startFreeTrial('compile-time-warning')
  }, [])

  if (!showCompileTimeWarning) {
    return null
  }

  return (
    <div className="alert alert-success compile-time-warning" role="alert">
      <Button
        className="close"
        data-dismiss="alert"
        aria-label="Close"
        onClick={closeWarning}
      >
        <span aria-hidden="true">&times;</span>
      </Button>
      <div>
        <div className="warning-text">
          <Trans
            i18nKey="approaching_compile_timeout_limit_upgrade_for_more_compile_time"
            // eslint-disable-next-line react/jsx-key
            components={[<strong style={{ display: 'inline-block' }} />]}
          />
        </div>
        <div className="upgrade-prompt">
          <Button bsStyle="primary" bsSize="sm" onClick={handleUpgradeClick}>
            {t('upgrade')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default memo(CompileTimeWarning)
