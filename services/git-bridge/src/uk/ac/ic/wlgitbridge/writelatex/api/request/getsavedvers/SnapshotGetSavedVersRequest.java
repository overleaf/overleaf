package uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetSavedVersRequest extends SnapshotAPIRequest<SnapshotGetSavedVersResult> {

    public static final String API_CALL = "/saved_vers";

    public SnapshotGetSavedVersRequest(String projectName) {
        super(projectName, API_CALL);
    }

    @Override
    protected SnapshotGetSavedVersResult parseResponse(JsonElement json) throws FailedConnectionException {
        return new SnapshotGetSavedVersResult(this, json);
    }

}
