package uk.ac.ic.wlgitbridge.writelatex;

import org.eclipse.jgit.lib.Repository;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface SnapshotDBAPI {

    public boolean repositoryExists(Repository repository);
    public List<Snapshot> getSnapshotsToAddToRepository(Repository repository);

}
