package uk.ac.ic.wlgitbridge.bridge;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.UnexpectedPostbackException;

import java.io.IOException;
import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface WriteLatexDataSource {

    void lockForProject(String projectName);

    void unlockForProject(String projectName);

    /* Called by request thread. */
    public boolean repositoryExists(String projectName) throws FailedConnectionException;
    public List<WritableRepositoryContents> getWritableRepositories(String projectName) throws FailedConnectionException, InvalidProjectException;
    public void putDirectoryContentsToProjectWithName(String projectName, RawDirectoryContents directoryContents, String hostname) throws SnapshotPostException, IOException, FailedConnectionException;

    /* Called by postback thread. */
    public void postbackReceivedSuccessfully(String projectName, int versionID) throws UnexpectedPostbackException;
    public void postbackReceivedWithException(String projectName, SnapshotPostException exception) throws UnexpectedPostbackException;

}
