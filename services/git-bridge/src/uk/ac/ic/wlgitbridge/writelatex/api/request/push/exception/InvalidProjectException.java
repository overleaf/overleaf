package uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception;

import com.google.gson.JsonElement;

import java.util.Arrays;
import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class InvalidProjectException extends SnapshotPostException {

    private static final String[] DESCRIPTION_LINES = {
            "Your WriteLatex project is too big.",
            "Delete some files and try again.."
    };

    public InvalidProjectException(JsonElement jsonElement) {
        super(jsonElement);
    }

    @Override
    public String getMessage() {
        return "invalid project";
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList(DESCRIPTION_LINES);
    }

    @Override
    public void fromJSON(JsonElement json) {

    }

}
