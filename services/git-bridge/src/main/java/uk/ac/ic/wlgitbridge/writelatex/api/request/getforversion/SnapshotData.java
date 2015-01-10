package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
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

    public SnapshotData(List<SnapshotFile> srcs, List<SnapshotAttachment> atts) {
        this.srcs = srcs;
        this.atts = atts;
    }

    public JsonElement toJson() {
        JsonObject jsonThis = new JsonObject();
        JsonArray jsonSrcs = new JsonArray();
        for (SnapshotFile src : srcs) {
            jsonSrcs.add(src.toJson());
        }
        jsonThis.add("srcs", jsonSrcs);
        JsonArray jsonAtts = new JsonArray();
        for (SnapshotAttachment att : atts) {
            jsonAtts.add(att.toJson());
        }
        jsonThis.add("atts", jsonAtts);
        return jsonThis;
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
