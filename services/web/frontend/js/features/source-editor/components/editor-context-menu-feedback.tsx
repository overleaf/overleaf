import { FC, memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  OLDropdownItem,
  OLDropdownDivider,
} from '@/shared/components/ol/ol-dropdown-menu'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import SplitTestBadge from '@/shared/components/split-test-badge'
import { sendContextMenuEvent } from '../utils/context-menu-analytics'

const FEEDBACK_FORM_URL = 'https://forms.gle/BsbNQeSwGKEwXpxTA'

function handleClick() {
  sendContextMenuEvent('menu-click', {
    location: 'editor-context-menu',
    item: 'give-feedback',
  })
  window.open(FEEDBACK_FORM_URL, '_blank', 'noopener,noreferrer')
}

export const EditorContextMenuFeedback: FC = memo(
  function EditorContextMenuFeedback() {
    const { t } = useTranslation()

    return (
      <>
        <OLDropdownDivider />
        <DropdownListItem>
          <OLDropdownItem
            as="button"
            onClick={handleClick}
            leadingIcon={
              <SplitTestBadge
                splitTestName="editor-context-menu"
                displayOnVariants={['enabled']}
              />
            }
          >
            {t('give_feedback')}
          </OLDropdownItem>
        </DropdownListItem>
      </>
    )
  }
)
