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
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.SnapshotPushRequestResult;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.UnexpectedPostbackException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.OutOfDateException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.writelatex.model.WLDataModel;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Created by Winston on 16/11/14.
 */
public class WriteLatexAPI implements WriteLatexDataSource {

    private final WLDataModel dataModel;
    private final PostbackManager postbackManager;
    private final Map<String, Lock> projectLocks;
    private final Lock projectLocksLock;

    public WriteLatexAPI(WLDataModel dataModel) {
        this.dataModel = dataModel;
        postbackManager = new PostbackManager();
        projectLocks = new HashMap<String, Lock>();
        projectLocksLock = new ReentrantLock();
    }

    private Lock getLockForProjectName(String projectName) {
        projectLocksLock.lock();
        Lock lock = projectLocks.get(projectName);
        if (lock == null) {
            lock = new ReentrantLock();
            projectLocks.put(projectName, lock);
        }
        projectLocksLock.unlock();
        return lock;
    }

    @Override
    public void lockForProject(String projectName) {
        getLockForProjectName(projectName).lock();
    }

    @Override
    public void unlockForProject(String projectName) {
        getLockForProjectName(projectName).unlock();
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
        lockForProject(projectName);
        System.out.println("Pushing project: " + projectName);
        CandidateSnapshot candidate = dataModel.createCandidateSnapshotFromProjectWithContents(projectName, directoryContents, hostname);
        SnapshotPushRequest snapshotPushRequest = new SnapshotPushRequest(candidate);
        snapshotPushRequest.request();
        SnapshotPushRequestResult result = snapshotPushRequest.getResult();
        if (result.wasSuccessful()) {
            candidate.approveWithVersionID(postbackManager.getVersionID(projectName));
            unlockForProject(projectName);
        } else {
            unlockForProject(projectName);
            throw new OutOfDateException();
        }
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
