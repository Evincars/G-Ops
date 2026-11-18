package com.gops.dns;

import androidx.annotation.Nullable;

import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;

/** Minimal IPv4 + UDP parsing/building for the TUN interface. */
final class IpPacket {
  private static final int PROTO_UDP = 17;
  private static final AtomicInteger IDS = new AtomicInteger(1);

  static final class Udp {
    final byte[] srcIp;
    final byte[] dstIp;
    final int srcPort;
    final int dstPort;
    final byte[] payload;

    Udp(byte[] srcIp, byte[] dstIp, int srcPort, int dstPort, byte[] payload) {
      this.srcIp = srcIp;
      this.dstIp = dstIp;
      this.srcPort = srcPort;
      this.dstPort = dstPort;
      this.payload = payload;
    }
  }

  private IpPacket() {}

  /** Returns null for anything that isn't an unfragmented IPv4/UDP datagram. */
  @Nullable
  static Udp parseIpv4Udp(byte[] b, int len) {
    if (len < 28) return null;
    if (((b[0] >> 4) & 0x0F) != 4) return null;
    int ihl = (b[0] & 0x0F) * 4;
    if (ihl < 20 || len < ihl + 8) return null;
    if ((b[9] & 0xFF) != PROTO_UDP) return null;
    int totalLen = u16(b, 2);
    if (totalLen > len || totalLen < ihl + 8) return null;
    if ((u16(b, 6) & 0x3FFF) != 0) return null; // MF flag or fragment offset set
    int udpLen = u16(b, ihl + 4);
    if (udpLen < 8 || ihl + udpLen > totalLen) return null;
    return new Udp(
        Arrays.copyOfRange(b, 12, 16),
        Arrays.copyOfRange(b, 16, 20),
        u16(b, ihl),
        u16(b, ihl + 2),
        Arrays.copyOfRange(b, ihl + 8, ihl + udpLen));
  }

  static byte[] buildIpv4Udp(byte[] src, byte[] dst, int srcPort, int dstPort, byte[] payload) {
    int udpLen = 8 + payload.length;
    int total = 20 + udpLen;
    byte[] p = new byte[total];
    p[0] = 0x45; // v4, IHL=5
    put16(p, 2, total);
    put16(p, 4, IDS.getAndIncrement() & 0xFFFF);
    put16(p, 6, 0x4000); // don't fragment
    p[8] = 64; // TTL
    p[9] = PROTO_UDP;
    System.arraycopy(src, 0, p, 12, 4);
    System.arraycopy(dst, 0, p, 16, 4);
    put16(p, 10, checksum(p, 0, 20, 0));

    put16(p, 20, srcPort);
    put16(p, 22, dstPort);
    put16(p, 24, udpLen);
    System.arraycopy(payload, 0, p, 28, payload.length);
    put16(p, 26, udpChecksum(p, udpLen));
    return p;
  }

  private static int udpChecksum(byte[] p, int udpLen) {
    // pseudo header: src, dst, zero, proto, udp length
    long sum = 0;
    for (int i = 12; i < 20; i += 2) sum += u16(p, i);
    sum += PROTO_UDP;
    sum += udpLen;
    int c = checksum(p, 20, udpLen, sum);
    return c == 0 ? 0xFFFF : c;
  }

  private static int checksum(byte[] b, int off, int len, long initial) {
    long sum = initial;
    int i = off;
    int end = off + len;
    while (i + 1 < end) {
      sum += u16(b, i);
      i += 2;
    }
    if (i < end) sum += (b[i] & 0xFF) << 8;
    while ((sum >> 16) != 0) sum = (sum & 0xFFFF) + (sum >> 16);
    return (int) (~sum & 0xFFFF);
  }

  static int u16(byte[] b, int off) {
    return ((b[off] & 0xFF) << 8) | (b[off + 1] & 0xFF);
  }

  static void put16(byte[] b, int off, int v) {
    b[off] = (byte) (v >> 8);
    b[off + 1] = (byte) v;
  }
}
