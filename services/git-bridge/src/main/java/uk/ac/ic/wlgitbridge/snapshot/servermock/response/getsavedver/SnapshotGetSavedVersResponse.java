package uk.ac.ic.wlgitbridge.snapshot.servermock.response.getsavedver;

import uk.ac.ic.wlgitbridge.snapshot.servermock.response.SnapshotResponse;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.SnapshotGetSavedVersResult;

/**
 * Created by Winston on 09/01/15.
 */
public class SnapshotGetSavedVersResponse extends SnapshotResponse {

    private final SnapshotGetSavedVersResult state;

    public SnapshotGetSavedVersResponse(SnapshotGetSavedVersResult state) {
        this.state = state;
    }

    @Override
    public String respond() {
        return state.toJson().toString();
    }

}
