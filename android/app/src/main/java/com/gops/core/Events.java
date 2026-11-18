package com.gops.core;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;

/**
 * Event names shared with JS ({@code src/native/events.ts}). Payloads are pushed through
 * DeviceEventEmitter, which keeps the Java side simple (no codegen event emitters needed).
 */
public final class Events {
  public static final String WIFI_SCAN = "GOps.WifiScan";
  public static final String PORT_SCAN = "GOps.PortScan";
  public static final String DNS = "GOps.Dns";

  private Events() {}

  public static void emit(ReactApplicationContext ctx, String name, WritableMap payload) {
    if (ctx == null || !ctx.hasActiveReactInstance()) return;
    ctx.emitDeviceEvent(name, payload);
  }
}
