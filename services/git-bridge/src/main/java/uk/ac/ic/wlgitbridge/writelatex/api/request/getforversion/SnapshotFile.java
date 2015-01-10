package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import uk.ac.ic.wlgitbridge.bridge.RawFile;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotFile implements JSONSource, RawFile {

    protected byte[] contents;
    private String path;

    public SnapshotFile(JsonElement json) {
        fromJSON(json);
    }

    public SnapshotFile(String contents, String path) {
        this.path = path;
        if (contents != null) {
            this.contents = contents.getBytes();
        }
    }

    public JsonElement toJson() {
        JsonArray jsonThis = new JsonArray();
        jsonThis.add(new JsonPrimitive(new String(contents)));
        jsonThis.add(new JsonPrimitive(path));
        return jsonThis;
    }

    @Override
    public String getPath() {
        return path;
    }

    @Override
    public byte[] getContents() {
        return contents;
    }

    @Override
    public void fromJSON(JsonElement json) {
        JsonArray jsonArray = json.getAsJsonArray();
        getContentsFromJSON(jsonArray);
        getPathFromJSON(jsonArray);
    }

    protected void getContentsFromJSON(JsonArray jsonArray) {
        contents = jsonArray.get(0).getAsString().getBytes();
    }

    protected void getPathFromJSON(JsonArray jsonArray) {
        path = jsonArray.get(1).getAsString();
    }

}
