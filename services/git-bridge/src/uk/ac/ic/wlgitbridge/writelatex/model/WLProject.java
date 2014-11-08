package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.writelatex.SnapshotFetcher;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 06/11/14.
 */
public class WLProject {

    private final String name;
    private final Map<Integer, Snapshot> snapshots;
    private final SnapshotFetcher snapshotFetcher;

    public WLProject(String name) {
        this.name = name;
        snapshots = new HashMap<Integer, Snapshot>();
        snapshotFetcher = new SnapshotFetcher(name, snapshots);
    }

    public List<Snapshot> fetchNewSnapshots() throws FailedConnectionException, InvalidProjectException {
        return snapshotFetcher.fetchNewSnapshots();
    }

}
