import Icon from '../../../shared/components/icon'
import { Trans, useTranslation } from 'react-i18next'

export default function AddCollaboratorsUpgradeContentDefault() {
  const { t } = useTranslation()

  return (
    <>
      <p className="text-center">
        <Trans i18nKey="need_to_upgrade_for_more_collabs" />. {t('also')}:
      </p>
      <ul className="list-unstyled">
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="unlimited_projects" />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans
            i18nKey="collabs_per_proj"
            values={{ collabcount: 'Multiple' }}
          />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="full_doc_history" />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="sync_to_dropbox" />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="sync_to_github" />
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          <Trans i18nKey="compile_larger_projects" />
        </li>
      </ul>
    </>
  )
}
