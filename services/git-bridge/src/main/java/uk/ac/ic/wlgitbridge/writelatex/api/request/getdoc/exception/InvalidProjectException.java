package uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;

import java.util.List;

/**
 * Created by Winston on 08/11/14.
 */
public class InvalidProjectException extends SnapshotPostException {

    public InvalidProjectException(JsonObject json) {
        super(json);
    }

    public InvalidProjectException() {
        super();
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
