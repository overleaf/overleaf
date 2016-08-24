package uk.ac.ic.wlgitbridge.bridge.swap.job;

import java.io.IOException;

/**
 * Created by winston on 24/08/2016.
 */
public class NoopSwapJob implements SwapJob {

    @Override
    public void start() {

    }

    @Override
    public void stop() {

    }

    @Override
    public void evict(String projName) throws IOException {

    }

    @Override
    public void restore(String projName) throws IOException {

    }

}
