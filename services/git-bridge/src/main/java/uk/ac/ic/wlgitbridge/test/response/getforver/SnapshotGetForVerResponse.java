package uk.ac.ic.wlgitbridge.test.response.getforver;

import uk.ac.ic.wlgitbridge.test.response.SnapshotResponse;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionResult;

/**
 * Created by Winston on 09/01/15.
 */
public class SnapshotGetForVerResponse extends SnapshotResponse {

    private final SnapshotGetForVersionResult state;

    public SnapshotGetForVerResponse(SnapshotGetForVersionResult state) {
        this.state = state;
    }

    @Override
    public String respond() {
        return state.toJson().toString();
    }

}
