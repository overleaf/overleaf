package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.git.exception.SnapshotAPIException;

import java.util.Arrays;
import java.util.List;

public class MissingRepositoryException extends SnapshotAPIException {

    public static final String GENERIC_REASON =
        "This Overleaf project currently has no git access.\n" +
        "\n" +
        "If you think this is an error, contact support at support@overleaf.com.";

    public static final String EXPORTED_TO_V2 =
        "This Overleaf project has been moved to Overleaf v2, and git access is temporarily unsupported.\n" +
        "\n" +
        "See https://www.overleaf.com/help/342 for more information.";

    private String message = "";

    public MissingRepositoryException() {
    }

    public MissingRepositoryException(String message) {
        this.message = message;
    }

    @Override
    public void fromJSON(JsonElement json) {}

    @Override
    public String getMessage() {
        return message;
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList(getMessage());
    }

}
