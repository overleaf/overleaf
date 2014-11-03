package uk.ac.ic.wlgitbridge.writelatex;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface SnapshotAPI {

    public List<Snapshot> getSnapshots();
    public void putSnapshots(List<Snapshot> snapshots);

}
