import { FC, memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownItem,
  DropdownDivider,
} from '@/shared/components/dropdown/dropdown-menu'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import SplitTestBadge from '@/shared/components/split-test-badge'

const FEEDBACK_FORM_URL = 'https://forms.gle/BsbNQeSwGKEwXpxTA'
const handleClick = () => {
  window.open(FEEDBACK_FORM_URL, '_blank', 'noopener,noreferrer')
}

export const EditorContextMenuFeedback: FC = memo(
  function EditorContextMenuFeedback() {
    const { t } = useTranslation()

    return (
      <>
        <DropdownDivider />
        <DropdownListItem>
          <DropdownItem
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
          </DropdownItem>
        </DropdownListItem>
      </>
    )
  }
)
