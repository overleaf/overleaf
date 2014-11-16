package uk.ac.ic.wlgitbridge.writelatex;

import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.SnapshotPushRequest;
import uk.ac.ic.wlgitbridge.writelatex.model.WLDataModel;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 16/11/14.
 */
public class WriteLatexAPI implements WriteLatexDataSource {

    private final WLDataModel dataModel;
    private final Map<String, Object> postbackConds;

    public WriteLatexAPI(WLDataModel dataModel) {
        this.dataModel = dataModel;
        postbackConds = new HashMap<String, Object>();
    }

    @Override
    public boolean repositoryExists(String projectName) throws FailedConnectionException {
        SnapshotGetDocRequest snapshotGetDocRequest = new SnapshotGetDocRequest(projectName);
        snapshotGetDocRequest.request();
        try {
            snapshotGetDocRequest.getResult().getVersionID();
        } catch (InvalidProjectException e) {
            return false;
        }
        return true;
    }

    @Override
    public List<WritableRepositoryContents> getWritableRepositories(String projectName) throws FailedConnectionException, InvalidProjectException {
        return dataModel.updateProjectWithName(projectName);
    }

    @Override
    public void putDirectoryContentsToProjectWithName(String projectName, RawDirectoryContents directoryContents, String hostname) throws SnapshotPostException, IOException, FailedConnectionException {
        CandidateSnapshot candidate = dataModel.createCandidateSnapshotFromProjectWithContents(projectName, directoryContents, hostname);
        new SnapshotPushRequest(candidate).request();
        expectPostback(projectName);
        candidate.approveWithVersionID(100);
    }

    @Override
    public void expectPostback(String projectName) {
        Object value = new Object();
        postbackConds.put(projectName, value);
        try {
            value.wait();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    /* Called by postback thread. */
    @Override
    public void postbackReceivedSuccessfully(String projectName) {
        System.out.println("successfully received postback for " + projectName);
        postbackConds.get(projectName).notifyAll();
    }

    @Override
    public void postbackReceivedWithException(String projectName, SnapshotPostException exception) {
        postbackReceivedSuccessfully(projectName);
    }

}
