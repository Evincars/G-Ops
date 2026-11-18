package com.gops.wifi;

import android.net.MacAddress;
import android.net.wifi.ScanResult;
import android.os.SystemClock;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

import java.util.Locale;

/** Converts {@link ScanResult} into JS-friendly maps: channel, band, width, security, standard. */
public final class WifiParser {
  private WifiParser() {}

  public static int freqToChannel(int f) {
    if (f == 2484) return 14;
    if (f >= 2412 && f <= 2472) return (f - 2407) / 5;
    if (f >= 4910 && f <= 4980) return (f - 4000) / 5; // 4.9 GHz (JP)
    if (f >= 5150 && f <= 5895) return (f - 5000) / 5;
    if (f == 5935) return 2; // 6 GHz channel 2
    if (f >= 5955 && f <= 7115) return (f - 5950) / 5;
    if (f >= 58320 && f <= 70200) return (f - 56160) / 2160; // 60 GHz (802.11ad/ay)
    return -1;
  }

  public static String band(int f) {
    if (f < 3000) return "2.4";
    if (f < 5900) return "5";
    if (f < 7200) return "6";
    return "60";
  }

  public static int widthMhz(int channelWidth) {
    switch (channelWidth) {
      case ScanResult.CHANNEL_WIDTH_40MHZ:
        return 40;
      case ScanResult.CHANNEL_WIDTH_80MHZ:
        return 80;
      case ScanResult.CHANNEL_WIDTH_160MHZ:
      case ScanResult.CHANNEL_WIDTH_80MHZ_PLUS_MHZ:
        return 160;
      case ScanResult.CHANNEL_WIDTH_320MHZ:
        return 320;
      case ScanResult.CHANNEL_WIDTH_20MHZ:
      default:
        return 20;
    }
  }

  /**
   * Parses Android's capability string, e.g. {@code [WPA2-PSK-CCMP][RSN-PSK+SAE-CCMP][ESS][MFPC]}.
   */
  public static String security(String capabilities) {
    String c = capabilities == null ? "" : capabilities.toUpperCase(Locale.ROOT);
    boolean eap = c.contains("EAP");
    boolean sae = c.contains("SAE");
    boolean psk = c.contains("PSK");
    boolean owe = c.contains("OWE");
    boolean wep = c.contains("WEP");
    boolean rsn = c.contains("RSN") || c.contains("WPA2");
    boolean wpa1 = c.contains("[WPA-");

    if (eap) {
      if (c.contains("SUITE_B") || c.contains("EAP_SUITE_B_192")) return "WPA3-EAP-192";
      return rsn ? "WPA2-EAP" : "WPA-EAP";
    }
    if (owe) return "OWE";
    if (sae && psk) return "WPA2/WPA3";
    if (sae) return "WPA3";
    if (rsn && psk) return wpa1 ? "WPA/WPA2" : "WPA2";
    if (wpa1) return "WPA";
    if (wep) return "WEP";
    return "OPEN";
  }

  public static String wifiStandard(int std, String band) {
    switch (std) {
      case ScanResult.WIFI_STANDARD_LEGACY:
        return "802.11a/b/g";
      case ScanResult.WIFI_STANDARD_11N:
        return "Wi-Fi 4 (n)";
      case ScanResult.WIFI_STANDARD_11AC:
        return "Wi-Fi 5 (ac)";
      case ScanResult.WIFI_STANDARD_11AX:
        return "6".equals(band) ? "Wi-Fi 6E (ax)" : "Wi-Fi 6 (ax)";
      case ScanResult.WIFI_STANDARD_11AD:
        return "WiGig (ad)";
      case ScanResult.WIFI_STANDARD_11BE:
        return "Wi-Fi 7 (be)";
      default:
        return "unknown";
    }
  }

  @SuppressWarnings("deprecation") // ScanResult.SSID is still populated and is unquoted
  public static WritableMap toMap(ScanResult r) {
    WritableMap m = Arguments.createMap();
    String ssid = r.SSID == null ? "" : r.SSID;
    int width = widthMhz(r.channelWidth);
    int center = (width > 20 && r.centerFreq0 > 0) ? r.centerFreq0 : r.frequency;
    String band = band(r.frequency);
    MacAddress mld = r.getApMldMacAddress();
    long ageMs = Math.max(0, SystemClock.elapsedRealtime() - r.timestamp / 1000);

    m.putString("ssid", ssid);
    m.putString("bssid", r.BSSID == null ? "" : r.BSSID);
    m.putBoolean("hidden", ssid.isEmpty());
    m.putInt("level", r.level);
    m.putInt("frequency", r.frequency);
    m.putInt("centerFrequency", center);
    m.putInt("channel", freqToChannel(r.frequency));
    m.putInt("centerChannel", freqToChannel(center));
    m.putString("band", band);
    m.putInt("channelWidth", width);
    m.putString("security", security(r.capabilities));
    m.putString("capabilities", r.capabilities == null ? "" : r.capabilities);
    m.putString("wifiStandard", wifiStandard(r.getWifiStandard(), band));
    m.putBoolean("wps", r.capabilities != null && r.capabilities.contains("[WPS]"));
    m.putString("mldMac", mld == null ? "" : mld.toString());
    m.putBoolean("rttResponder", r.is80211mcResponder());
    m.putDouble("ageMs", ageMs);
    return m;
  }
}
