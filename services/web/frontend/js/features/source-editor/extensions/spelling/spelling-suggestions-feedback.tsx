import { FC, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSplitTest } from '@/shared/context/split-test-context'
import { chooseBadgeClass } from '@/shared/components/beta-badge'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import classnames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'

const SpellingSuggestionsFeedback: FC = () => {
  const { t } = useTranslation()
  const { info } = useSplitTest('spell-check-client')

  if (!info) {
    return null
  }

  const { tooltipText, url } = info.badgeInfo ?? {}
  const badgeClass = chooseBadgeClass(info.phase)

  return (
    <OLTooltip
      id="spell-check-client-tooltip"
      description={
        tooltipText || (
          <>
            We are testing an updated spellchecker.
            <br />
            Click to give feedback
          </>
        )
      }
      tooltipProps={{ className: 'split-test-badge-tooltip' }}
      overlayProps={{ placement: 'bottom', delay: 100 }}
    >
      <a
        href={url || '/beta/participate'}
        target="_blank"
        rel="noopener noreferrer"
      >
        <BootstrapVersionSwitcher
          bs3={
            <span
              className={classnames('badge', badgeClass)}
              style={{ width: 14, height: 14 }}
            />
          }
          bs5={
            <MaterialIcon
              type="info"
              className={classnames('align-middle', badgeClass)}
            />
          }
        />
        <span className="mx-2">{t('give_feedback')}</span>
      </a>
    </OLTooltip>
  )
}

export default memo(SpellingSuggestionsFeedback)
