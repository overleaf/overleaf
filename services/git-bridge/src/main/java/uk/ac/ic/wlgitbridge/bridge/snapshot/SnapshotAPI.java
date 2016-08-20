package uk.ac.ic.wlgitbridge.bridge.snapshot;

import com.google.api.client.auth.oauth2.Credential;
import uk.ac.ic.wlgitbridge.data.model.Snapshot;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;

import java.util.Deque;

/**
 * Created by winston on 20/08/2016.
 */
public interface SnapshotAPI {

    Deque<Snapshot> getSnapshotsForProjectAfterVersion(
            Credential oauth2,
            String projectName,
            int latestVersion
    ) throws FailedConnectionException, GitUserException;

}
