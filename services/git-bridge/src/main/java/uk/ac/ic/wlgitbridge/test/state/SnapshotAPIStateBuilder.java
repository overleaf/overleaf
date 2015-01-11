package uk.ac.ic.wlgitbridge.test.state;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.test.response.push.data.SnapshotPushResult;
import uk.ac.ic.wlgitbridge.test.response.push.data.SnapshotPushResultOutOfDate;
import uk.ac.ic.wlgitbridge.test.response.push.data.SnapshotPushResultSuccess;
import uk.ac.ic.wlgitbridge.test.response.push.postback.*;
import uk.ac.ic.wlgitbridge.test.response.push.postback.invalidfile.InvalidFileError;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocResult;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionResult;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotGetSavedVersResult;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotInfo;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 11/01/15.
 */
public class SnapshotAPIStateBuilder {

    private final JsonArray projects;

    private Map<String, SnapshotGetDocResult> getDoc = new HashMap<String, SnapshotGetDocResult>();
    private Map<String, SnapshotGetSavedVersResult> getSavedVers = new HashMap<String, SnapshotGetSavedVersResult>();
    private Map<String, Map<Integer, SnapshotGetForVersionResult>> getForVers = new HashMap<String, Map<Integer, SnapshotGetForVersionResult>>();
    private Map<String, SnapshotPushResult> push = new HashMap<String, SnapshotPushResult>();
    private Map<String, SnapshotPostbackRequest> postback = new HashMap<String, SnapshotPostbackRequest>();

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
        getDoc.put(projectName,
                   new SnapshotGetDocResult(jsonGetDoc.get("versionID").getAsInt(),
                                            jsonGetDoc.get("createdAt").getAsString(),
                                            jsonGetDoc.get("email").getAsString(),
                                            jsonGetDoc.get("name").getAsString()));
    }

    private void addGetSavedVersForProject(String projectName, JsonArray jsonGetSavedVers) {
        List<SnapshotInfo> savedVers = new LinkedList<SnapshotInfo>();
        for (JsonElement ver : jsonGetSavedVers) {
            savedVers.add(getSnapshotInfo(ver.getAsJsonObject()));
        }
        getSavedVers.put(projectName, new SnapshotGetSavedVersResult(savedVers));
    }

    private SnapshotInfo getSnapshotInfo(JsonObject jsonSnapshotInfo) {
        return new SnapshotInfo(jsonSnapshotInfo.get("versionID").getAsInt(),
                                jsonSnapshotInfo.get("comment").getAsString(),
                                jsonSnapshotInfo.get("email").getAsString(),
                                jsonSnapshotInfo.get("name").getAsString(),
                                jsonSnapshotInfo.get("createdAt").getAsString());
    }

    private void addGetForVersForProject(String projectName, JsonArray jsonGetForVers) {
        Map<Integer, SnapshotGetForVersionResult> forVers = new HashMap<Integer, SnapshotGetForVersionResult>();
        for (JsonElement forVer : jsonGetForVers) {
            JsonObject forVerObj = forVer.getAsJsonObject();
            forVers.put(forVerObj.get("versionID").getAsInt(),
                        new SnapshotGetForVersionResult(new SnapshotData(getSrcs(forVerObj.get("srcs").getAsJsonArray()),
                                                                         getAtts(forVerObj.get("atts").getAsJsonArray()))));
        }
        getForVers.put(projectName, forVers);
    }

    private List<SnapshotFile> getSrcs(JsonArray jsonSrcs) {
        List<SnapshotFile> srcs = new LinkedList<SnapshotFile>();
        for (JsonElement src : jsonSrcs) {
            srcs.add(getSrc(src.getAsJsonObject()));
        }
        return srcs;
    }

    private SnapshotFile getSrc(JsonObject jsonSrc) {
        return new SnapshotFile(jsonSrc.get("content").getAsString(),
                                jsonSrc.get("path").getAsString());
    }

    private List<SnapshotAttachment> getAtts(JsonArray jsonAtts) {
        List<SnapshotAttachment> atts = new LinkedList<SnapshotAttachment>();
        for (JsonElement att : jsonAtts) {
            atts.add(getAtt(att.getAsJsonObject()));
        }
        return atts;
    }

    private SnapshotAttachment getAtt(JsonObject jsonAtt) {
        return new SnapshotAttachment(jsonAtt.get("url").getAsString(),
                                      jsonAtt.get("path").getAsString());
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
            p = new SnapshotPostbackRequestInvalidFiles(new LinkedList<InvalidFileError>());
        } else if (type.equals("invalidProject")) {
            p = new SnapshotPostbackRequestInvalidProject(new LinkedList<String>());
        } else if (type.equals("error")) {
            p = new SnapshotPostbackRequestError();
        } else {
            throw new IllegalArgumentException("invalid postback type");
        }
        postback.put(projectName, p);
    }

}
