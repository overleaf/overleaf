package uk.ac.ic.wlgitbridge.data;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.io.File;
import java.io.IOException;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 16/11/14.
 */
public class CandidateSnapshot implements AutoCloseable {

  private final String projectName;
  private final int currentVersion;
  private final List<ServletFile> files;
  private final List<String> deleted;
  private File attsDirectory;

  public CandidateSnapshot(
      String projectName,
      int currentVersion,
      RawDirectory directoryContents,
      RawDirectory oldDirectoryContents) {
    this.projectName = projectName;
    this.currentVersion = currentVersion;
    files = diff(directoryContents, oldDirectoryContents);
    deleted = deleted(directoryContents, oldDirectoryContents);
  }

  private List<ServletFile> diff(
      RawDirectory directoryContents, RawDirectory oldDirectoryContents) {
    List<ServletFile> files = new LinkedList<ServletFile>();
    Map<String, RawFile> fileTable = directoryContents.getFileTable();
    Map<String, RawFile> oldFileTable = oldDirectoryContents.getFileTable();
    for (Entry<String, RawFile> entry : fileTable.entrySet()) {
      RawFile file = entry.getValue();
      files.add(new ServletFile(file, oldFileTable.get(file.getPath())));
    }
    return files;
  }

  private List<String> deleted(RawDirectory directoryContents, RawDirectory oldDirectoryContents) {
    List<String> deleted = new LinkedList<String>();
    Map<String, RawFile> fileTable = directoryContents.getFileTable();
    for (Entry<String, RawFile> entry : oldDirectoryContents.getFileTable().entrySet()) {
      String path = entry.getKey();
      RawFile newFile = fileTable.get(path);
      if (newFile == null) {
        deleted.add(path);
      }
    }
    return deleted;
  }

  public void writeServletFiles(File rootGitDirectory) throws IOException {
    attsDirectory = new File(rootGitDirectory, ".wlgb/atts/" + projectName);
    for (ServletFile file : files) {
      if (file.isChanged()) {
        file.writeToDiskWithName(attsDirectory, file.getUniqueIdentifier());
      }
    }
  }

  public void deleteServletFiles() throws IOException {
    if (attsDirectory != null) {
      Util.deleteDirectory(attsDirectory);
    }
  }

  public JsonElement getJsonRepresentation(String postbackKey) {
    String projectURL = Util.getPostbackURL() + "api/" + projectName;
    JsonObject jsonObject = new JsonObject();
    jsonObject.addProperty("latestVerId", currentVersion);
    jsonObject.add("files", getFilesAsJson(projectURL, postbackKey));
    jsonObject.addProperty("postbackUrl", projectURL + "/" + postbackKey + "/postback");
    return jsonObject;
  }

  private JsonArray getFilesAsJson(String projectURL, String postbackKey) {
    JsonArray filesArray = new JsonArray();
    for (ServletFile file : files) {
      filesArray.add(getFileAsJson(file, projectURL, postbackKey));
    }
    return filesArray;
  }

  private JsonObject getFileAsJson(ServletFile file, String projectURL, String postbackKey) {
    JsonObject jsonFile = new JsonObject();
    jsonFile.addProperty("name", file.getPath());
    if (file.isChanged()) {
      String identifier = file.getUniqueIdentifier();
      String url = projectURL + "/" + identifier + "?key=" + postbackKey;
      jsonFile.addProperty("url", url);
    }
    return jsonFile;
  }

  public String getProjectName() {
    return projectName;
  }

  public List<String> getDeleted() {
    return deleted;
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("VersionId: ");
    sb.append(currentVersion);
    sb.append(", files: ");
    sb.append(files);
    sb.append(", deleted: ");
    sb.append(deleted);
    return sb.toString();
  }

  @Override
  public void close() throws IOException {
    deleteServletFiles();
  }
}
