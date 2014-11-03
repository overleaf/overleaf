package uk.ac.ic.wlgitbridge.writelatex;

import org.eclipse.jgit.lib.Repository;

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
