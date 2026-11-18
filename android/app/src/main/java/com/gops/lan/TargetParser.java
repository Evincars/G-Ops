package com.gops.lan;

import com.gops.core.Net;

import java.util.ArrayList;
import java.util.List;

/**
 * Parses scan targets (IPv4 only):
 *
 * <ul>
 *   <li>{@code 192.168.1.0/24} – CIDR (prefix 16..32; network/broadcast skipped for /≤30)
 *   <li>{@code 192.168.1.10-50} or {@code 192.168.1.10-192.168.1.50} – range
 *   <li>{@code 192.168.1.10} – single host; several targets can be comma separated
 * </ul>
 *
 * Every address must be private (see {@link Net#isPrivate(int)}).
 */
public final class TargetParser {
  public static final int MAX_HOSTS = 65_536;

  private TargetParser() {}

  public static List<Integer> parse(String spec) {
    List<Integer> out = new ArrayList<>();
    for (String raw : spec.split(",")) {
      String t = raw.trim();
      if (t.isEmpty()) continue;
      if (t.contains("/")) parseCidr(t, out);
      else if (t.contains("-")) parseRange(t, out);
      else add(out, Net.parseIpv4(t));
      if (out.size() > MAX_HOSTS) throw new IllegalArgumentException("Too many hosts (max /16)");
    }
    if (out.isEmpty()) throw new IllegalArgumentException("Empty target");
    return out;
  }

  private static void parseCidr(String t, List<Integer> out) {
    String[] p = t.split("/");
    int base = Net.parseIpv4(p[0]);
    int prefix = Integer.parseInt(p[1].trim());
    if (prefix < 16 || prefix > 32) throw new IllegalArgumentException("Prefix must be /16../32");
    int mask = Net.mask(prefix);
    int network = base & mask;
    long size = 1L << (32 - prefix);
    long first = 0;
    long last = size - 1;
    if (prefix <= 30) {
      first = 1; // skip network address
      last = size - 2; // skip broadcast
    }
    for (long i = first; i <= last; i++) add(out, network + (int) i);
  }

  private static void parseRange(String t, List<Integer> out) {
    String[] p = t.split("-");
    int start = Net.parseIpv4(p[0]);
    String endStr = p[1].trim();
    int end;
    if (endStr.contains(".")) {
      end = Net.parseIpv4(endStr);
    } else {
      int lastOctet = Integer.parseInt(endStr);
      if (lastOctet < 0 || lastOctet > 255) throw new IllegalArgumentException("Bad range: " + t);
      end = (start & 0xFFFFFF00) | lastOctet;
    }
    long s = start & 0xFFFFFFFFL;
    long e = end & 0xFFFFFFFFL;
    if (e < s) throw new IllegalArgumentException("Range end before start: " + t);
    if (e - s >= MAX_HOSTS) throw new IllegalArgumentException("Range too large");
    for (long ip = s; ip <= e; ip++) add(out, (int) ip);
  }

  private static void add(List<Integer> out, int ip) {
    if (!Net.isPrivate(ip)) {
      throw new IllegalArgumentException(
          Net.toString(ip) + " is not a private/LAN address – refusing to scan");
    }
    out.add(ip);
  }
}
