package com.gops.dns;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.VpnService;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.gops.core.Events;
import com.gops.specs.NativeDnsMonitorSpec;

import java.util.List;

/** JS facade for the DNS VPN: consent, start/stop, live query stream, blocklist. */
public class DnsMonitorModule extends NativeDnsMonitorSpec implements ActivityEventListener {
  public static final String NAME = NativeDnsMonitorSpec.NAME;
  private static final int REQ_VPN_CONSENT = 0x6D5;

  @Nullable private Promise pendingConsent;

  private final DnsLog.Listener logListener =
      new DnsLog.Listener() {
        @Override
        public void onQuery(DnsLog.Entry e) {
          WritableMap m = entryToMap(e);
          m.putString("type", "query");
          Events.emit(getReactApplicationContext(), Events.DNS, m);
        }

        @Override
        public void onStateChanged(boolean running) {
          WritableMap m = Arguments.createMap();
          m.putString("type", "state");
          m.putBoolean("running", running);
          Events.emit(getReactApplicationContext(), Events.DNS, m);
        }
      };

  public DnsMonitorModule(ReactApplicationContext ctx) {
    super(ctx);
    ctx.addActivityEventListener(this);
    DnsLog.setListener(logListener);
  }

  @Override
  public void prepareVpn(Promise promise) {
    Context ctx = getReactApplicationContext();
    Intent consent = VpnService.prepare(ctx);
    if (consent == null) {
      promise.resolve(true);
      return;
    }
    Activity activity = getReactApplicationContext().getCurrentActivity();
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No foreground activity to show VPN consent");
      return;
    }
    if (pendingConsent != null) pendingConsent.resolve(false);
    pendingConsent = promise;
    activity.startActivityForResult(consent, REQ_VPN_CONSENT);
  }

  @Override
  public void onActivityResult(Activity activity, int requestCode, int resultCode, @Nullable Intent data) {
    if (requestCode != REQ_VPN_CONSENT || pendingConsent == null) return;
    pendingConsent.resolve(resultCode == Activity.RESULT_OK);
    pendingConsent = null;
  }

  @Override
  public void onNewIntent(Intent intent) {
    // not used
  }

  @Override
  public void start(String upstream, Promise promise) {
    Context ctx = getReactApplicationContext();
    if (VpnService.prepare(ctx) != null) {
      promise.reject("E_NOT_PREPARED", "Call prepareVpn() first");
      return;
    }
    Intent i =
        new Intent(ctx, DnsVpnService.class)
            .setAction(DnsVpnService.ACTION_START)
            .putExtra(DnsVpnService.EXTRA_UPSTREAM, upstream);
    ctx.startService(i);
    promise.resolve(true);
  }

  @Override
  public void stop() {
    Context ctx = getReactApplicationContext();
    ctx.startService(new Intent(ctx, DnsVpnService.class).setAction(DnsVpnService.ACTION_STOP));
  }

  @Override
  public void getStatus(Promise promise) {
    WritableMap m = Arguments.createMap();
    m.putBoolean("running", DnsLog.isRunning());
    m.putString("upstream", DnsLog.upstream());
    m.putString("virtualDns", DnsVpnService.VIRTUAL_DNS);
    m.putDouble("queries", DnsLog.queryCount());
    m.putDouble("blocked", DnsLog.blockedCount());
    promise.resolve(m);
  }

  @Override
  public void getRecent(double limit, Promise promise) {
    WritableArray arr = Arguments.createArray();
    for (DnsLog.Entry e : DnsLog.recent((int) limit)) arr.pushMap(entryToMap(e));
    promise.resolve(arr);
  }

  @Override
  public void clearRecent() {
    DnsLog.clear();
  }

  @Override
  public void getBlocklist(Promise promise) {
    promise.resolve(toArray(DnsBlocklist.get(getReactApplicationContext()).list()));
  }

  @Override
  public void setBlocked(String domain, boolean blocked, Promise promise) {
    promise.resolve(toArray(DnsBlocklist.get(getReactApplicationContext()).set(domain, blocked)));
  }

  @Override
  public void invalidate() {
    DnsLog.setListener(null);
    getReactApplicationContext().removeActivityEventListener(this);
    super.invalidate();
  }

  // ------------------------------------------------------------------------------ helpers

  private static WritableMap entryToMap(DnsLog.Entry e) {
    WritableMap m = Arguments.createMap();
    m.putDouble("id", e.id);
    m.putDouble("timestamp", e.timestamp);
    m.putString("domain", e.domain);
    m.putString("qtype", e.qtype);
    m.putInt("uid", e.uid);
    m.putString("packageName", e.packageName);
    m.putString("appLabel", e.appLabel);
    m.putBoolean("blocked", e.blocked);
    m.putString("rcode", e.rcode);
    m.putArray("answers", toArray(e.answers));
    m.putDouble("latencyMs", e.latencyMs);
    return m;
  }

  private static WritableArray toArray(List<String> list) {
    WritableArray a = Arguments.createArray();
    for (String s : list) a.pushString(s);
    return a;
  }
}
