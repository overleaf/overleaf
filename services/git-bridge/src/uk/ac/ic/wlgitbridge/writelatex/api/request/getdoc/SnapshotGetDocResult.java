package uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetDocResult extends Result {

    private int versionID;

    public SnapshotGetDocResult(Request request, JsonElement json) {
        super(request, json);
    }

    @Override
    public void fromJSON(JsonElement json) {
        versionID = json.getAsJsonObject().get("latestVerId").getAsInt();
    }

    public int getVersionID() {
        return versionID;
    }

}
