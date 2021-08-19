import Icon from '../../../shared/components/icon'
import { Trans } from 'react-i18next'

export default function AddCollaboratorsUpgradeContentVariant() {
  return (
    <>
      <div className="row">
        <div className="col-xs-10 col-xs-offset-1">
          <p className="text-center">
            <Trans i18nKey="need_to_upgrade_for_more_collabs_variant" />
          </p>
        </div>
      </div>
      <div className="row">
        <ul className="list-unstyled col-xs-7">
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
        </ul>
        <ul className="list-unstyled col-xs-5">
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
      </div>
      <br />
    </>
  )
}
