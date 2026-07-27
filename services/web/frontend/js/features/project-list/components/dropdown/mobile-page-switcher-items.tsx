import { useTranslation } from 'react-i18next'
import { OLDropdownItem } from '@/shared/components/ol/ol-dropdown-menu'
import { ActivePage } from '../../util/navigation-state'

type Props = {
  activePage: ActivePage
  onProjectsClick?: () => void
}

function MobilePageSwitcherItems({ activePage, onProjectsClick }: Props) {
  const { t } = useTranslation()

  return (
    <>
      <li role="none">
        <OLDropdownItem href="/library" active={activePage === 'library'}>
          {t('library')}
        </OLDropdownItem>
      </li>
      <li role="none">
        {onProjectsClick ? (
          <OLDropdownItem
            as="button"
            tabIndex={-1}
            trailingIcon="chevron_right"
            onClick={e => {
              e.stopPropagation()
              onProjectsClick()
            }}
          >
            {t('projects')}
          </OLDropdownItem>
        ) : (
          <OLDropdownItem href="/project" active={activePage === 'projects'}>
            {t('projects')}
          </OLDropdownItem>
        )}
      </li>
    </>
  )
}

export default MobilePageSwitcherItems
