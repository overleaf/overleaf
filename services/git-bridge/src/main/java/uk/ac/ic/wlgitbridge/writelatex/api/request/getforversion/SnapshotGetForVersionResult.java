package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetForVersionResult extends Result {

    private SnapshotData snapshotData;

    public SnapshotGetForVersionResult(Request request, JsonElement json) {
        super(request, json);
    }

    public SnapshotGetForVersionResult(SnapshotData snapshotData) {
        this.snapshotData = snapshotData;
    }

    @Override
    public JsonElement toJson() {
        return snapshotData.toJson();
    }

    @Override
    public void fromJSON(JsonElement json) {
        snapshotData = new SnapshotData(json);
    }

    public SnapshotData getSnapshotData() {
        return snapshotData;
    }

}
