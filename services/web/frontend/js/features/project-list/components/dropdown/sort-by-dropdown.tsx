import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dropdown as BS3Dropdown,
  MenuItem as BS3MenuItem,
} from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'
import useSort from '../../hooks/use-sort'
import withContent, { SortBtnProps } from '../sort/with-content'
import { useProjectListContext } from '../../context/project-list-context'
import { Sort } from '../../../../../../types/project/dashboard/api'
import MenuItemButton from './menu-item-button'
import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function Item({ onClick, text, iconType, screenReaderText }: SortBtnProps) {
  return (
    <BootstrapVersionSwitcher
      bs3={
        <MenuItemButton onClick={onClick} className="projects-sort-menu-item">
          {iconType ? (
            <Icon type={iconType} className="menu-item-button-icon" />
          ) : null}
          <span className="menu-item-button-text">{text}</span>
          <span className="sr-only">{screenReaderText}</span>
        </MenuItemButton>
      }
      bs5={
        <DropdownItem
          as="button"
          tabIndex={-1}
          onClick={onClick}
          trailingIcon={iconType}
        >
          {text}
        </DropdownItem>
      }
    />
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
  const handleClickBS5 = (by: Sort['by']) => {
    setTitle(sortByTranslations.current[by])
    handleSort(by)
  }

  useEffect(() => {
    setTitle(sortByTranslations.current[sort.by])
  }, [sort.by])

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3Dropdown
          id="projects-sort-dropdown"
          className="projects-sort-dropdown"
          pullRight
          open={isOpened}
          onToggle={open => setIsOpened(open)}
        >
          <BS3Dropdown.Toggle
            bsSize="small"
            noCaret
            className="pe-0 btn-transparent"
          >
            <span className="text-truncate me-1">{title}</span>
            <Icon type="angle-down" />
          </BS3Dropdown.Toggle>
          <BS3Dropdown.Menu className="projects-dropdown-menu">
            <BS3MenuItem header>{t('sort_by')}:</BS3MenuItem>
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
          </BS3Dropdown.Menu>
        </BS3Dropdown>
      }
      bs5={
        <Dropdown className="projects-sort-dropdown" align="end">
          <DropdownToggle
            id="projects-sort-dropdown"
            className="pe-0 mb-0 btn-transparent"
            size="sm"
            aria-label={t('sort_projects')}
          >
            <span className="text-truncate" aria-hidden>
              {title}
            </span>
          </DropdownToggle>
          <DropdownMenu flip={false}>
            <DropdownHeader className="text-uppercase">
              {t('sort_by')}:
            </DropdownHeader>
            <ItemWithContent
              column="title"
              text={t('title')}
              sort={sort}
              onClick={() => handleClickBS5('title')}
            />
            <ItemWithContent
              column="owner"
              text={t('owner')}
              sort={sort}
              onClick={() => handleClickBS5('owner')}
            />
            <ItemWithContent
              column="lastUpdated"
              text={t('last_modified')}
              sort={sort}
              onClick={() => handleClickBS5('lastUpdated')}
            />
          </DropdownMenu>
        </Dropdown>
      }
    />
  )
}

export default SortByDropdown
