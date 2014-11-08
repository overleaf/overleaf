package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetForVersionResult extends Result {

    private SnapshotData snapshotData;

    public SnapshotGetForVersionResult(Request request, JsonElement json) throws FailedConnectionException {
        super(request, json);
    }

    @Override
    public void fromJSON(JsonElement json) throws FailedConnectionException {
        snapshotData = new SnapshotData(json);
    }

    public SnapshotData getSnapshotData() {
        return snapshotData;
    }

}
