package uk.ac.ic.wlgitbridge.writelatex.api;

import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.writelatex.Snapshot;

import java.util.LinkedList;
import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public class DummySnapshotDBAPI implements SnapshotDBAPI {

    @Override
    public boolean repositoryExists(Repository repository) {
        return false;
    }

    @Override
    public List<Snapshot> getSnapshotsToAddToRepository(Repository repository) {
        return new LinkedList<Snapshot>();
    }

}
