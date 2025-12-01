import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const IP_LOG_FILE = path.join(DATA_DIR, 'ip-logs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

interface IpEntry {
  ip: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
}

interface IpLogData {
  ips: Record<string, IpEntry>;
  totalUnique: number;
}

export async function trackIp(ip: string) {
  if (!ip) return;

  try {
    let data: IpLogData = { ips: {}, totalUnique: 0 };

    if (fs.existsSync(IP_LOG_FILE)) {
      const fileContent = fs.readFileSync(IP_LOG_FILE, 'utf-8');
      try {
        data = JSON.parse(fileContent);
      } catch (e) {
        console.error('Error parsing IP log file, starting fresh:', e);
      }
    }

    const now = new Date().toISOString();

    if (data.ips[ip]) {
      data.ips[ip].lastSeen = now;
      data.ips[ip].count += 1;
    } else {
      data.ips[ip] = {
        ip,
        firstSeen: now,
        lastSeen: now,
        count: 1,
      };
      data.totalUnique += 1;
    }

    // Write back to file
    fs.writeFileSync(IP_LOG_FILE, JSON.stringify(data, null, 2));
    
    // Log to stdout for Render dashboard visibility
    console.log(JSON.stringify({
      event: 'ip_tracked',
      ip,
      total_unique: data.totalUnique,
      timestamp: now
    }));

  } catch (error) {
    console.error('Failed to track IP:', error);
  }
}

export function getIpStats(): IpLogData | null {
  try {
    if (fs.existsSync(IP_LOG_FILE)) {
      const fileContent = fs.readFileSync(IP_LOG_FILE, 'utf-8');
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Failed to read IP stats:', error);
  }
  return null;
}

