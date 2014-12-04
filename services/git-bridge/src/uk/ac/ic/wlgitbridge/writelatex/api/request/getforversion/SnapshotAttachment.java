package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotAttachment extends SnapshotFile {

    private String url;

    public SnapshotAttachment(JsonElement json) {
        super(json);
    }

    @Override
    public byte[] getContents() {
        return null;
    }

    @Override
    protected void getContentsFromJSON(JsonArray jsonArray) {
        url = jsonArray.get(0).getAsString();
    }

    public String getUrl() {
        return url;
    }

}
