import { useTranslation } from 'react-i18next'
import { useEditorContext } from '../../../shared/context/editor-context'
import Icon from '../../../shared/components/icon'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import { memo } from 'react'
import PdfLogEntry from './pdf-log-entry'

function TimeoutUpgradePrompt() {
  const { t } = useTranslation()

  const { hasPremiumCompile, isProjectOwner } = useEditorContext()

  if (!window.ExposedSettings.enableSubscriptions || hasPremiumCompile) {
    return null
  }

  return (
    <PdfLogEntry
      headerTitle={
        isProjectOwner
          ? t('upgrade_for_longer_compiles')
          : t('ask_proj_owner_to_upgrade_for_longer_compiles')
      }
      formattedContent={
        <>
          <p>{t('free_accounts_have_timeout_upgrade_to_increase')}</p>
          <p>{t('plus_upgraded_accounts_receive')}:</p>
          <div>
            <ul className="list-unstyled">
              <li>
                <Icon type="check" />
                &nbsp;
                {t('unlimited_projects')}
              </li>
              <li>
                <Icon type="check" />
                &nbsp;
                {t('collabs_per_proj', { collabcount: 'Multiple' })}
              </li>
              <li>
                <Icon type="check" />
                &nbsp;
                {t('full_doc_history')}
              </li>
              <li>
                <Icon type="check" />
                &nbsp;
                {t('sync_to_dropbox')}
              </li>
              <li>
                <Icon type="check" />
                &nbsp;
                {t('sync_to_github')}
              </li>
              <li>
                <Icon type="check" />
                &nbsp;
                {t('compile_larger_projects')}
              </li>
            </ul>
          </div>
          {isProjectOwner && (
            <p className="text-center">
              <StartFreeTrialButton
                source="compile-timeout"
                buttonStyle="success"
                classes={{ button: 'row-spaced-small' }}
              />
            </p>
          )}
        </>
      }
      entryAriaLabel={
        isProjectOwner
          ? t('upgrade_for_longer_compiles')
          : t('ask_proj_owner_to_upgrade_for_longer_compiles')
      }
      level="success"
    />
  )
}

export default memo(TimeoutUpgradePrompt)
