import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import Icon from '../../../shared/components/icon'
import iconTypeFromName from '../util/icon-type-from-name'

import { useSelectableEntity } from '../contexts/file-tree-selectable'

import FileTreeItemInner from './file-tree-item/file-tree-item-inner'

function FileTreeDoc({ name, id, isLinkedFile }) {
  const { t } = useTranslation()

  const { isSelected, props: selectableEntityProps } = useSelectableEntity(id)

  const icons = (
    <>
      <Icon
        type={iconTypeFromName(name)}
        modifier="fw"
        classes={{ icon: 'spaced' }}
      >
        {isLinkedFile ? (
          <Icon
            type="external-link-square"
            modifier="rotate-180"
            classes={{ icon: 'linked-file-highlight' }}
            accessibilityLabel={t('linked_file')}
          />
        ) : null}
      </Icon>
    </>
  )
  return (
    <li
      role="treeitem"
      {...selectableEntityProps}
      aria-label={name}
      tabIndex="0"
    >
      <FileTreeItemInner
        id={id}
        name={name}
        isSelected={isSelected}
        icons={icons}
      />
    </li>
  )
}

FileTreeDoc.propTypes = {
  name: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  isLinkedFile: PropTypes.bool,
}

export default FileTreeDoc
