package uk.ac.ic.wlgitbridge.bridge.swap.job;

/**
 * Created by winston on 23/08/2016.
 */
public class SwapJobConfig {

    public static final SwapJobConfig DEFAULT =
            new SwapJobConfig(1, 1, 2, 3600000);

    private final int minProjects;
    private final int lowGiB;
    private final int highGiB;
    private final long intervalMillis;

    public SwapJobConfig(
            int minProjects,
            int lowGiB,
            int highGiB,
            long intervalMillis
    ) {
        this.minProjects = minProjects;
        this.lowGiB = lowGiB;
        this.highGiB = highGiB;
        this.intervalMillis = intervalMillis;
    }

    public int getMinProjects() {
        return minProjects;
    }

    public int getLowGiB() {
        return lowGiB;
    }

    public int getHighGiB() {
        return highGiB;
    }

    public long getIntervalMillis() {
        return intervalMillis;
    }

}
