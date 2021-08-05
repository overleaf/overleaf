package uk.ac.ic.wlgitbridge.snapshot.servermock.response.getforver;

import uk.ac.ic.wlgitbridge.snapshot.servermock.response.SnapshotResponse;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.GetForVersionResult;

/**
 * Created by Winston on 09/01/15.
 */
public class SnapshotGetForVerResponse extends SnapshotResponse {

    private final GetForVersionResult state;

    public SnapshotGetForVerResponse(GetForVersionResult state) {
        this.state = state;
    }

    @Override
    public String respond() {
        return state.toJson().toString();
    }

}
