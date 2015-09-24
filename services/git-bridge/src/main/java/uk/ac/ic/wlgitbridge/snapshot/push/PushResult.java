package uk.ac.ic.wlgitbridge.snapshot.push;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.snapshot.base.Result;
import uk.ac.ic.wlgitbridge.snapshot.base.Request;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Util;

/**
 * Created by Winston on 16/11/14.
 */
public class PushResult extends Result {

    private boolean success;

    public PushResult(Request request, JsonElement json) throws FailedConnectionException {
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
        String code;
        try {
            JsonObject responseObject = json.getAsJsonObject();
            code = responseObject.get("code").getAsString();
        } catch (Exception e) {
            Util.serr("Unexpected response from API:");
            Util.serr(json.toString());
            Util.serr("End of response");
            throw e;
        }
        if (code.equals("accepted")) {
            success = true;
        } else if (code.equals("outOfDate")) {
            success = false;
        } else {
            throw new RuntimeException();
        }
    }
}
