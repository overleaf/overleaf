package uk.ac.ic.wlgitbridge.bridge;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.data.ProjectLock;
import uk.ac.ic.wlgitbridge.data.ShutdownHook;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.data.model.DataStore;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocRequest;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.snapshot.push.PostbackManager;
import uk.ac.ic.wlgitbridge.snapshot.push.PushRequest;
import uk.ac.ic.wlgitbridge.snapshot.push.PushResult;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.*;
import uk.ac.ic.wlgitbridge.util.Log;

import java.io.IOException;

/**
 * Created by Winston on 16/11/14.
 */
public class BridgeAPI {

    private final DataStore dataStore;
    private final PostbackManager postbackManager;
    private final ProjectLock mainProjectLock;

    public BridgeAPI(String rootGitDirectoryPath) {
        dataStore = new DataStore(rootGitDirectoryPath);
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

    public boolean repositoryExists(Credential oauth2, String projectName)
            throws ServiceMayNotContinueException, ForbiddenException {
        lockForProject(projectName);
        GetDocRequest getDocRequest = new GetDocRequest(oauth2, projectName);
        getDocRequest.request();
        try {
            getDocRequest.getResult().getVersionID();
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

    public void getWritableRepositories(Credential oauth2,
                                        String projectName,
                                        Repository repository)
            throws IOException,
                   SnapshotPostException,
                   GitAPIException,
                   ForbiddenException {
        Log.info("[{}] Fetching", projectName);
        dataStore.updateProjectWithName(oauth2, projectName, repository);
    }

    public void
    putDirectoryContentsToProjectWithName(Credential oauth2,
                                          String projectName,
                                          RawDirectory directoryContents,
                                          RawDirectory oldDirectoryContents,
                                          String hostname)
            throws SnapshotPostException, IOException, ForbiddenException {
        mainProjectLock.lockForProject(projectName);
        CandidateSnapshot candidate = null;
        try {
            Log.info("[{}] Pushing", projectName);
            String postbackKey = postbackManager.makeKeyForProject(projectName);
            Log.info(
                    "[{}] Created postback key: {}",
                    projectName,
                    postbackKey
            );
            candidate =
                    dataStore.createCandidateSnapshot(
                            projectName,
                            directoryContents,
                            oldDirectoryContents
                    );
            Log.info(
                    "[{}] Candindate snapshot created: {}",
                    projectName,
                    candidate
            );
            PushRequest pushRequest = new PushRequest(
                    oauth2,
                    candidate,
                    postbackKey
            );
            pushRequest.request();
            PushResult result = pushRequest.getResult();
            if (result.wasSuccessful()) {
                Log.info(
                        "[{}] Push to Overleaf successful",
                        projectName
                );
                Log.info("[{}] Waiting for postback...", projectName);
                int versionID =
                        postbackManager.waitForVersionIdOrThrow(projectName);
                Log.info(
                        "[{}] Got version ID for push: {}",
                        projectName,
                        versionID
                );
                dataStore.approveSnapshot(versionID, candidate);
                Log.info(
                        "[{}] Approved version ID: {}",
                        projectName,
                        versionID
                );
            } else {
                Log.warn(
                        "[{}] Went out of date while waiting for push",
                        projectName
                );
                throw new OutOfDateException();
            }
        } catch (SevereSnapshotPostException e) {
            Log.warn("[" + projectName + "] Failed to put to Overleaf", e);
            throw e;
        } catch (SnapshotPostException e) {
            /* Stack trace should be printed further up */
            Log.warn(
                    "[{}] Exception when waiting for postback: {}",
                    projectName,
                    e.getClass().getSimpleName()
            );
            throw e;
        } catch (IOException e) {
            Log.warn("[{}] IOException on put", projectName);
            throw e;
        } finally {
            if (candidate != null) {
                candidate.deleteServletFiles();
            } else {
                Log.error(
                        "[{}] Candidate snapshot was null: " +
                                "this should never happen.",
                        projectName
                );
            }
            mainProjectLock.unlockForProject(projectName);
        }
    }

    public void checkPostbackKey(String projectName, String postbackKey)
            throws InvalidPostbackKeyException {
        postbackManager.checkPostbackKey(projectName, postbackKey);
    }

    /* Called by postback thread. */
    public void postbackReceivedSuccessfully(String projectName,
                                             String postbackKey,
                                             int versionID)
            throws UnexpectedPostbackException {
        Log.info(
                "[{}]" +
                        " Postback received by postback thread, version: {}",
                projectName,
                versionID);
        postbackManager.postVersionIDForProject(
                projectName,
                versionID,
                postbackKey
        );
    }

    public void postbackReceivedWithException(String projectName,
                                              String postbackKey,
                                              SnapshotPostException exception)
            throws UnexpectedPostbackException {
        Log.warn("[{}] Postback received with exception", projectName);
        postbackManager.postExceptionForProject(
                projectName,
                exception,
                postbackKey
        );
    }

}
