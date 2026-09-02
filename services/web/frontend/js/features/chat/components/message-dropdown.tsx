import {
  OLDropdown,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
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
    <OLDropdown align="end" className="message-dropdown float-end">
      <OLDropdownToggle bsPrefix="message-dropdown-menu-btn">
        <MaterialIcon type="more_vert" accessibilityLabel={t('actions')} />
      </OLDropdownToggle>
      <OLDropdownMenu
        className="message-dropdown-menu"
        // Make the dropdown appear overlap with the button slightly so that the
        // menu stays visible when the user moves their cursor into the menu
        // when the menu is positioned above the button
        popperConfig={{
          modifiers: [{ name: 'offset', options: { offset: [0, -3] } }],
        }}
      >
        <DropdownListItem>
          <OLDropdownItem as="button" onClick={editButtonHandler}>
            {t('edit')}
          </OLDropdownItem>
          <OLDropdownItem as="button" onClick={deleteButtonHandler}>
            {t('delete')}
          </OLDropdownItem>
        </DropdownListItem>
      </OLDropdownMenu>
    </OLDropdown>
  )
}
