package uk.ac.ic.wlgitbridge.git.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.ObjectLoader;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.treewalk.TreeWalk;
import uk.ac.ic.wlgitbridge.bridge.util.CastUtil;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.git.exception.InvalidGitRepository;
import uk.ac.ic.wlgitbridge.git.exception.SizeLimitExceededException;

/*
 * Created by Winston on 16/11/14.
 */
public class RepositoryObjectTreeWalker {

  private final TreeWalk treeWalk;
  private final Repository repository;

  public RepositoryObjectTreeWalker(Repository repository, ObjectId objectId) throws IOException {
    treeWalk = initTreeWalk(repository, objectId);
    this.repository = repository;
  }

  public RepositoryObjectTreeWalker(Repository repository) throws IOException {
    this(repository, 0);
  }

  public RepositoryObjectTreeWalker(Repository repository, int fromHead) throws IOException {
    this(repository, repository.resolve("HEAD~" + fromHead));
  }

  public RawDirectory getDirectoryContents(Optional<Long> maxFileSize)
      throws IOException, SizeLimitExceededException, InvalidGitRepository {
    return new RawDirectory(walkGitObjectTree(maxFileSize));
  }

  private TreeWalk initTreeWalk(Repository repository, ObjectId objectId) throws IOException {
    if (objectId == null) {
      return null;
    }
    RevWalk walk = new RevWalk(repository);
    TreeWalk treeWalk = new TreeWalk(repository);
    treeWalk.addTree(walk.parseCommit(objectId).getTree());
    treeWalk.setRecursive(true);
    return treeWalk;
  }

  private Map<String, RawFile> walkGitObjectTree(Optional<Long> maxFileSize)
      throws IOException, SizeLimitExceededException, InvalidGitRepository {
    Map<String, RawFile> fileContentsTable = new HashMap<>();
    if (treeWalk == null) {
      return fileContentsTable;
    }
    while (treeWalk.next()) {
      String path = treeWalk.getPathString();

      ObjectId objectId = treeWalk.getObjectId(0);
      if (!repository.getObjectDatabase().has(objectId)) {
        throw new InvalidGitRepository();
      }
      ObjectLoader obj = repository.open(objectId);
      long size = obj.getSize();
      if (maxFileSize.isPresent() && size > maxFileSize.get()) {
        throw new SizeLimitExceededException(Optional.ofNullable(path), size, maxFileSize.get());
      }
      try (ByteArrayOutputStream o = new ByteArrayOutputStream(CastUtil.assumeInt(size))) {
        obj.copyTo(o);
        fileContentsTable.put(path, new RepositoryFile(path, o.toByteArray()));
      }
      ;
    }
    return fileContentsTable;
  }
}
