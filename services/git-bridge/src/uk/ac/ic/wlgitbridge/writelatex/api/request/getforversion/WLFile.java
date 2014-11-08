package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 06/11/14.
 */
public class WLFile implements JSONSource {

    protected byte[] contents;
    private String path;

    public WLFile(JsonElement json) throws FailedConnectionException {
        fromJSON(json);
    }

    @Override
    public void fromJSON(JsonElement json) throws FailedConnectionException {
        JsonArray jsonArray = json.getAsJsonArray();
        getContentsFromJSON(jsonArray);
        getPathFromJSON(jsonArray);
    }

    public byte[] getContents() throws FailedConnectionException {
        return contents;
    }

    public String getPath() {
        return path;
    }

    protected void getContentsFromJSON(JsonArray jsonArray) throws FailedConnectionException {
        contents = jsonArray.get(0).getAsString().getBytes();
    }

    protected void getPathFromJSON(JsonArray jsonArray) {
        path = jsonArray.get(1).getAsString();
    }

    public void writeToDisk(String repoDir) throws FailedConnectionException, IOException {
        File file = new File(repoDir, path);
        file.getParentFile().mkdirs();
        file.createNewFile();
        OutputStream out = new FileOutputStream(file);
        out.write(getContents());
        out.close();
    }

}
