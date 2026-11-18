package com.gops.core;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.RouteInfo;

import androidx.annotation.Nullable;

import java.net.Inet4Address;
import java.net.InetAddress;

/** Small IPv4 helpers + "which network is my LAN" lookup. */
public final class Net {
  private Net() {}

  public static int toInt(byte[] a) {
    return ((a[0] & 0xFF) << 24) | ((a[1] & 0xFF) << 16) | ((a[2] & 0xFF) << 8) | (a[3] & 0xFF);
  }

  public static byte[] toBytes(int ip) {
    return new byte[] {(byte) (ip >>> 24), (byte) (ip >>> 16), (byte) (ip >>> 8), (byte) ip};
  }

  public static String toString(int ip) {
    return ((ip >>> 24) & 0xFF) + "." + ((ip >>> 16) & 0xFF) + "." + ((ip >>> 8) & 0xFF) + "." + (ip & 0xFF);
  }

  /** Parses a dotted IPv4 literal without touching DNS. */
  public static int parseIpv4(String s) {
    String[] parts = s.trim().split("\\.");
    if (parts.length != 4) throw new IllegalArgumentException("Invalid IPv4: " + s);
    int ip = 0;
    for (String p : parts) {
      int v = Integer.parseInt(p);
      if (v < 0 || v > 255) throw new IllegalArgumentException("Invalid IPv4: " + s);
      ip = (ip << 8) | v;
    }
    return ip;
  }

  public static int mask(int prefix) {
    return prefix == 0 ? 0 : 0xFFFFFFFF << (32 - prefix);
  }

  /**
   * RFC1918 + link-local + CGNAT (100.64/10, e.g. Tailscale). The scanner refuses anything else:
   * it is meant for your own home LAN / home servers.
   */
  public static boolean isPrivate(int ip) {
    return (ip & 0xFF000000) == 0x0A000000 // 10.0.0.0/8
        || (ip & 0xFFF00000) == 0xAC100000 // 172.16.0.0/12
        || (ip & 0xFFFF0000) == 0xC0A80000 // 192.168.0.0/16
        || (ip & 0xFFFF0000) == 0xA9FE0000 // 169.254.0.0/16
        || (ip & 0xFFC00000) == 0x64400000; // 100.64.0.0/10
  }

  /**
   * Finds the network that represents the local LAN: the active network if it is Wi-Fi/Ethernet,
   * otherwise any Wi-Fi/Ethernet network (e.g. while a third-party VPN is the default network).
   */
  @Nullable
  @SuppressWarnings("deprecation") // getAllNetworks: no non-deprecated synchronous alternative
  public static Network findLanNetwork(Context ctx) {
    ConnectivityManager cm = ctx.getSystemService(ConnectivityManager.class);
    Network active = cm.getActiveNetwork();
    if (isLan(cm, active)) return active;
    for (Network n : cm.getAllNetworks()) {
      if (isLan(cm, n)) return n;
    }
    return active;
  }

  private static boolean isLan(ConnectivityManager cm, @Nullable Network n) {
    if (n == null) return false;
    NetworkCapabilities caps = cm.getNetworkCapabilities(n);
    return caps != null
        && !caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        && (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
            || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
  }

  public static String transportName(@Nullable NetworkCapabilities caps) {
    if (caps == null) return "unknown";
    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) return "vpn";
    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return "wifi";
    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) return "ethernet";
    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) return "cellular";
    return "unknown";
  }

  @Nullable
  public static LinkAddress firstIpv4(@Nullable LinkProperties lp) {
    if (lp == null) return null;
    for (LinkAddress la : lp.getLinkAddresses()) {
      if (la.getAddress() instanceof Inet4Address) return la;
    }
    return null;
  }

  @Nullable
  public static InetAddress defaultGateway4(@Nullable LinkProperties lp) {
    if (lp == null) return null;
    for (RouteInfo r : lp.getRoutes()) {
      if (r.isDefaultRoute() && r.getGateway() instanceof Inet4Address) return r.getGateway();
    }
    return null;
  }
}
