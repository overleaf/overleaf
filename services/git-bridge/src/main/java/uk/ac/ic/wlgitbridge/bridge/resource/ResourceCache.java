package uk.ac.ic.wlgitbridge.bridge.resource;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.git.exception.SizeLimitExceededException;

/*
 * Created by winston on 20/08/2016.
 */
public interface ResourceCache {

  RawFile get(
      String projectName,
      String url,
      String newPath,
      Map<String, RawFile> fileTable,
      Map<String, byte[]> fetchedUrls,
      Optional<Long> maxFileSize)
      throws IOException, SizeLimitExceededException;
}
