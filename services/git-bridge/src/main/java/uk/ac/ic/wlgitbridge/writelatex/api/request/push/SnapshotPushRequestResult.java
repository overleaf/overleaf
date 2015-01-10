package uk.ac.ic.wlgitbridge.writelatex.api.request.push;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

/**
 * Created by Winston on 16/11/14.
 */
public class SnapshotPushRequestResult extends Result {

    private boolean success;

    public SnapshotPushRequestResult(Request request, JsonElement json) throws FailedConnectionException {
        super(request, json);
    }

    @Override
    public JsonElement toJson() {
        return null;
    }

    public boolean wasSuccessful() {
        return success;
    }

    @Override
    public void fromJSON(JsonElement json) {
        JsonObject responseObject = json.getAsJsonObject();
        String code = responseObject.get("code").getAsString();
        if (code.equals("accepted")) {
            success = true;
        } else if (code.equals("outOfDate")) {
            success = false;
        } else {
            throw new RuntimeException();
        }
    }

}
