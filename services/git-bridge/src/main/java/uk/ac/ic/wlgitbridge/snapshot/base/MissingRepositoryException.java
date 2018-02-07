package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.git.exception.SnapshotAPIException;

import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;

public class MissingRepositoryException extends SnapshotAPIException {

    public static final List<String> GENERIC_REASON = Arrays.asList(
        "This Overleaf project currently has no git access.",
        "",
        "If this problem persists, please contact us."
    );

    public static final List<String> EXPORTED_TO_V2 = Arrays.asList(
        "This Overleaf project has been moved to Overleaf v2, and git access is temporarily unsupported.",
        "",
        "See https://www.overleaf.com/help/342 for more information."
    );

    private List<String> descriptionLines;

    public MissingRepositoryException() {
        descriptionLines = new ArrayList<String>();
    }

    public MissingRepositoryException(String message) {
        this.descriptionLines = Arrays.asList(message);
    }

    public MissingRepositoryException(List<String> descriptionLines) {
        this.descriptionLines = descriptionLines;
    }

    @Override
    public void fromJSON(JsonElement json) {}

    @Override
    public String getMessage() {
        return String.join("\n", this.descriptionLines);
    }

    @Override
    public List<String> getDescriptionLines() {
        return this.descriptionLines;
    }

}
