package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

import java.io.IOException;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotData implements JSONSource {

    public static final String JSON_KEY_SRCS = "srcs";
    public static final String JSON_KEY_ATTS = "atts";

    private List<WLFile> srcs;
    private List<WLFile> atts;

    public SnapshotData(JsonElement json) throws FailedConnectionException {
        srcs = new LinkedList<WLFile>();
        atts = new LinkedList<WLFile>();
        fromJSON(json);
    }

    @Override
    public void fromJSON(JsonElement json) throws FailedConnectionException {
        populateSrcs(json.getAsJsonObject().get(JSON_KEY_SRCS).getAsJsonArray());
        populateAtts(json.getAsJsonObject().get(JSON_KEY_ATTS).getAsJsonArray());
    }

    private void populateSrcs(JsonArray jsonArray) throws FailedConnectionException {
        for (JsonElement json : jsonArray) {
            srcs.add(new WLFile(json));
        }
    }

    private void populateAtts(JsonArray jsonArray) throws FailedConnectionException {
        for (JsonElement json : jsonArray) {
            atts.add(new WLAttachment(json));
        }
    }

    public List<WLFile> getSrcs() {
        return srcs;
    }

    public List<WLFile> getAtts() {
        return atts;
    }
}
