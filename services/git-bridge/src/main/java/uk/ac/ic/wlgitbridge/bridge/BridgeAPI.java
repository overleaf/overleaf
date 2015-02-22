package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.data.ProjectLock;
import uk.ac.ic.wlgitbridge.data.ShutdownHook;
import uk.ac.ic.wlgitbridge.data.model.DataStore;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.snapshot.push.PostbackManager;
import uk.ac.ic.wlgitbridge.snapshot.push.SnapshotPushRequest;
import uk.ac.ic.wlgitbridge.snapshot.push.SnapshotPushRequestResult;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.*;
import uk.ac.ic.wlgitbridge.util.Util;

import java.io.IOException;

/**
 * Created by Winston on 16/11/14.
 */
public class BridgeAPI {

    private final DataStore dataModel;
    private final PostbackManager postbackManager;
    private final ProjectLock mainProjectLock;

    public BridgeAPI(DataStore dataModel) {
        this.dataModel = dataModel;
        postbackManager = new PostbackManager();
        mainProjectLock = new ProjectLock();
        Runtime.getRuntime().addShutdownHook(new ShutdownHook(mainProjectLock));
    }

    public void lockForProject(String projectName) {
        mainProjectLock.lockForProject(projectName);
    }

    public void unlockForProject(String projectName) {
        mainProjectLock.unlockForProject(projectName);
    }

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

    public void getWritableRepositories(String projectName, Repository repository) throws IOException, SnapshotPostException, GitAPIException {
        Util.sout("Fetching project: " + projectName);
        dataModel.updateProjectWithName(projectName, repository);
    }

    public void putDirectoryContentsToProjectWithName(String projectName, RawDirectory directoryContents, RawDirectory oldDirectoryContents, String hostname) throws SnapshotPostException, IOException {
        mainProjectLock.lockForProject(projectName);
        CandidateSnapshot candidate = null;
        try {
            Util.sout("Pushing project: " + projectName);
            String postbackKey = postbackManager.makeKeyForProject(projectName);
            candidate = dataModel.createCandidateSnapshotFromProjectWithContents(projectName, directoryContents, oldDirectoryContents);
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
            if (candidate != null) {
                candidate.deleteServletFiles();
            }
            mainProjectLock.unlockForProject(projectName);
        }
    }

    public void checkPostbackKey(String projectName, String postbackKey) throws InvalidPostbackKeyException {
        postbackManager.checkPostbackKey(projectName, postbackKey);
    }

    /* Called by postback thread. */
    public void postbackReceivedSuccessfully(String projectName, String postbackKey, int versionID) throws UnexpectedPostbackException {
        postbackManager.postVersionIDForProject(projectName, versionID, postbackKey);
    }

    public void postbackReceivedWithException(String projectName, String postbackKey, SnapshotPostException exception) throws UnexpectedPostbackException {
        postbackManager.postExceptionForProject(projectName, exception, postbackKey);
    }

}
