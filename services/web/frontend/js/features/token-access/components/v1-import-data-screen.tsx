import { FC } from 'react'

export type V1ImportData = {
  name?: string
  status: string
  projectId: string
}
export const V1ImportDataScreen: FC<{ v1ImportData: V1ImportData }> = ({
  v1ImportData,
}) => {
  return (
    <div className="loading-screen">
      <div className="container">
        <div className="row">
          <div className="col-sm-8 col-sm-offset-2">
            <h1 className="text-center">
              {v1ImportData.status === 'mustLogin'
                ? 'Please log in'
                : 'Overleaf v1 Project'}
            </h1>

            <img
              className="v2-import__img"
              src="/img/v1-import/v2-editor.png"
              alt="The new V2 editor."
            />

            {v1ImportData.status === 'cannotImport' && (
              <div>
                <h2 className="text-center">
                  Cannot Access Overleaf v1 Project
                </h2>

                <p className="text-center row-spaced-small">
                  Please contact the project owner or{' '}
                  <a href="/contact">contact support</a> for assistance.
                </p>
              </div>
            )}

            {v1ImportData.status === 'mustLogin' && (
              <div>
                <p className="text-center row-spaced-small">
                  You will need to log in to access this project.
                </p>

                <div className="row-spaced text-center">
                  <a
                    className="btn btn-primary"
                    href={`/login?redir=${encodeURIComponent(document.location.pathname)}`}
                  >
                    Log in to access project
                  </a>
                </div>
              </div>
            )}

            {v1ImportData.status === 'canDownloadZip' && (
              <div>
                <p className="text-center row-spaced-small">
                  <strong>{v1ImportData.name || 'This project'}</strong> has not
                  yet been moved into the new version of Overleaf. This project
                  was created anonymously and therefore cannot be automatically
                  imported. Please download a zip file of the project and upload
                  that to continue editing it. If you would like to delete this
                  project after you have made a copy, please contact support.
                </p>

                <div className="row-spaced text-center">
                  <a
                    className="btn btn-primary"
                    href={`/overleaf/project/${v1ImportData.projectId}/download/zip`}
                  >
                    Download project zip file
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
