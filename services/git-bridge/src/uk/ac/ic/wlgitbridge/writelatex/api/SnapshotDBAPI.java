package uk.ac.ic.wlgitbridge.writelatex.api;

import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface SnapshotDBAPI {

    public boolean repositoryExists(String name) throws FailedConnectionException;
    public List<WritableRepositoryContents> getWritableRepositories(String name) throws FailedConnectionException, InvalidProjectException;

}
