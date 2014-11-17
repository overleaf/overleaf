package uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.Arrays;
import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class InvalidFilesException extends SnapshotPostException {

    private static final String[] DESCRIPTION_LINES = {
            "You have invalid files in your WriteLatex project.",
            "Check your extensions."
    };

    public InvalidFilesException(JsonObject json) {
        super(json);
    }

    @Override
    public String getMessage() {
        return "invalid files";
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList(DESCRIPTION_LINES);
    }

    @Override
    public void fromJSON(JsonElement json) {

    }

}
