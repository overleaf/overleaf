package uk.ac.ic.wlgitbridge.writelatex;

import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.PostbackManager;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.SnapshotPushRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.UnexpectedPostbackException;
import uk.ac.ic.wlgitbridge.writelatex.model.WLDataModel;

import java.io.IOException;
import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class WriteLatexAPI implements WriteLatexDataSource {

    private final WLDataModel dataModel;
    private final PostbackManager postbackManager;

    public WriteLatexAPI(WLDataModel dataModel) {
        this.dataModel = dataModel;
        postbackManager = new PostbackManager();
    }

    @Override
    public boolean repositoryExists(String projectName) throws FailedConnectionException {
        SnapshotGetDocRequest snapshotGetDocRequest = new SnapshotGetDocRequest(projectName);
        snapshotGetDocRequest.request();
        try {
            snapshotGetDocRequest.getResult().getVersionID();
        } catch (InvalidProjectException e) {
            return false;
        }
        return true;
    }

    @Override
    public List<WritableRepositoryContents> getWritableRepositories(String projectName) throws FailedConnectionException, InvalidProjectException {
        return dataModel.updateProjectWithName(projectName);
    }

    @Override
    public void putDirectoryContentsToProjectWithName(String projectName, RawDirectoryContents directoryContents, String hostname) throws SnapshotPostException, IOException, FailedConnectionException {
        CandidateSnapshot candidate = dataModel.createCandidateSnapshotFromProjectWithContents(projectName, directoryContents, hostname);
        new SnapshotPushRequest(candidate).request();
        candidate.approveWithVersionID(postbackManager.getVersionID(projectName));
    }

    /* Called by postback thread. */
    @Override
    public void postbackReceivedSuccessfully(String projectName, int versionID) throws UnexpectedPostbackException {
        postbackManager.postVersionIDForProject(projectName, versionID);
    }

    @Override
    public void postbackReceivedWithException(String projectName, SnapshotPostException exception) throws UnexpectedPostbackException {
        postbackManager.postExceptionForProject(projectName, exception);
    }

}
