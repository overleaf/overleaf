package uk.ac.ic.wlgitbridge.writelatex;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.bridge.RawDirectory;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.PostbackManager;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.SnapshotPushRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.SnapshotPushRequestResult;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.*;
import uk.ac.ic.wlgitbridge.writelatex.model.DataStore;

import java.io.IOException;
import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class WriteLatexAPI implements WriteLatexDataSource {

    private final DataStore dataModel;
    private final PostbackManager postbackManager;
    private final ProjectLock mainProjectLock;

    public WriteLatexAPI(DataStore dataModel) {
        this.dataModel = dataModel;
        postbackManager = new PostbackManager();
        mainProjectLock = new ProjectLock();
        Runtime.getRuntime().addShutdownHook(new ShutdownHook(mainProjectLock));
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
    public boolean repositoryExists(String projectName) throws ServiceMayNotContinueException {
        lockForProject(projectName);
        SnapshotGetDocRequest snapshotGetDocRequest = new SnapshotGetDocRequest(projectName);
        snapshotGetDocRequest.request();
        try {
            snapshotGetDocRequest.getResult().getVersionID();
        } catch (InvalidProjectException e) {
            return false;
        } catch (FailedConnectionException e) {
            throw e;
        } catch (SnapshotPostException e) {
            throw new ServiceMayNotContinueException(e.getMessage());
        } finally {
            unlockForProject(projectName);
        }
        return true;
    }

    @Override
    public List<WritableRepositoryContents> getWritableRepositories(String projectName, Repository repository) throws IOException, SnapshotPostException {
        Util.sout("Fetching project: " + projectName);
        List<WritableRepositoryContents> writableRepositoryContents = dataModel.updateProjectWithName(projectName, repository);
        return writableRepositoryContents;
    }

    @Override
    public void putDirectoryContentsToProjectWithName(String projectName, RawDirectory directoryContents, RawDirectory oldDirectoryContents, String hostname) throws SnapshotPostException, IOException {
        mainProjectLock.lockForProject(projectName);
        try {
            Util.sout("Pushing project: " + projectName);
            String postbackKey = postbackManager.makeKeyForProject(projectName);
            CandidateSnapshot candidate = dataModel.createCandidateSnapshotFromProjectWithContents(projectName, directoryContents, oldDirectoryContents);
            SnapshotPushRequest snapshotPushRequest = new SnapshotPushRequest(candidate, postbackKey);
            snapshotPushRequest.request();
            SnapshotPushRequestResult result = snapshotPushRequest.getResult();
            if (result.wasSuccessful()) {
                dataModel.approveSnapshot(postbackManager.getVersionID(projectName), candidate);
            } else {
                throw new OutOfDateException();
            }
        } catch (SevereSnapshotPostException e) {
            e.printStackTrace();
            throw e;
        } catch (SnapshotPostException e) {
            throw e;
        } catch (IOException e) {
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
