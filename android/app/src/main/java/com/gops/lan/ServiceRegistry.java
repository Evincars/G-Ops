package com.gops.lan;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;

/** Port presets + port -> service name table (biased towards home-lab services). */
public final class ServiceRegistry {
  private ServiceRegistry() {}

  /** Approximation of nmap's top-100 TCP ports. */
  static final int[] TOP_100 = {
    7, 9, 13, 21, 22, 23, 25, 26, 37, 53, 79, 80, 81, 88, 106, 110, 111, 113, 119, 135, 139, 143,
    144, 179, 199, 389, 427, 443, 444, 445, 465, 513, 514, 515, 543, 544, 548, 554, 587, 631, 646,
    873, 990, 993, 995, 1025, 1026, 1027, 1028, 1029, 1110, 1433, 1720, 1723, 1755, 1900, 2000,
    2001, 2049, 2121, 2717, 3000, 3128, 3306, 3389, 3986, 4899, 5000, 5009, 5051, 5060, 5101, 5190,
    5357, 5432, 5631, 5666, 5800, 5900, 6000, 6001, 6646, 7070, 8000, 8008, 8009, 8080, 8081, 8443,
    8888, 9100, 9999, 10000, 32768, 49152, 49153, 49154, 49155, 49156, 49157
  };

  /** Typical self-hosted / home-server services. */
  static final int[] HOMELAB = {
    21, 22, 23, 25, 53, 80, 81, 111, 139, 143, 443, 445, 548, 554, 631, 853, 873, 993, 1194, 1400,
    1883, 2049, 2375, 2376, 3000, 3001, 3306, 3389, 3478, 4443, 5000, 5001, 5055, 5432, 5601, 5672,
    5900, 6379, 6443, 6767, 7878, 8000, 8006, 8008, 8009, 8080, 8081, 8083, 8086, 8096, 8123, 8181,
    8200, 8384, 8443, 8448, 8686, 8787, 8888, 8920, 8989, 9000, 9090, 9091, 9100, 9117, 9200, 9443,
    9696, 10000, 11434, 19999, 25565, 27017, 32400, 51413
  };

  private static final Map<Integer, String> NAMES = new HashMap<>();

  static {
    String[] table = {
      "7:echo", "9:discard", "13:daytime", "21:ftp", "22:ssh", "23:telnet", "25:smtp", "37:time",
      "53:dns", "79:finger", "80:http", "81:http-alt", "88:kerberos", "110:pop3", "111:rpcbind",
      "113:ident", "119:nntp", "135:msrpc", "139:netbios-ssn", "143:imap", "179:bgp", "389:ldap",
      "427:svrloc", "443:https", "445:smb", "465:smtps", "513:rlogin", "514:rsh", "515:printer",
      "548:afp", "554:rtsp", "587:submission", "631:ipp/cups", "636:ldaps", "853:dns-over-tls",
      "873:rsync", "990:ftps", "993:imaps", "995:pop3s", "1194:openvpn", "1400:sonos",
      "1433:mssql", "1723:pptp", "1883:mqtt", "1900:upnp", "2049:nfs", "2375:docker",
      "2376:docker-tls", "3000:grafana/node", "3001:uptime-kuma", "3128:squid", "3306:mysql",
      "3389:rdp", "3478:stun/turn", "4443:https-alt", "5000:synology/upnp", "5001:synology-https",
      "5055:overseerr", "5060:sip", "5357:wsdapi", "5432:postgresql", "5601:kibana", "5672:amqp",
      "5900:vnc", "6379:redis", "6443:kubernetes-api", "6767:bazarr", "7878:radarr",
      "8000:http-alt", "8006:proxmox-https", "8008:http/chromecast", "8009:ajp/chromecast",
      "8080:http-proxy", "8081:http-alt", "8083:http-alt", "8086:influxdb", "8096:jellyfin",
      "8123:home-assistant", "8181:tautulli", "8200:vault/duplicati", "8384:syncthing",
      "8443:https-alt", "8448:matrix-fed", "8686:lidarr", "8787:readarr", "8888:http-alt",
      "8920:jellyfin-https", "8989:sonarr", "9000:portainer/minio", "9090:prometheus/cockpit",
      "9091:transmission", "9100:jetdirect/node-exporter", "9117:jackett", "9200:elasticsearch",
      "9443:portainer-https", "9696:prowlarr", "9999:abyss", "10000:webmin", "11434:ollama",
      "19999:netdata", "25565:minecraft", "27017:mongodb", "32400:plex", "51413:bittorrent",
      "62078:iphone-sync"
    };
    for (String e : table) {
      int i = e.indexOf(':');
      NAMES.put(Integer.parseInt(e.substring(0, i)), e.substring(i + 1));
    }
  }

  public static String name(int port) {
    String n = NAMES.get(port);
    return n == null ? "unknown" : n;
  }

  /** "top100" | "homelab" | "all" | "1-1024" | "22,80,443,8000-8100" (presets can be combined). */
  public static int[] parsePorts(String spec) {
    TreeSet<Integer> ports = new TreeSet<>();
    for (String raw : spec.split(",")) {
      String t = raw.trim().toLowerCase(Locale.ROOT);
      if (t.isEmpty()) continue;
      switch (t) {
        case "top100":
          for (int p : TOP_100) ports.add(p);
          break;
        case "homelab":
          for (int p : HOMELAB) ports.add(p);
          break;
        case "all":
          for (int p = 1; p <= 65535; p++) ports.add(p);
          break;
        default:
          if (t.contains("-")) {
            String[] r = t.split("-");
            int a = checkPort(Integer.parseInt(r[0].trim()));
            int b = checkPort(Integer.parseInt(r[1].trim()));
            for (int p = Math.min(a, b); p <= Math.max(a, b); p++) ports.add(p);
          } else {
            ports.add(checkPort(Integer.parseInt(t)));
          }
      }
    }
    if (ports.isEmpty()) throw new IllegalArgumentException("No ports");
    int[] out = new int[ports.size()];
    int i = 0;
    for (int p : ports) out[i++] = p;
    return out;
  }

  private static int checkPort(int p) {
    if (p < 1 || p > 65535) throw new IllegalArgumentException("Port out of range: " + p);
    return p;
  }

  static boolean isHttpLike(int port) {
    switch (port) {
      case 80: case 81: case 3000: case 3001: case 5000: case 5055: case 6767: case 7878:
      case 8000: case 8008: case 8080: case 8081: case 8083: case 8086: case 8096: case 8123:
      case 8181: case 8200: case 8384: case 8686: case 8787: case 8888: case 8989: case 9000:
      case 9090: case 9091: case 9117: case 9200: case 9696: case 10000: case 11434: case 19999:
      case 32400:
        return true;
      default:
        return false;
    }
  }

  static boolean isTls(int port) {
    switch (port) {
      case 443: case 465: case 636: case 853: case 990: case 993: case 995: case 2376: case 4443:
      case 5001: case 6443: case 8006: case 8443: case 8448: case 8920: case 9443:
        return true;
      default:
        return false;
    }
  }
}
