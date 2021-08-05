import Pagination from '../js/shared/components/pagination'

export const Interactive = args => {
  return <Pagination {...args} />
}

export default {
  title: 'Pagination',
  component: Pagination,
  args: {
    currentPage: 1,
    totalPages: 10,
    handlePageClick: () => {},
  },
  argTypes: {
    currentPage: { control: { type: 'number', min: 1, max: 10, step: 1 } },
    totalPages: { control: { disable: true } },
  },
}
