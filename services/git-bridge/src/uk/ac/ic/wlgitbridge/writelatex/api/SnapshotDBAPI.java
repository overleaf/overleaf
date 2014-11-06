package uk.ac.ic.wlgitbridge.writelatex.api;

import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface SnapshotDBAPI {

    public boolean repositoryExists(String name);
    public List<Snapshot> getSnapshotsToAddToRepository(Repository repository);

}
