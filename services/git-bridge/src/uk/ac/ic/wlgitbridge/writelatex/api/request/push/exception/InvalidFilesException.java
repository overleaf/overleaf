package uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;

/**
 * Created by Winston on 16/11/14.
 */
public class InvalidFilesException extends SnapshotPostException {

    private static final String[] DESCRIPTION_LINES = {
            "You have invalid files in your WriteLatex project."
    };

    private List<String> descriptionLines;

    public InvalidFilesException(JsonObject json) {
        super(json);
        descriptionLines = new LinkedList<String>();
        descriptionLines.addAll(Arrays.asList(DESCRIPTION_LINES));
    }

    @Override
    public String getMessage() {
        return "invalid files";
    }

    @Override
    public List<String> getDescriptionLines() {
        return descriptionLines;
    }

    @Override
    public void fromJSON(JsonElement json) {
        System.out.println(json);
        for (JsonElement error : json.getAsJsonObject().get("errors").getAsJsonArray()) {
            descriptionLines.add(describeError(error.getAsJsonObject()));
        }
    }

    private String describeError(JsonObject jsonObject) {
        return jsonObject.get("file").getAsString() + " (" + describeFile(jsonObject) + ")";
    }

    private String describeFile(JsonObject file) {
        if (file.has("cleanFile")) {
            return describeCleanFile(file.get("cleanFile").getAsString());
        } else {
            return describeErrorState(file.get("state").getAsString());
        }
    }

    private String describeCleanFile(String cleanFile) {
        return "rename to: " + cleanFile;
    }

    private String describeErrorState(String state) {
        if (state.equals("disallowed")) {
            return "invalid file extension";
        } else {
            return "error";
        }
    }

}
