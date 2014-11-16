package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.bridge.RawFile;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotFile implements JSONSource, RawFile {

    protected byte[] contents;
    private String path;

    public SnapshotFile(JsonElement json) throws FailedConnectionException {
        fromJSON(json);
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
    public void fromJSON(JsonElement json) throws FailedConnectionException {
        JsonArray jsonArray = json.getAsJsonArray();
        getContentsFromJSON(jsonArray);
        getPathFromJSON(jsonArray);
    }

    protected void getContentsFromJSON(JsonArray jsonArray) throws FailedConnectionException {
        contents = jsonArray.get(0).getAsString().getBytes();
    }

    protected void getPathFromJSON(JsonArray jsonArray) {
        path = jsonArray.get(1).getAsString();
    }

}
