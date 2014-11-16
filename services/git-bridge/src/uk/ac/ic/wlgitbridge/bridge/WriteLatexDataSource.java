package uk.ac.ic.wlgitbridge.bridge;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.SnapshotPostException;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface WriteLatexDataSource {

    /* Called by request thread. */
    public boolean repositoryExists(String projectName) throws FailedConnectionException;
    public List<WritableRepositoryContents> getWritableRepositories(String projectName) throws FailedConnectionException, InvalidProjectException;
    public void putDirectoryContentsToProjectWithName(String projectName, RawDirectoryContents directoryContents) throws SnapshotPostException;
    public void expectPostback(String projectName);

    /* Called by postback thread. */
    public void postbackReceived(String projectName);

}
