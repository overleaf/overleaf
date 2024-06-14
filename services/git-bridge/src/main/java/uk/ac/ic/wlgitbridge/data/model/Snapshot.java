package uk.ac.ic.wlgitbridge.data.model;

import java.util.Date;
import java.util.List;
import org.joda.time.DateTime;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.SnapshotInfo;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.WLUser;

/*
 * Created by Winston on 03/11/14.
 */
public class Snapshot implements Comparable<Snapshot> {

  private final int versionID;
  private final String comment;
  private final String userName;
  private final String userEmail;
  private final Date createdAt;

  private final List<SnapshotFile> srcs;
  private final List<SnapshotAttachment> atts;

  public Snapshot(SnapshotInfo info, SnapshotData data) {
    versionID = info.getVersionId();
    comment = info.getComment();
    WLUser user = info.getUser();
    userName = user.getName();
    userEmail = user.getEmail();
    createdAt = new DateTime(info.getCreatedAt()).toDate();

    srcs = data.getSrcs();
    atts = data.getAtts();
  }

  public int getVersionID() {
    return versionID;
  }

  public String getComment() {
    return comment;
  }

  public String getUserName() {
    return userName;
  }

  public String getUserEmail() {
    return userEmail;
  }

  public List<SnapshotFile> getSrcs() {
    return srcs;
  }

  public List<SnapshotAttachment> getAtts() {
    return atts;
  }

  public Date getCreatedAt() {
    return createdAt;
  }

  @Override
  public int compareTo(Snapshot snapshot) {
    return Integer.compare(versionID, snapshot.versionID);
  }

  @Override
  public String toString() {
    return String.valueOf(versionID);
  }
}
