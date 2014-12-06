package uk.ac.ic.wlgitbridge.util;

import java.io.BufferedReader;
import java.io.IOException;

/**
 * Created by Winston on 19/11/14.
 */
public class Util {

    private static String SERVICE_NAME;

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

    private static String removeAllSuffix(String str, String suffix) {
        int lastIndexOfSuffix;
        String result = str;
        while ((lastIndexOfSuffix = result.lastIndexOf(suffix)) > -1) {
            result = result.substring(0, lastIndexOfSuffix);
        }
        return result;
    }

    /* removeAllSuffixes("something.git///", "/", ".git") => "something" */
    public static String removeAllSuffixes(String str, String... suffixes) {
        String result = str;
        for (String suffix : suffixes) {
            result = removeAllSuffix(result, suffix);
        }
        return result;
    }

    public static String getContentsOfReader(BufferedReader reader) throws IOException {
        StringBuilder sb = new StringBuilder();
        for (String line; (line = reader.readLine()) != null; ) {
            sb.append(line);
        }
        return sb.toString();
    }

    public static void setServiceName(String serviceName) {
        SERVICE_NAME = serviceName;
    }

    public static String getServiceName() {
        return SERVICE_NAME;
    }

}
