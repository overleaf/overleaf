package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.gson.JsonElement;
import java.util.Arrays;
import java.util.List;
import uk.ac.ic.wlgitbridge.git.exception.SnapshotAPIException;

public class MissingRepositoryException extends SnapshotAPIException {

  public static final List<String> GENERIC_REASON =
      Arrays.asList(
          "This Overleaf project currently has no git access, either because",
          "the project does not exist, or because git access is not enabled",
          "for the project.",
          "",
          "If this is unexpected, please contact us at support@overleaf.com, or",
          "see https://www.overleaf.com/learn/how-to/Git_integration for more information.");

  static List<String> buildDeprecatedMessage(String newUrl) {
    if (newUrl == null) {
      return Arrays.asList(
          "This project has not yet been moved into the new version of Overleaf. You will",
          "need to move it in order to continue working on it. Please visit this project",
          "online on www.overleaf.com to do this.",
          "",
          "After migrating this project to the new version of Overleaf, you will be",
          "prompted to update your git remote to the project's new identifier.",
          "",
          "If this is unexpected, please contact us at support@overleaf.com, or",
          "see https://www.overleaf.com/learn/how-to/Git_integration for more information.");
    } else {
      return Arrays.asList(
          "This project has not yet been moved into the new version of Overleaf. You will",
          "need to move it in order to continue working on it. Please visit this project",
          "online to do this:",
          "",
          "    " + newUrl,
          "",
          "After migrating this project to the new version of Overleaf, you will be",
          "prompted to update your git remote to the project's new identifier.",
          "",
          "If this is unexpected, please contact us at support@overleaf.com, or",
          "see https://www.overleaf.com/learn/how-to/Git_integration for more information.");
    }
  }

  static List<String> buildExportedToV2Message(String remoteUrl) {
    if (remoteUrl == null) {
      return Arrays.asList(
          "This Overleaf project has been moved to Overleaf v2 and cannot be used with git at this time.",
          "",
          "If this error persists, please contact us at support@overleaf.com, or",
          "see https://www.overleaf.com/learn/how-to/Git_integration for more information.");
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
          "see https://www.overleaf.com/learn/how-to/Git_integration for more information.");
    }
  }

  private List<String> descriptionLines;

  public MissingRepositoryException() {
    this.descriptionLines = GENERIC_REASON;
  }

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
