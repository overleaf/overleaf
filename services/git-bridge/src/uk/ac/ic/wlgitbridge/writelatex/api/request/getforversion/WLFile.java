package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;

import java.io.*;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 06/11/14.
 */
public class WLFile implements JSONSource {

    protected byte[] contents;
    private String path;

    public WLFile(JsonElement json) {
        fromJSON(json);
    }

    @Override
    public void fromJSON(JsonElement json) {
        JsonArray jsonArray = json.getAsJsonArray();
        getContentsFromJSON(jsonArray);
        getPathFromJSON(jsonArray);
    }

    public byte[] getContents() throws ExecutionException, InterruptedException {
        return contents;
    }

    public String getPath() {
        return path;
    }

    protected void getContentsFromJSON(JsonArray jsonArray) {
        contents = jsonArray.get(0).getAsString().getBytes();
    }

    protected void getPathFromJSON(JsonArray jsonArray) {
        path = jsonArray.get(1).getAsString();
    }

    public void writeToDisk(String repoDir) throws IOException, ExecutionException, InterruptedException {
        File file = new File(repoDir, path);
        file.getParentFile().mkdirs();
        file.createNewFile();
        OutputStream out = new FileOutputStream(file);
        out.write(getContents());
        out.close();
    }

}
