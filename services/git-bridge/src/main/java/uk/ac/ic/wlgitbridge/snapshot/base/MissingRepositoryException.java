package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.git.exception.SnapshotAPIException;

import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;

public class MissingRepositoryException extends SnapshotAPIException {

    public static final List<String> GENERIC_REASON = Arrays.asList(
        "This Overleaf project currently has no git access, either because",
        "the project does not exist, or because git access is not enabled",
        "for the project.",
        "",
        "If this is unexpected, please contact us at support@overleaf.com, or",
        "see https://www.overleaf.com/help/342 for more information."
    );

    static List<String> buildExportedToV2Message(String remoteUrl) {
        if (remoteUrl == null) {
            return Arrays.asList(
                "This Overleaf project has been moved to Overleaf v2 and cannot be used with git at this time.",
                "",
                "If this error persists, please contact us at support@overleaf.com, or",
                "see https://www.overleaf.com/help/342 for more information."
            );
        } else {
            return Arrays.asList(
                "This Overleaf project has been moved to Overleaf v2 and has a new identifier.",
                "Please update your remote to:",
                "",
                "    " + remoteUrl,
                "",
                "Assuming you are using the default \"origin\" remote, the following commands",
                "will change the remote for you:",
                "",
                "    git remote set-url origin " + remoteUrl,
                "",
                "If this does not work, please contact us at support@overleaf.com, or",
                "see https://www.overleaf.com/help/342 for more information."
            );
        }
    }

    private List<String> descriptionLines;

    public MissingRepositoryException() { this.descriptionLines = GENERIC_REASON; }

    public MissingRepositoryException(List<String> descriptionLines) {
        this.descriptionLines = descriptionLines;
    }

    @Override
    public void fromJSON(JsonElement json) {}

    @Override
    public String getMessage() {
        return "no git access";
    }

    @Override
    public List<String> getDescriptionLines() {
        return this.descriptionLines;
    }

}
