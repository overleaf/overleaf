package uk.ac.ic.wlgitbridge.writelatex.api;

import uk.ac.ic.wlgitbridge.writelatex.Snapshot;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public interface SnapshotAPI {

    public List<Snapshot> getSnapshots();
    public void putSnapshots(List<Snapshot> snapshots);

}
