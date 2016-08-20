package uk.ac.ic.wlgitbridge.bridge.swap;

/**
 * Created by winston on 20/08/2016.
 */
public interface SwapJob {

    void start(int intervalMillis);

    void stop();

}
