import { memo } from 'react'
import InlineTags from './cells/inline-tags'
import OwnerCell from './cells/owner-cell'
import LastUpdatedCell from './cells/last-updated-cell'
import ActionsCell from './cells/actions-cell'
import ActionsDropdown from '../dropdown/actions-dropdown'
import { getOwnerName } from '../../util/project'
import { Project } from '../../../../../../types/project/dashboard/api'
import { ProjectCheckbox } from './project-checkbox'
import { ProjectListOwnerName } from '@/features/project-list/components/table/project-list-owner-name'
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

type ProjectListTableRowProps = {
  project: Project
  selected: boolean
}
function ProjectListTableRow({ project, selected }: ProjectListTableRowProps) {
  const ownerName = getOwnerName(project)

  return (
    <tr className={selected ? bsVersion({ bs5: 'table-active' }) : undefined}>
      <td
        className={classnames(
          'dash-cell-checkbox',
          bsVersion({
            bs5: 'd-none d-md-table-cell',
            bs3: 'hidden-xs',
          })
        )}
      >
        <ProjectCheckbox projectId={project.id} projectName={project.name} />
      </td>
      <td className="dash-cell-name">
        <a href={`/project/${project.id}`}>{project.name}</a>{' '}
        <InlineTags
          className={bsVersion({
            bs5: 'd-none d-md-inline',
            bs3: 'hidden-xs',
          })}
          projectId={project.id}
        />
      </td>
      <td
        className={classnames(
          'dash-cell-date-owner',
          'pb-0',
          bsVersion({ bs5: 'd-md-none', bs3: 'visible-xs' })
        )}
      >
        <LastUpdatedCell project={project} />
        {ownerName ? <ProjectListOwnerName ownerName={ownerName} /> : null}
      </td>
      <td
        className={classnames(
          'dash-cell-owner',
          bsVersion({
            bs5: 'd-none d-md-table-cell',
            bs3: 'hidden-xs',
          })
        )}
      >
        <OwnerCell project={project} />
      </td>
      <td
        className={classnames(
          'dash-cell-date',
          bsVersion({
            bs5: 'd-none d-md-table-cell',
            bs3: 'hidden-xs',
          })
        )}
      >
        <LastUpdatedCell project={project} />
      </td>
      <td
        className={classnames(
          'dash-cell-tag',
          'pt-0',
          bsVersion({ bs5: 'd-md-none', bs3: 'visible-xs' })
        )}
      >
        <InlineTags projectId={project.id} />
      </td>
      <td className="dash-cell-actions">
        <div
          className={bsVersion({
            bs5: 'd-none d-md-block',
            bs3: 'hidden-xs',
          })}
        >
          <ActionsCell project={project} />
        </div>
        <div className={bsVersion({ bs5: 'd-md-none', bs3: 'visible-xs' })}>
          <ActionsDropdown project={project} />
        </div>
      </td>
    </tr>
  )
}
export default memo(ProjectListTableRow)
