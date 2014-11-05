package uk.ac.ic.wlgitbridge.writelatex.api;

import uk.ac.ic.wlgitbridge.writelatex.Snapshot;

import java.util.List;

/**
 * Created by Winston on 03/11/14.
 */
public class DummySnapshotAPI implements SnapshotAPI {

    @Override
    public List<Snapshot> getSnapshots() {
        return null;
    }

    @Override
    public void putSnapshots(List<Snapshot> snapshots) {

    }

}
