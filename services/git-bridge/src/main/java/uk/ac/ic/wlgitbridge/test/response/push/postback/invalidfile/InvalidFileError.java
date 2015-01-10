package uk.ac.ic.wlgitbridge.test.response.push.postback.invalidfile;

import com.google.gson.JsonObject;

/**
 * Created by Winston on 09/01/15.
 */
public abstract class InvalidFileError {

    private final String file;

    public InvalidFileError(String file) {
        this.file = file;
    }

    public JsonObject toJson() {
        JsonObject jsonThis = new JsonObject();
        jsonThis.addProperty("file", file);
        jsonThis.addProperty("state", getState());
        return jsonThis;
    }

    protected abstract String getState();

}
