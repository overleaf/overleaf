package uk.ac.ic.wlgitbridge.snapshot.servermock.state;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.*;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.GetForVersionResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.GetSavedVersResult;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.SnapshotInfo;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.data.SnapshotPushResult;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.data.SnapshotPushResultOutOfDate;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.data.SnapshotPushResultSuccess;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback.*;

/*
 * Created by Winston on 11/01/15.
 */
public class SnapshotAPIStateBuilder {

  private final JsonArray projects;

  private Map<String, GetDocResult> getDoc = new HashMap<>();
  private Map<String, GetSavedVersResult> getSavedVers = new HashMap<>();
  private Map<String, Map<Integer, GetForVersionResult>> getForVers = new HashMap<>();
  private Map<String, SnapshotPushResult> push = new HashMap<>();
  private Map<String, SnapshotPostbackRequest> postback = new HashMap<>();

  public SnapshotAPIStateBuilder(InputStream stream) {
    projects = new Gson().fromJson(new InputStreamReader(stream), JsonArray.class);
  }

  public SnapshotAPIState build() {
    for (JsonElement project : projects) {
      addProject(project.getAsJsonObject());
    }
    return new SnapshotAPIState(getDoc, getSavedVers, getForVers, push, postback);
  }

  private void addProject(JsonObject project) {
    String projectName = project.get("project").getAsString();
    addGetDocForProject(projectName, project.get("getDoc").getAsJsonObject());
    addGetSavedVersForProject(projectName, project.get("getSavedVers").getAsJsonArray());
    addGetForVersForProject(projectName, project.get("getForVers").getAsJsonArray());
    addPushForProject(projectName, project.get("push").getAsString());
    addPostbackForProject(projectName, project.get("postback").getAsJsonObject());
  }

  private void addGetDocForProject(String projectName, JsonObject jsonGetDoc) {
    int versionID = jsonGetDoc.get("versionID").getAsInt();
    String createdAt = null;
    String email = null;
    String name = null;
    if (jsonGetDoc.has("createdAt")) {
      createdAt = jsonGetDoc.get("createdAt").getAsString();
    }
    if (jsonGetDoc.has("email")) {
      email = jsonGetDoc.get("email").getAsString();
    }
    if (jsonGetDoc.has("name")) {
      name = jsonGetDoc.get("name").getAsString();
    }
    getDoc.put(
        projectName, new GetDocResult(jsonGetDoc.get("error"), versionID, createdAt, email, name));
  }

  private void addGetSavedVersForProject(String projectName, JsonArray jsonGetSavedVers) {
    List<SnapshotInfo> savedVers = new ArrayList<>();
    for (JsonElement ver : jsonGetSavedVers) {
      savedVers.add(getSnapshotInfo(ver.getAsJsonObject()));
    }
    getSavedVers.put(projectName, new GetSavedVersResult(savedVers));
  }

  private SnapshotInfo getSnapshotInfo(JsonObject jsonSnapshotInfo) {
    return new SnapshotInfo(
        jsonSnapshotInfo.get("versionID").getAsInt(),
        jsonSnapshotInfo.get("comment").getAsString(),
        jsonSnapshotInfo.get("email").getAsString(),
        jsonSnapshotInfo.get("name").getAsString(),
        jsonSnapshotInfo.get("createdAt").getAsString());
  }

  private void addGetForVersForProject(String projectName, JsonArray jsonGetForVers) {
    Map<Integer, GetForVersionResult> forVers = new HashMap<>();
    for (JsonElement forVer : jsonGetForVers) {
      JsonObject forVerObj = forVer.getAsJsonObject();
      forVers.put(
          forVerObj.get("versionID").getAsInt(),
          new GetForVersionResult(
              new SnapshotData(
                  getSrcs(forVerObj.get("srcs").getAsJsonArray()),
                  getAtts(forVerObj.get("atts").getAsJsonArray()))));
    }
    getForVers.put(projectName, forVers);
  }

  private List<SnapshotFile> getSrcs(JsonArray jsonSrcs) {
    List<SnapshotFile> srcs = new ArrayList<>();
    for (JsonElement src : jsonSrcs) {
      srcs.add(getSrc(src.getAsJsonObject()));
    }
    return srcs;
  }

  private SnapshotFile getSrc(JsonObject jsonSrc) {
    return new SnapshotFile(
        jsonSrc.get("content").getAsString(), jsonSrc.get("path").getAsString());
  }

  private List<SnapshotAttachment> getAtts(JsonArray jsonAtts) {
    List<SnapshotAttachment> atts = new LinkedList<>();
    for (JsonElement att : jsonAtts) {
      atts.add(getAtt(att.getAsJsonObject()));
    }
    return atts;
  }

  private SnapshotAttachment getAtt(JsonObject jsonAtt) {
    return new SnapshotAttachment(
        jsonAtt.get("url").getAsString(), jsonAtt.get("path").getAsString());
  }

  private void addPushForProject(String projectName, String jsonPush) {
    SnapshotPushResult p;
    if (jsonPush.equals("success")) {
      p = new SnapshotPushResultSuccess();
    } else if (jsonPush.equals("outOfDate")) {
      p = new SnapshotPushResultOutOfDate();
    } else {
      throw new IllegalArgumentException("invalid push");
    }
    push.put(projectName, p);
  }

  private void addPostbackForProject(String projectName, JsonObject jsonPostback) {
    SnapshotPostbackRequest p;
    String type = jsonPostback.get("type").getAsString();
    if (type.equals("success")) {
      p = new SnapshotPostbackRequestSuccess(jsonPostback.get("versionID").getAsInt());
    } else if (type.equals("outOfDate")) {
      p = new SnapshotPostbackRequestOutOfDate();
    } else if (type.equals("invalidFiles")) {
      p = new SnapshotPostbackRequestInvalidFiles(jsonPostback.get("errors").getAsJsonArray());
    } else if (type.equals("invalidProject")) {
      p = new SnapshotPostbackRequestInvalidProject(jsonPostback.get("errors").getAsJsonArray());
    } else if (type.equals("error")) {
      p = new SnapshotPostbackRequestError();
    } else {
      throw new IllegalArgumentException("invalid postback type");
    }
    postback.put(projectName, p);
  }
}
