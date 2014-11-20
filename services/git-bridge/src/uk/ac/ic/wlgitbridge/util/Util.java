package uk.ac.ic.wlgitbridge.util;

/**
 * Created by Winston on 19/11/14.
 */
public class Util {

    public static String entries(int entries) {
        if (entries == 1) {
            return "entry";
        } else {
            return "entries";
        }
    }

    public static int booleanToInt(boolean b) {
        if (b) {
            return 1;
        } else {
            return 0;
        }
    }

    public static boolean intToBoolean(int i) {
        return i != 0;
    }

}
