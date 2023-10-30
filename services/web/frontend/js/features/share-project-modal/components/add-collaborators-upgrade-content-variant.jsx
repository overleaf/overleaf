import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'

export default function AddCollaboratorsUpgradeContentVariant() {
  const { t } = useTranslation()

  return (
    <>
      <div className="row">
        <div className="col-xs-10 col-xs-offset-1">
          <p className="text-center">
            {t('need_to_upgrade_for_more_collabs_variant')}
          </p>
        </div>
      </div>
      <div className="row">
        <ul className="list-unstyled col-xs-7">
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
        </ul>
        <ul className="list-unstyled col-xs-5">
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
      <br />
    </>
  )
}
