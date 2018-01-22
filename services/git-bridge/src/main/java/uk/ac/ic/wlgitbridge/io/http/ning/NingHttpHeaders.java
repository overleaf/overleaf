package uk.ac.ic.wlgitbridge.io.http.ning;

import com.ning.http.client.FluentCaseInsensitiveStringsMap;
import com.ning.http.client.HttpResponseHeaders;

import java.util.*;

public class NingHttpHeaders extends HttpResponseHeaders {

    private final FluentCaseInsensitiveStringsMap map;

    private NingHttpHeaders(FluentCaseInsensitiveStringsMap map) {
        this.map = map;
    }

    public static NingHttpHeadersBuilder builder() {
        return new NingHttpHeadersBuilder();
    }

    @Override
    public FluentCaseInsensitiveStringsMap getHeaders() {
        return map;
    }

    public static class NingHttpHeadersBuilder {

        private final Map<String, Collection<String>> map;

        private NingHttpHeadersBuilder() {
            map = new HashMap<>();
        }

        public NingHttpHeadersBuilder addHeader(String key, String... values) {
            map.computeIfAbsent(key, __ -> new ArrayList<>())
                    .addAll(Arrays.asList(values));
            return this;
        }

        public NingHttpHeaders build() {
            return new NingHttpHeaders(
                    new FluentCaseInsensitiveStringsMap(map));
        }

    }

}
