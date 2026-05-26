import { useTranslation } from 'react-i18next'
import { DropdownItem } from '@/shared/components/dropdown/dropdown-menu'

type Props = {
  activePage: 'library' | 'projects'
  onProjectsClick?: () => void
}

function MobilePageSwitcherItems({ activePage, onProjectsClick }: Props) {
  const { t } = useTranslation()

  return (
    <>
      <li role="none">
        <DropdownItem href="/library" active={activePage === 'library'}>
          {t('library')}
        </DropdownItem>
      </li>
      <li role="none">
        {onProjectsClick ? (
          <DropdownItem
            as="button"
            tabIndex={-1}
            trailingIcon="chevron_right"
            onClick={e => {
              e.stopPropagation()
              onProjectsClick()
            }}
          >
            {t('projects')}
          </DropdownItem>
        ) : (
          <DropdownItem href="/project" active={activePage === 'projects'}>
            {t('projects')}
          </DropdownItem>
        )}
      </li>
    </>
  )
}

export default MobilePageSwitcherItems
