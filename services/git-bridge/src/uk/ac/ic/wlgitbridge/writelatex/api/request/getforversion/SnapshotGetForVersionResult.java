package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetForVersionResult extends Result {

    public SnapshotGetForVersionResult(Request request, JsonElement json) {
        super(request, json);
    }

    @Override
    public void fromJSON(JsonElement json) {

    }

}
