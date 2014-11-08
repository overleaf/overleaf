package uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetDocResult extends Result {

    private int versionID;

    private InvalidProjectException invalidProjectException;

    public SnapshotGetDocResult(Request request, JsonElement json) throws FailedConnectionException {
        super(request, json);
    }

    @Override
    public void fromJSON(JsonElement json) {
        JsonObject jsonObject = json.getAsJsonObject();
        if (jsonObject.has("status") && jsonObject.get("status").getAsInt() == 404) {
            invalidProjectException = new InvalidProjectException();
        } else {
            versionID = json.getAsJsonObject().get("latestVerId").getAsInt();
        }
    }

    public int getVersionID() throws InvalidProjectException {
        if (invalidProjectException != null) {
            throw invalidProjectException;
        }
        return versionID;
    }

}
