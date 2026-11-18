package com.gops.dns;

import androidx.annotation.Nullable;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Just enough DNS (RFC 1035) to log queries, read answers and synthesize block responses. */
final class DnsPacket {
  static final int RCODE_NOERROR = 0;
  static final int RCODE_SERVFAIL = 2;
  static final int RCODE_NXDOMAIN = 3;

  private DnsPacket() {}

  static final class Question {
    final String name;
    final int qtype;
    /** Offset right after the first question – used to build a response. */
    final int end;

    Question(String name, int qtype, int end) {
      this.name = name;
      this.qtype = qtype;
      this.end = end;
    }
  }

  static final class Response {
    final int rcode;
    final List<String> answers;

    Response(int rcode, List<String> answers) {
      this.rcode = rcode;
      this.answers = answers;
    }
  }

  @Nullable
  static Question parseQuery(byte[] m) {
    if (m.length < 12) return null;
    if ((m[2] & 0x80) != 0) return null; // QR set -> not a query
    if (IpPacket.u16(m, 4) < 1) return null;
    try {
      int[] next = new int[1];
      String name = readName(m, 12, next);
      int p = next[0];
      if (p + 4 > m.length) return null;
      return new Question(name.toLowerCase(Locale.ROOT), IpPacket.u16(m, p), p + 4);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  /** Parses rcode + A/AAAA/CNAME answers (best effort). */
  static Response parseResponse(byte[] m) {
    List<String> answers = new ArrayList<>();
    if (m.length < 12) return new Response(RCODE_SERVFAIL, answers);
    int rcode = m[3] & 0x0F;
    int qd = IpPacket.u16(m, 4);
    int an = IpPacket.u16(m, 6);
    try {
      int[] next = new int[1];
      int p = 12;
      for (int i = 0; i < qd; i++) {
        readName(m, p, next);
        p = next[0] + 4;
      }
      for (int i = 0; i < an && p < m.length; i++) {
        readName(m, p, next);
        p = next[0];
        if (p + 10 > m.length) break;
        int type = IpPacket.u16(m, p);
        int rdLen = IpPacket.u16(m, p + 8);
        int rd = p + 10;
        if (rd + rdLen > m.length) break;
        if (type == 1 && rdLen == 4) {
          answers.add(InetAddress.getByAddress(Arrays.copyOfRange(m, rd, rd + 4)).getHostAddress());
        } else if (type == 28 && rdLen == 16) {
          answers.add(InetAddress.getByAddress(Arrays.copyOfRange(m, rd, rd + 16)).getHostAddress());
        } else if (type == 5) {
          answers.add("CNAME " + readName(m, rd, next));
        }
        p = rd + rdLen;
      }
    } catch (IllegalArgumentException | UnknownHostException ignored) {
      // malformed / truncated – keep what we have
    }
    return new Response(rcode, answers);
  }

  /** Header + first question of the query, flagged as a response with the given rcode. */
  static byte[] buildErrorResponse(byte[] query, Question q, int rcode) {
    byte[] r = Arrays.copyOf(query, q.end);
    r[2] = (byte) (0x80 | (query[2] & 0x79)); // QR=1, keep opcode + RD, clear AA/TC
    r[3] = (byte) (0x80 | (rcode & 0x0F)); // RA=1
    IpPacket.put16(r, 4, 1); // QDCOUNT
    IpPacket.put16(r, 6, 0); // ANCOUNT
    IpPacket.put16(r, 8, 0); // NSCOUNT
    IpPacket.put16(r, 10, 0); // ARCOUNT (drops EDNS OPT)
    return r;
  }

  static String rcodeName(int rcode) {
    switch (rcode) {
      case 0:
        return "NOERROR";
      case 1:
        return "FORMERR";
      case 2:
        return "SERVFAIL";
      case 3:
        return "NXDOMAIN";
      case 5:
        return "REFUSED";
      default:
        return "RCODE" + rcode;
    }
  }

  static String typeName(int t) {
    switch (t) {
      case 1:
        return "A";
      case 2:
        return "NS";
      case 5:
        return "CNAME";
      case 6:
        return "SOA";
      case 12:
        return "PTR";
      case 15:
        return "MX";
      case 16:
        return "TXT";
      case 28:
        return "AAAA";
      case 33:
        return "SRV";
      case 64:
        return "SVCB";
      case 65:
        return "HTTPS";
      case 255:
        return "ANY";
      default:
        return "TYPE" + t;
    }
  }

  /** Reads a (possibly compressed) domain name. next[0] = offset after the name at {@code start}. */
  static String readName(byte[] m, int start, int[] next) {
    StringBuilder sb = new StringBuilder();
    int pos = start;
    int after = -1;
    int hops = 0;
    while (true) {
      if (pos >= m.length) throw new IllegalArgumentException("name overflow");
      int len = m[pos] & 0xFF;
      if (len == 0) {
        pos++;
        break;
      }
      if ((len & 0xC0) == 0xC0) {
        if (pos + 1 >= m.length) throw new IllegalArgumentException("bad pointer");
        if (after < 0) after = pos + 2;
        pos = ((len & 0x3F) << 8) | (m[pos + 1] & 0xFF);
        if (++hops > 32) throw new IllegalArgumentException("pointer loop");
        continue;
      }
      if ((len & 0xC0) != 0) throw new IllegalArgumentException("bad label");
      pos++;
      if (pos + len > m.length) throw new IllegalArgumentException("label overflow");
      if (sb.length() > 0) sb.append('.');
      for (int i = 0; i < len; i++) sb.append((char) (m[pos + i] & 0xFF));
      pos += len;
    }
    next[0] = after >= 0 ? after : pos;
    return sb.toString();
  }
}
