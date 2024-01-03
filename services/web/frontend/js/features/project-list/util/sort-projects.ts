import { Project, Sort } from '../../../../../types/project/dashboard/api'
import { SortingOrder } from '../../../../../types/sorting-order'
import { getOwnerName } from './project'
import { Compare } from '../../../../../types/helpers/array/sort'

const order = (order: SortingOrder, projects: Project[]) => {
  return order === 'asc' ? [...projects] : projects.reverse()
}

export const ownerNameComparator = (v1: Project, v2: Project) => {
  const ownerNameV1 = getOwnerName(v1)
  const ownerNameV2 = getOwnerName(v2)

  // sorting by owner === 'You' is with highest precedence
  if (ownerNameV1 === 'You') {
    if (ownerNameV2 === 'You') {
      return v1.lastUpdated < v2.lastUpdated
        ? Compare.SORT_A_BEFORE_B
        : Compare.SORT_A_AFTER_B
    }

    return Compare.SORT_A_AFTER_B
  }

  // empty owner name
  if (ownerNameV1 === '') {
    if (ownerNameV2 === '') {
      return v1.lastUpdated < v2.lastUpdated
        ? Compare.SORT_A_BEFORE_B
        : Compare.SORT_A_AFTER_B
    }

    return Compare.SORT_A_BEFORE_B
  }

  if (ownerNameV2 === 'You') {
    return Compare.SORT_A_BEFORE_B
  }

  if (ownerNameV2 === '') {
    return Compare.SORT_A_AFTER_B
  }

  if (v1.source === 'token') {
    return Compare.SORT_A_BEFORE_B
  }

  if (v2.source === 'token') {
    return Compare.SORT_A_AFTER_B
  }

  return ownerNameV1.localeCompare(ownerNameV2)
}

export const defaultComparator = (
  v1: Project,
  v2: Project,
  key: 'name' | 'lastUpdated'
) => {
  const value1 = v1[key].toLowerCase()
  const value2 = v2[key].toLowerCase()

  if (value1 !== value2) {
    return value1 < value2 ? Compare.SORT_A_BEFORE_B : Compare.SORT_A_AFTER_B
  }

  return Compare.SORT_KEEP_ORDER
}

export default function sortProjects(projects: Project[], sort: Sort) {
  let sorted = [...projects]
  if (sort.by === 'title') {
    sorted = sorted.sort((...args) => {
      return defaultComparator(...args, 'name')
    })
  }

  if (sort.by === 'lastUpdated') {
    sorted = sorted.sort((...args) => {
      return defaultComparator(...args, 'lastUpdated')
    })
  }

  if (sort.by === 'owner') {
    sorted = sorted.sort((...args) => {
      return ownerNameComparator(...args)
    })
  }

  return order(sort.order, sorted)
}
