package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.writelatex.SnapshotFetcher;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreAPI;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreSource;

import java.util.HashMap;
import java.util.Map;
import java.util.SortedSet;

/**
 * Created by Winston on 06/11/14.
 */
public class WLProject implements PersistentStoreSource {

    public static final int INVALID_VERSION_ID = -1;
    private final String name;
    private final Map<Integer, Snapshot> snapshots;
    private final SnapshotFetcher snapshotFetcher;

    private int latestSnapshotID;
    private PersistentStoreAPI persistentStore;

    public WLProject(String name) {
        this.name = name;
        snapshots = new HashMap<Integer, Snapshot>();
        snapshotFetcher = new SnapshotFetcher(name, snapshots);
    }

    public WLProject(String projectName, PersistentStoreAPI database) {
        this(projectName);
        initFromPersistentStore(database);
    }

    public SortedSet<Snapshot> fetchNewSnapshots() throws FailedConnectionException, InvalidProjectException {
        SortedSet<Snapshot> newSnapshots = snapshotFetcher.fetchNewSnapshots();
        updateLatestSnapshot();
        return newSnapshots;
    }

    public String getName() {
        return name;
    }

    public int getLatestSnapshotID() {
        return latestSnapshotID;
    }

    private void updateLatestSnapshot() {
        Snapshot latest = snapshotFetcher.getLatestSnapshot();
        if (latest == null) {
            latestSnapshotID = INVALID_VERSION_ID;
        } else {
            latestSnapshotID = latest.getVersionID();
        }
    }

    public void putLatestSnapshot(int versionID) {
        snapshots.put(versionID, new Snapshot(versionID));
        snapshotFetcher.putLatestVersion(versionID);
        latestSnapshotID = versionID;
//        persistentStore.addSnapshot(name, versionID);
    }

    @Override
    public void initFromPersistentStore(PersistentStoreAPI persistentStore) {
        this.persistentStore = persistentStore;
        snapshotFetcher.initFromPersistentStore(persistentStore);
        updateLatestSnapshot();
    }

}
