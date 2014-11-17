package uk.ac.ic.wlgitbridge.writelatex;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class OutOfDateException extends SnapshotPostException {

    public OutOfDateException(JsonObject json) {
        super(json);
    }

    @Override
    public String getMessage() {
        return null;
    }

    @Override
    public List<String> getDescriptionLines() {
        return null;
    }

    @Override
    public void fromJSON(JsonElement json) {

    }

}
