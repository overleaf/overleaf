package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.writelatex.SnapshotFetcher;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionResult;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotGetSavedVersRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotInfo;

import java.util.*;

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

    public List<Snapshot> fetchNewSnapshots() throws Throwable {
        return snapshotFetcher.fetchNewSnapshots();
    }

}
