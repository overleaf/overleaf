package uk.ac.ic.wlgitbridge.bridge.swap;

/**
 * Created by winston on 23/08/2016.
 */
public class SwapJobConfig {

    public static final SwapJobConfig DEFAULT =
            new SwapJobConfig(1, 1, 2);

    private final int minProjects;
    private final long lowGiB;
    private final long highGiB;

    public SwapJobConfig(int minProjects, long lowGiB, long highGiB) {
        this.minProjects = minProjects;
        this.lowGiB = lowGiB;
        this.highGiB = highGiB;
    }

    public int getMinProjects() {
        return minProjects;
    }

    public long getLowGiB() {
        return lowGiB;
    }

    public long getHighGiB() {
        return highGiB;
    }

}
