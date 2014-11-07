package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;

import java.io.IOException;
import java.util.LinkedList;
import java.util.List;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetForVersionResult extends Result {

    private SnapshotData snapshotData;

    public SnapshotGetForVersionResult(Request request, JsonElement json) {
        super(request, json);
    }

    @Override
    public void fromJSON(JsonElement json) {
        snapshotData = new SnapshotData(json);
    }

    public SnapshotData getSnapshotData() {
        return snapshotData;
    }

}
