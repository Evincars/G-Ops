package com.gops.dns;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Persisted domain blocklist. Blocking "example.com" also blocks "ads.example.com". */
public final class DnsBlocklist {
  private static final String PREFS = "gops_dns";
  private static final String KEY = "blocklist";
  private static volatile DnsBlocklist instance;

  private final SharedPreferences prefs;
  private final Set<String> domains = ConcurrentHashMap.newKeySet();

  private DnsBlocklist(Context ctx) {
    prefs = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    domains.addAll(prefs.getStringSet(KEY, Collections.emptySet()));
  }

  public static DnsBlocklist get(Context ctx) {
    DnsBlocklist i = instance;
    if (i == null) {
      synchronized (DnsBlocklist.class) {
        i = instance;
        if (i == null) instance = i = new DnsBlocklist(ctx);
      }
    }
    return i;
  }

  public boolean isBlocked(String domain) {
    String d = normalize(domain);
    while (!d.isEmpty()) {
      if (domains.contains(d)) return true;
      int dot = d.indexOf('.');
      if (dot < 0) return false;
      d = d.substring(dot + 1);
    }
    return false;
  }

  public synchronized List<String> set(String domain, boolean blocked) {
    String d = normalize(domain);
    if (!d.isEmpty()) {
      if (blocked) domains.add(d);
      else domains.remove(d);
      prefs.edit().putStringSet(KEY, new HashSet<>(domains)).apply();
    }
    return list();
  }

  public List<String> list() {
    List<String> l = new ArrayList<>(domains);
    Collections.sort(l);
    return l;
  }

  private static String normalize(String domain) {
    String d = domain == null ? "" : domain.trim().toLowerCase(Locale.ROOT);
    while (d.endsWith(".")) d = d.substring(0, d.length() - 1);
    if (d.startsWith("*.")) d = d.substring(2);
    return d;
  }
}
