package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;

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

    public SnapshotData(JsonElement json) {
        srcs = new LinkedList<WLFile>();
        atts = new LinkedList<WLFile>();
        fromJSON(json);
    }

    @Override
    public void fromJSON(JsonElement json) {
        populateSrcs(json.getAsJsonObject().get(JSON_KEY_SRCS).getAsJsonArray());
        populateAtts(json.getAsJsonObject().get(JSON_KEY_ATTS).getAsJsonArray());
    }

    private void populateSrcs(JsonArray jsonArray) {
        for (JsonElement json : jsonArray) {
            srcs.add(new WLFile(json));
        }
        System.out.println(srcs);
    }

    private void populateAtts(JsonArray jsonArray) {
        for (JsonElement json : jsonArray) {
            atts.add(new WLAttachment(json));
        }
        System.out.println(atts);
    }

    public void writeAll(String repoDir) throws InterruptedException, ExecutionException, IOException {
        for (WLFile src : srcs) {
            src.writeToDisk(repoDir);
        }
        for (WLFile att : atts) {
            att.writeToDisk(repoDir);
        }
    }

}
