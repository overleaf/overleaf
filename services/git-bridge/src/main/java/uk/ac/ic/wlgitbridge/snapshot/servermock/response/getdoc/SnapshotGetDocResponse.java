package uk.ac.ic.wlgitbridge.snapshot.servermock.response.getdoc;

import uk.ac.ic.wlgitbridge.snapshot.servermock.response.SnapshotResponse;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.SnapshotGetDocResult;

/**
 * Created by Winston on 09/01/15.
 */
public class SnapshotGetDocResponse extends SnapshotResponse {

    private final SnapshotGetDocResult state;

    public SnapshotGetDocResponse(SnapshotGetDocResult state) {
        this.state = state;
    }

    @Override
    public String respond() {
        return state.toJson().toString();
    }

}
