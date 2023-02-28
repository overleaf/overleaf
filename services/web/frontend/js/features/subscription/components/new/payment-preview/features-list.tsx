import { useTranslation } from 'react-i18next'
import { Plan } from '../../../../../../../types/subscription/plan'

type FeaturesListProps = {
  features: NonNullable<Plan['features']>
}

function FeaturesList({ features }: FeaturesListProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className="text-small">{t('all_premium_features_including')}</div>
      <ul className="small" data-testid="features-list">
        {features.compileTimeout > 1 && (
          <li>{t('increased_compile_timeout')}</li>
        )}
        {features.dropbox && features.github && (
          <li>{t('sync_dropbox_github')}</li>
        )}
        {features.versioning && <li>{t('full_doc_history')}</li>}
        {features.trackChanges && <li>{t('track_changes')}</li>}
        {features.references && <li>{t('reference_search')}</li>}
        {(features.mendeley || features.zotero) && (
          <li>{t('reference_sync')}</li>
        )}
        {features.symbolPalette && <li>{t('symbol_palette')}</li>}
      </ul>
    </>
  )
}

export default FeaturesList
