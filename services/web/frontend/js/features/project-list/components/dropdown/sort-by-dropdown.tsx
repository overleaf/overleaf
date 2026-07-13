import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import useSort from '../../hooks/use-sort'
import withContent, { SortBtnProps } from '../sort/with-content'
import { useProjectListContext } from '../../context/project-list-context'
import { Sort } from '../../../../../../types/project/dashboard/api'
import {
  OLDropdown,
  OLDropdownHeader,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'

function Item({ onClick, text, iconType }: SortBtnProps) {
  return (
    <OLDropdownItem
      as="button"
      tabIndex={-1}
      onClick={onClick}
      trailingIcon={iconType}
    >
      {text}
    </OLDropdownItem>
  )
}

const ItemWithContent = withContent(Item)

function SortByDropdown() {
  const { t } = useTranslation()
  const [title, setTitle] = useState(() => t('last_modified'))
  const { sort } = useProjectListContext()
  const { handleSort } = useSort()
  const sortByTranslations = useRef<Record<Sort['by'], string>>({
    title: t('title'),
    owner: t('owner'),
    lastUpdated: t('last_modified'),
  })

  const handleClick = (by: Sort['by']) => {
    setTitle(sortByTranslations.current[by])
    handleSort(by)
  }

  useEffect(() => {
    setTitle(sortByTranslations.current[sort.by])
  }, [sort.by])

  return (
    <OLDropdown className="projects-sort-dropdown" align="end">
      <OLDropdownToggle
        id="projects-sort-dropdown"
        className="pe-0 mb-0 btn-transparent"
        size="sm"
        aria-label={t('sort_projects')}
      >
        <span className="text-truncate" aria-hidden>
          {title}
        </span>
      </OLDropdownToggle>
      <OLDropdownMenu flip={false}>
        <OLDropdownHeader className="text-uppercase">
          {t('sort_by')}:
        </OLDropdownHeader>
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
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default SortByDropdown
