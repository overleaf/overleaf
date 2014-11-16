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

    private int latestSnapshotID;

    public WLProject(String name) {
        this.name = name;
        snapshots = new HashMap<Integer, Snapshot>();
        snapshotFetcher = new SnapshotFetcher(name, snapshots);
    }

    public SortedSet<Snapshot> fetchNewSnapshots() throws FailedConnectionException, InvalidProjectException {
        SortedSet<Snapshot> newSnapshots = snapshotFetcher.fetchNewSnapshots();
        latestSnapshotID = snapshotFetcher.getLatestSnapshot().getVersionID();
        return newSnapshots;
    }

    public String getName() {
        return name;
    }

    public int getLatestSnapshotID() {
        return latestSnapshotID;
    }

    public void putLatestSnapshot(int versionID) {
        snapshots.put(versionID, null);
        snapshotFetcher.putLatestVersion(versionID);
        latestSnapshotID = versionID;
    }

}
