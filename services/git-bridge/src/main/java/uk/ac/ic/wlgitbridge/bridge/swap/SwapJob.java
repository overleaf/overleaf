package uk.ac.ic.wlgitbridge.bridge.swap;

import java.time.Duration;

/**
 * Created by winston on 20/08/2016.
 */
public interface SwapJob {

    void start(Duration interval);

    void stop();

}
