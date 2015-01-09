package uk.ac.ic.wlgitbridge.writelatex;

import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.InvalidPostbackKeyException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.PostbackManager;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.SnapshotPushRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.SnapshotPushRequestResult;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.UnexpectedPostbackException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.OutOfDateException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.writelatex.model.WLDataModel;

import java.io.IOException;
import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class WriteLatexAPI implements WriteLatexDataSource {

    private final WLDataModel dataModel;
    private final PostbackManager postbackManager;
    private final ProjectLock mainProjectLock;

    public WriteLatexAPI(WLDataModel dataModel) {
        this.dataModel = dataModel;
        postbackManager = new PostbackManager();
        mainProjectLock = new ProjectLock();
    }

    @Override
    public void lockForProject(String projectName) {
        mainProjectLock.lockForProject(projectName);
    }

    @Override
    public void unlockForProject(String projectName) {
        mainProjectLock.unlockForProject(projectName);
    }

    @Override
    public boolean repositoryExists(String projectName) throws FailedConnectionException {
        lockForProject(projectName);
        SnapshotGetDocRequest snapshotGetDocRequest = new SnapshotGetDocRequest(projectName);
        snapshotGetDocRequest.request();
        try {
            snapshotGetDocRequest.getResult().getVersionID();
        } catch (InvalidProjectException e) {
            return false;
        } catch (FailedConnectionException e) {
            throw e;
        } finally {
            unlockForProject(projectName);
        }
        return true;
    }

    @Override
    public List<WritableRepositoryContents> getWritableRepositories(String projectName) throws FailedConnectionException, InvalidProjectException {
        System.out.println("Fetching project: " + projectName);
        List<WritableRepositoryContents> writableRepositoryContents = dataModel.updateProjectWithName(projectName);
        return writableRepositoryContents;
    }

    @Override
    public void putDirectoryContentsToProjectWithName(String projectName, RawDirectoryContents directoryContents, String hostname) throws SnapshotPostException, IOException, FailedConnectionException {
        mainProjectLock.lockForProject(projectName);
        try {
            System.out.println("Pushing project: " + projectName);
            String postbackKey = postbackManager.makeKeyForProject(projectName);
            CandidateSnapshot candidate = dataModel.createCandidateSnapshotFromProjectWithContents(projectName, directoryContents, hostname, postbackKey);
            SnapshotPushRequest snapshotPushRequest = new SnapshotPushRequest(candidate);
            snapshotPushRequest.request();
            SnapshotPushRequestResult result = snapshotPushRequest.getResult();
            if (result.wasSuccessful()) {
                candidate.approveWithVersionID(postbackManager.getVersionID(projectName));
            } else {
                throw new OutOfDateException();
            }
        } catch (SnapshotPostException e) {
            throw e;
        } catch (IOException e) {
            throw e;
        } catch (FailedConnectionException e) {
            throw e;
        } finally {
            mainProjectLock.unlockForProject(projectName);
        }
    }

    @Override
    public void checkPostbackKey(String projectName, String postbackKey) throws InvalidPostbackKeyException {
        postbackManager.checkPostbackKey(projectName, postbackKey);
    }

    /* Called by postback thread. */
    @Override
    public void postbackReceivedSuccessfully(String projectName, String postbackKey, int versionID) throws UnexpectedPostbackException {
        postbackManager.postVersionIDForProject(projectName, versionID, postbackKey);
    }

    @Override
    public void postbackReceivedWithException(String projectName, String postbackKey, SnapshotPostException exception) throws UnexpectedPostbackException {
        postbackManager.postExceptionForProject(projectName, exception, postbackKey);
    }

}
