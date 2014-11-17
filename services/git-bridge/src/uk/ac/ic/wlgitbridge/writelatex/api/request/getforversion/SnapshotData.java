package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;

import java.util.LinkedList;
import java.util.List;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotData implements JSONSource {

    public static final String JSON_KEY_SRCS = "srcs";
    public static final String JSON_KEY_ATTS = "atts";

    private List<SnapshotFile> srcs;
    private List<SnapshotAttachment> atts;

    public SnapshotData(JsonElement json) {
        srcs = new LinkedList<SnapshotFile>();
        atts = new LinkedList<SnapshotAttachment>();
        fromJSON(json);
    }

    @Override
    public void fromJSON(JsonElement json) {
        populateSrcs(json.getAsJsonObject().get(JSON_KEY_SRCS).getAsJsonArray());
        populateAtts(json.getAsJsonObject().get(JSON_KEY_ATTS).getAsJsonArray());
    }

    private void populateSrcs(JsonArray jsonArray) {
        for (JsonElement json : jsonArray) {
            srcs.add(new SnapshotFile(json));
        }
    }

    private void populateAtts(JsonArray jsonArray) {
        for (JsonElement json : jsonArray) {
            atts.add(new SnapshotAttachment(json));
        }
    }

    public List<SnapshotFile> getSrcs() {
        return srcs;
    }

    public List<SnapshotAttachment> getAtts() {
        return atts;
    }
}
