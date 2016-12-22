package uk.ac.ic.wlgitbridge.bridge.resource;

import uk.ac.ic.wlgitbridge.data.filestore.RawFile;

import java.io.IOException;
import java.util.Map;

/**
 * Created by winston on 20/08/2016.
 */
public interface ResourceCache {

    RawFile get(
            String projectName,
            String url,
            String newPath,
            Map<String, RawFile> fileTable,
            Map<String, byte[]> fetchedUrls
    ) throws IOException;

}
