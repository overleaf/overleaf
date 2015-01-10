package uk.ac.ic.wlgitbridge.test.response.getsavedver;

import uk.ac.ic.wlgitbridge.test.response.SnapshotResponse;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotGetSavedVersResult;

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
