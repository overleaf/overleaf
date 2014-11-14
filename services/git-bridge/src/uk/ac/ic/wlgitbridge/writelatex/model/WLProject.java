package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.writelatex.SnapshotFetcher;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;

import java.util.HashMap;
import java.util.Map;
import java.util.SortedSet;

/**
 * Created by Winston on 06/11/14.
 */
public class WLProject {

    private final String name;
    private final Map<Integer, Snapshot> snapshots;
    private final SnapshotFetcher snapshotFetcher;

    private Snapshot latestSnapshot;

    public WLProject(String name) {
        this.name = name;
        snapshots = new HashMap<Integer, Snapshot>();
        snapshotFetcher = new SnapshotFetcher(name, snapshots);
    }

    public SortedSet<Snapshot> fetchNewSnapshots() throws FailedConnectionException, InvalidProjectException {
        SortedSet<Snapshot> newSnapshots = snapshotFetcher.fetchNewSnapshots();
        latestSnapshot = snapshotFetcher.getLatestSnapshot();
        return newSnapshots;
    }

    public String getName() {
        return name;
    }

    public Snapshot getLatestSnapshot() {
        return latestSnapshot;
    }

}
