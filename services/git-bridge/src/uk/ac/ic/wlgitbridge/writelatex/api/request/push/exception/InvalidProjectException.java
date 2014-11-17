package uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception;

import com.google.gson.JsonElement;

import java.util.Arrays;
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
        return "invalid project";
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList("your project is too big");
    }

    @Override
    public void fromJSON(JsonElement json) {

    }

}
