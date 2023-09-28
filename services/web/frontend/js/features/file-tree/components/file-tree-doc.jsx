import PropTypes from 'prop-types'

import { useSelectableEntity } from '../contexts/file-tree-selectable'

import FileTreeItemInner from './file-tree-item/file-tree-item-inner'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import iconTypeFromName from '../util/icon-type-from-name'
import classnames from 'classnames'

function FileTreeDoc({ name, id, isFile, isLinkedFile }) {
  const { isSelected, props: selectableEntityProps } = useSelectableEntity(
    id,
    isFile
  )

  return (
    <li
      // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
      role="treeitem"
      // aria-selected is provided in selectableEntityProps
      {...selectableEntityProps}
      aria-label={name}
      tabIndex="0"
    >
      <FileTreeItemInner
        id={id}
        name={name}
        isSelected={isSelected}
        icons={<FileTreeIcon isLinkedFile={isLinkedFile} name={name} />}
      />
    </li>
  )
}

FileTreeDoc.propTypes = {
  name: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  isFile: PropTypes.bool,
  isLinkedFile: PropTypes.bool,
}

export const FileTreeIcon = ({ isLinkedFile, name }) => {
  const { t } = useTranslation()

  const className = classnames('spaced', 'file-tree-icon', {
    'linked-file-icon': isLinkedFile,
  })

  return (
    <>
      &nbsp;
      <Icon type={iconTypeFromName(name)} fw className={className} />
      {isLinkedFile && (
        <Icon
          type="external-link-square"
          modifier="rotate-180"
          className="linked-file-highlight"
          accessibilityLabel={t('linked_file')}
        />
      )}
    </>
  )
}
FileTreeIcon.propTypes = {
  name: PropTypes.string.isRequired,
  isLinkedFile: PropTypes.bool,
}

export default FileTreeDoc
