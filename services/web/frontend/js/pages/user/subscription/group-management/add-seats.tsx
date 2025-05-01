import '../base'
import { createRoot } from 'react-dom/client'
import Root from '@/features/group-management/components/add-seats/root'

const element = document.getElementById('add-seats-root')
if (element) {
  const root = createRoot(element)
  root.render(<Root />)
}
