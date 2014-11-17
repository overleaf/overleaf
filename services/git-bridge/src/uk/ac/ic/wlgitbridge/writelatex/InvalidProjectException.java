package uk.ac.ic.wlgitbridge.writelatex;

import com.google.gson.JsonElement;

import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class InvalidProjectException extends SnapshotPostException {

    public InvalidProjectException(JsonElement jsonElement) {
        super(jsonElement);
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
