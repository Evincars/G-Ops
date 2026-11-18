package com.gops.wifi;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.gops.core.Events;
import com.gops.core.Net;
import com.gops.specs.NativeWifiScannerSpec;

import java.util.List;

/**
 * Wi-Fi scanner. On GrapheneOS you can disable "Wi-Fi scan throttling" in Developer options;
 * otherwise Android allows ~4 scans per 2 minutes for a foreground app.
 */
public class WifiScannerModule extends NativeWifiScannerSpec {
  public static final String NAME = NativeWifiScannerSpec.NAME;
  private static final long MIN_INTERVAL_MS = 2_000;

  private final WifiManager wifi;
  private final Handler main = new Handler(Looper.getMainLooper());
  private boolean receiverRegistered;
  private volatile boolean autoScan;
  private volatile long intervalMs = 10_000;

  private final BroadcastReceiver scanReceiver =
      new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
          boolean updated = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false);
          emitResults(updated);
        }
      };

  private final Runnable autoScanTick =
      new Runnable() {
        @Override
        public void run() {
          if (!autoScan) return;
          triggerScan();
          main.postDelayed(this, intervalMs);
        }
      };

  public WifiScannerModule(ReactApplicationContext ctx) {
    super(ctx);
    wifi = ctx.getApplicationContext().getSystemService(WifiManager.class);
  }

  // ---------------------------------------------------------------------------------- API

  @Override
  public void getStatus(Promise promise) {
    Context ctx = getReactApplicationContext();
    LocationManager lm = ctx.getSystemService(LocationManager.class);
    WritableMap m = Arguments.createMap();
    m.putBoolean("wifiEnabled", wifi.isWifiEnabled());
    m.putBoolean("locationEnabled", lm != null && lm.isLocationEnabled());
    m.putBoolean("scanThrottleEnabled", wifi.isScanThrottleEnabled());
    m.putBoolean("autoScan", autoScan);
    m.putDouble("autoScanIntervalMs", intervalMs);
    promise.resolve(m);
  }

  @Override
  public void startScan(Promise promise) {
    if (!hasScanPermission()) {
      promise.reject("E_PERMISSION", "ACCESS_FINE_LOCATION / NEARBY_WIFI_DEVICES not granted");
      return;
    }
    promise.resolve(triggerScan());
  }

  @Override
  public void getScanResults(Promise promise) {
    if (!hasScanPermission()) {
      promise.reject("E_PERMISSION", "ACCESS_FINE_LOCATION / NEARBY_WIFI_DEVICES not granted");
      return;
    }
    promise.resolve(collectResults());
  }

  @Override
  @SuppressWarnings("deprecation") // getConnectionInfo still returns full data with location perm
  public void getConnectionInfo(Promise promise) {
    WifiInfo info = wifi.getConnectionInfo();
    if (info == null || info.getNetworkId() == -1) {
      promise.resolve(null);
      return;
    }
    String ssid = info.getSSID();
    if (ssid != null && ssid.length() >= 2 && ssid.startsWith("\"") && ssid.endsWith("\"")) {
      ssid = ssid.substring(1, ssid.length() - 1);
    }
    WritableMap m = Arguments.createMap();
    m.putString("ssid", ssid == null ? "" : ssid);
    m.putString("bssid", info.getBSSID() == null ? "" : info.getBSSID());
    m.putInt("rssi", info.getRssi());
    m.putInt("frequency", info.getFrequency());
    m.putInt("linkSpeedMbps", info.getLinkSpeed());
    m.putInt("txLinkSpeedMbps", info.getTxLinkSpeedMbps());
    m.putInt("rxLinkSpeedMbps", info.getRxLinkSpeedMbps());
    m.putString(
        "wifiStandard",
        WifiParser.wifiStandard(info.getWifiStandard(), WifiParser.band(info.getFrequency())));

    String ip = "";
    ConnectivityManager cm = getReactApplicationContext().getSystemService(ConnectivityManager.class);
    LinkAddress la = Net.firstIpv4(cm.getLinkProperties(Net.findLanNetwork(getReactApplicationContext())));
    if (la != null) ip = la.getAddress().getHostAddress();
    m.putString("ipAddress", ip);
    promise.resolve(m);
  }

  @Override
  public void setAutoScan(boolean enabled, double interval) {
    intervalMs = Math.max(MIN_INTERVAL_MS, (long) interval);
    autoScan = enabled;
    main.removeCallbacks(autoScanTick);
    if (enabled) {
      ensureReceiver();
      main.post(autoScanTick);
    }
  }

  @Override
  public void invalidate() {
    autoScan = false;
    main.removeCallbacks(autoScanTick);
    if (receiverRegistered) {
      try {
        getReactApplicationContext().unregisterReceiver(scanReceiver);
      } catch (IllegalArgumentException ignored) {
        // already unregistered
      }
      receiverRegistered = false;
    }
    super.invalidate();
  }

  // ---------------------------------------------------------------------------------- internals

  @SuppressWarnings("deprecation") // startScan: deprecated but still the only way to request a scan
  private boolean triggerScan() {
    ensureReceiver();
    if (!hasScanPermission()) return false;
    boolean accepted = wifi.startScan();
    if (!accepted) {
      // Throttled or busy – still push the cached results so the UI refreshes "age".
      emitResults(false);
    }
    return accepted;
  }

  private synchronized void ensureReceiver() {
    if (receiverRegistered) return;
    IntentFilter filter = new IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION);
    getReactApplicationContext().registerReceiver(scanReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    receiverRegistered = true;
  }

  private WritableArray collectResults() {
    WritableArray arr = Arguments.createArray();
    List<ScanResult> results = wifi.getScanResults();
    if (results != null) {
      for (ScanResult r : results) arr.pushMap(WifiParser.toMap(r));
    }
    return arr;
  }

  private void emitResults(boolean success) {
    if (!hasScanPermission()) return;
    WritableMap payload = Arguments.createMap();
    payload.putBoolean("success", success);
    payload.putDouble("timestamp", System.currentTimeMillis());
    payload.putArray("results", collectResults());
    Events.emit(getReactApplicationContext(), Events.WIFI_SCAN, payload);
  }

  private boolean hasScanPermission() {
    Context ctx = getReactApplicationContext();
    return ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
        == PackageManager.PERMISSION_GRANTED;
  }
}
