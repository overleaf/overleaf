package uk.ac.ic.wlgitbridge.writelatex.api;

import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.writelatex.Snapshot;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 03/11/14.
 */
public class DummySnapshotDBAPI implements SnapshotDBAPI {

    private Map<String, Map<String, Integer>> projects;

    public DummySnapshotDBAPI() {
        projects = new HashMap<String, Map<String, Integer>>();

    }

    private void initTestData() {

    }

    @Override
    public boolean repositoryExists(String name) {
        return projects.containsKey(name);
    }

    @Override
    public List<Snapshot> getSnapshotsToAddToRepository(Repository repository) {
        return new LinkedList<Snapshot>();
    }

}
