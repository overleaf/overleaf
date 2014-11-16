package uk.ac.ic.wlgitbridge.bridge;

import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.model.SnapshotPostException;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface WriteLatexDataSource {

    public boolean repositoryExists(String name) throws FailedConnectionException;
    public List<WritableRepositoryContents> getWritableRepositories(String name) throws FailedConnectionException, InvalidProjectException;
    public void putDirectoryContentsToProjectWithName(String name, RawDirectoryContents directoryContents) throws SnapshotPostException;

}
