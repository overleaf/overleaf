import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import { Message, useChatContext } from '@/features/chat/context/chat-context'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { useCallback } from 'react'

export default function MessageDropdown({ message }: { message: Message }) {
  const { t } = useTranslation()
  const { deleteMessage, startedEditingMessage } = useChatContext()

  const { showGenericConfirmModal } = useModalsContext()

  const deleteButtonHandler = useCallback(() => {
    showGenericConfirmModal({
      title: t('delete_message'),
      message: t('delete_message_confirmation'),
      onConfirm: () => {
        deleteMessage(message.id)
      },
    })
  }, [deleteMessage, message.id, showGenericConfirmModal, t])

  const editButtonHandler = useCallback(() => {
    startedEditingMessage(message.id)
  }, [message.id, startedEditingMessage])

  return (
    <Dropdown align="end" className="message-dropdown float-end">
      <DropdownToggle bsPrefix="message-dropdown-menu-btn">
        <MaterialIcon type="more_vert" accessibilityLabel={t('actions')} />
      </DropdownToggle>
      <DropdownMenu
        className="message-dropdown-menu"
        // Make the dropdown appear overlap with the button slightly so that the
        // menu stays visible when the user moves their cursor into the menu
        // when the menu is positioned above the button
        popperConfig={{
          modifiers: [{ name: 'offset', options: { offset: [0, -3] } }],
        }}
      >
        <DropdownListItem>
          <DropdownItem as="button" onClick={editButtonHandler}>
            {t('edit')}
          </DropdownItem>
          <DropdownItem as="button" onClick={deleteButtonHandler}>
            {t('delete')}
          </DropdownItem>
        </DropdownListItem>
      </DropdownMenu>
    </Dropdown>
  )
}
