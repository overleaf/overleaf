package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.writelatex.api.SnapshotDBAPI;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.db.WLFileStore;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 06/11/14.
 */
public class WLDataModel implements SnapshotDBAPI {

    private final Map<String, WLProject> projects;
    private final WLFileStore fileStore;

    public WLDataModel(String rootGitDirectoryPath) {
        projects = new HashMap<String, WLProject>();
        fileStore = new WLFileStore(rootGitDirectoryPath);
    }

    @Override
    public boolean repositoryExists(String name) throws FailedConnectionException {
        SnapshotGetDocRequest snapshotGetDocRequest = new SnapshotGetDocRequest(name);
        snapshotGetDocRequest.request();
        try {
            snapshotGetDocRequest.getResult().getVersionID();
        } catch (InvalidProjectException e) {
            return false;
        }
        return true;
    }

    @Override
    public List<Snapshot> getSnapshotsToAddToProject(String name) throws FailedConnectionException, InvalidProjectException {
        return updateProjectWithName(name);
    }

    private List<Snapshot> updateProjectWithName(String name) throws FailedConnectionException, InvalidProjectException {
        WLProject project;
        if (projects.containsKey(name)) {
            project = projects.get(name);
        } else {
            project = new WLProject(name);
            projects.put(name, project);
        }
        List<Snapshot> newSnapshots = project.fetchNewSnapshots();
        fileStore.updateForProject(project);
        return newSnapshots;
    }

}
