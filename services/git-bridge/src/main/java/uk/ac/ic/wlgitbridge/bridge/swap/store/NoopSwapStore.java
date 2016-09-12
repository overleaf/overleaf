package uk.ac.ic.wlgitbridge.bridge.swap.store;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Created by winston on 24/08/2016.
 */
public class NoopSwapStore implements SwapStore {

    public NoopSwapStore(SwapStoreConfig config) {

    }

    @Override
    public void upload(
            String projectName,
            InputStream uploadStream,
            long contentLength
    ) throws IOException {

    }

    @Override
    public InputStream openDownloadStream(String projectName) {
        return new ByteArrayInputStream(new byte[0]);
    }

    @Override
    public void remove(String projectName) {

    }

}
