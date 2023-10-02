import LayoutWithPlaceholders from '@/features/ide-react/components/layout/layout-with-placeholders'

// This is filled with placeholder content while the real content is migrated
// away from Angular
export default function IdePage() {
  return (
    <div id="ide-react-page">
      <LayoutWithPlaceholders shouldPersistLayout />
    </div>
  )
}
