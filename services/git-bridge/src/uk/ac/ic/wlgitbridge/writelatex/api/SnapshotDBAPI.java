package uk.ac.ic.wlgitbridge.writelatex.api;

import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.writelatex.Snapshot;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface SnapshotDBAPI {

    public boolean repositoryExists(Repository repository);
    public List<Snapshot> getSnapshotsToAddToRepository(Repository repository);

}
