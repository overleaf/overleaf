import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Dropdown, MenuItem } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'
import useSort from '../../hooks/use-sort'
import withContent, { SortBtnProps } from '../sort/with-content'
import { useProjectListContext } from '../../context/project-list-context'
import { Sort } from '../../../../../../types/project/dashboard/api'
import MenuItemButton from './menu-item-button'

function Item({ onClick, text, iconType, screenReaderText }: SortBtnProps) {
  return (
    <MenuItemButton onClick={onClick} className="projects-sort-menu-item">
      {iconType ? (
        <Icon type={iconType} className="menu-item-button-icon" />
      ) : null}
      <span className="menu-item-button-text">{text}</span>
      <span className="sr-only">{screenReaderText}</span>
    </MenuItemButton>
  )
}

const ItemWithContent = withContent(Item)

function SortByDropdown() {
  const { t } = useTranslation()
  const [title, setTitle] = useState(() => t('last_modified'))
  const [isOpened, setIsOpened] = useState(false)
  const { sort } = useProjectListContext()
  const { handleSort } = useSort()
  const sortByTranslations = useRef<Record<Sort['by'], string>>({
    title: t('title'),
    owner: t('owner'),
    lastUpdated: t('last_modified'),
  })

  const handleClick = (by: Sort['by']) => {
    setTitle(sortByTranslations.current[by])
    setIsOpened(false)
    handleSort(by)
  }

  useEffect(() => {
    setTitle(sortByTranslations.current[sort.by])
  }, [sort.by])

  return (
    <Dropdown
      id="projects-sort-dropdown"
      className="projects-sort-dropdown"
      pullRight
      open={isOpened}
      onToggle={open => setIsOpened(open)}
    >
      <Dropdown.Toggle bsSize="small" noCaret className="pe-0 btn-transparent">
        <span className="text-truncate me-1">{title}</span>
        <Icon type="angle-down" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="projects-dropdown-menu">
        <MenuItem header>{t('sort_by')}:</MenuItem>
        <ItemWithContent
          column="title"
          text={t('title')}
          sort={sort}
          onClick={() => handleClick('title')}
        />
        <ItemWithContent
          column="owner"
          text={t('owner')}
          sort={sort}
          onClick={() => handleClick('owner')}
        />
        <ItemWithContent
          column="lastUpdated"
          text={t('last_modified')}
          sort={sort}
          onClick={() => handleClick('lastUpdated')}
        />
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default SortByDropdown
