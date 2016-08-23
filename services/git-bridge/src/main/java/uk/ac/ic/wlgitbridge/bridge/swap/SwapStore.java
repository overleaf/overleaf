package uk.ac.ic.wlgitbridge.bridge.swap;

import java.io.InputStream;

/**
 * Created by winston on 20/08/2016.
 */
public interface SwapStore {

    void upload(String projectName, InputStream uploadStream, long contentLength);

    InputStream openDownloadStream(String projectName);

    void remove(String projectName);

}
