import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'

export default function AddCollaboratorsUpgradeContentDefault() {
  const { t } = useTranslation()

  return (
    <>
      <p className="text-center">
        {t('need_to_upgrade_for_more_collabs')}. {t('also')}:
      </p>
      <ul className="list-unstyled">
        <li>
          <Icon type="check" />
          &nbsp;
          {t('unlimited_projects')}
        </li>
        <li>
          <Icon type="check" />
          &nbsp;
          {t('collabs_per_proj', {
            collabcount: 'Multiple',
          })}
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
    </>
  )
}
