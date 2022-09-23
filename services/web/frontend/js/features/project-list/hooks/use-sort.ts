import { useProjectListContext } from '../context/project-list-context'
import { Sort } from '../../../../../types/project/dashboard/api'
import { SortingOrder } from '../../../../../types/sorting-order'

const toggleSort = (order: SortingOrder): SortingOrder => {
  return order === 'asc' ? 'desc' : 'asc'
}

function useSort() {
  const { sort, setSort } = useProjectListContext()

  const handleSort = (by: Sort['by']) => {
    setSort(prev => ({
      by,
      order: prev.by === by ? toggleSort(sort.order) : sort.order,
    }))
  }

  return { handleSort }
}

export default useSort
