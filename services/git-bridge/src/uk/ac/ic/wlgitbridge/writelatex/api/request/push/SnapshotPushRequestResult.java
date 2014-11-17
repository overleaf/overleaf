package uk.ac.ic.wlgitbridge.writelatex.api.request.push;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

/**
 * Created by Winston on 16/11/14.
 */
public class SnapshotPushRequestResult extends Result {

    public SnapshotPushRequestResult(Request request, JsonElement json) throws FailedConnectionException {
        super(request, json);
    }

    @Override
    public void fromJSON(JsonElement json) {

    }

}
