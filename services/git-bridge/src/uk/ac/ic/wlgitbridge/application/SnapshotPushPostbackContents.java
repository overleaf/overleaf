package uk.ac.ic.wlgitbridge.application;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.UnexpectedPostbackException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostExceptionBuilder;

/**
 * Created by Winston on 17/11/14.
 */
public class SnapshotPushPostbackContents implements JSONSource {

    private static final String CODE_SUCCESS = "upToDate";

    private final WriteLatexDataSource writeLatexDataSource;
    private final String projectName;
    private final String postbackKey;

    private final SnapshotPostExceptionBuilder snapshotPostExceptionBuilder;

    private int versionID;
    private SnapshotPostException exception;

    public SnapshotPushPostbackContents(WriteLatexDataSource writeLatexDataSource, String projectName, String postbackKey, String contents) {
        this.writeLatexDataSource = writeLatexDataSource;
        this.projectName = projectName;
        this.postbackKey = postbackKey;
        snapshotPostExceptionBuilder = new SnapshotPostExceptionBuilder();
        fromJSON(new Gson().fromJson(contents, JsonElement.class));
    }

    @Override
    public void fromJSON(JsonElement json) {
        System.out.println(json);
        JsonObject responseObject = json.getAsJsonObject();
        String code = responseObject.get("code").getAsString();
        setResult(responseObject, code);
    }

    public void processPostback() throws UnexpectedPostbackException {
        if (exception == null) {
            writeLatexDataSource.postbackReceivedSuccessfully(projectName, postbackKey, versionID);
        } else {
            writeLatexDataSource.postbackReceivedWithException(projectName, postbackKey, exception);
        }
    }

    private void setResult(JsonObject responseObject, String code) {
        if (code.equals(CODE_SUCCESS)) {
            setVersionID(responseObject);
        } else {
            setException(responseObject, code);
        }
    }

    private void setVersionID(JsonObject responseObject) {
        versionID = responseObject.get("latestVerId").getAsInt();
    }

    private void setException(JsonObject responseObject, String code) {
        try {
            exception = snapshotPostExceptionBuilder.build(code, responseObject);
        } catch (UnexpectedPostbackException e) {
            throw new RuntimeException(e);
        }
    }

}
