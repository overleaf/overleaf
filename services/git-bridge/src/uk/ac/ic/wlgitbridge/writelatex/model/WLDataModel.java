package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshotCallback;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.writelatex.WLDirectoryNodeSnapshot;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;
import uk.ac.ic.wlgitbridge.writelatex.model.db.Database;
import uk.ac.ic.wlgitbridge.writelatex.model.db.WLDatabase;

import java.io.File;
import java.io.IOException;
import java.util.List;

/**
 * Created by Winston on 06/11/14.
 */
public class WLDataModel implements CandidateSnapshotCallback {

    private final WLDatabase db;
    private final WLProjectStore projectStore;
    private final WLFileStore fileStore;

    public WLDataModel(String rootGitDirectoryPath) {
        File rootGitDirectory = initRootGitDirectory(rootGitDirectoryPath);
        db = new Database(rootGitDirectory);
        projectStore = db.loadProjectStore();
        fileStore = db.loadFileStore();
    }

    public List<WritableRepositoryContents> updateProjectWithName(String name) throws FailedConnectionException, InvalidProjectException {
        return fileStore.updateForProject(getProjectWithName(name));
    }

    public WLProject getProjectWithName(String name) {
        return projectStore.getProjectWithName(name);
    }

    public CandidateSnapshot createCandidateSnapshotFromProjectWithContents(String projectName, RawDirectoryContents directoryContents, String hostname) throws SnapshotPostException, IOException, FailedConnectionException {
        return new WLDirectoryNodeSnapshot(getProjectWithName(projectName),
                                           fileStore.createNextDirectoryNodeInProjectFromContents(getProjectWithName(projectName),
                                                                                                  directoryContents),
                                           hostname,
                                           this);
    }

    @Override
    public void approveSnapshot(int versionID, CandidateSnapshot candidateSnapshot) {
        getProjectWithName(candidateSnapshot.getProjectName()).putLatestSnapshot(versionID);
        fileStore.approveCandidateSnapshot(candidateSnapshot);
    }

    private File initRootGitDirectory(String rootGitDirectoryPath) {
        File rootGitDirectory = new File(rootGitDirectoryPath);
        rootGitDirectory.mkdirs();
        return rootGitDirectory;
    }

}
