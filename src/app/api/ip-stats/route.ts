import { NextResponse } from 'next/server';
import { getIpStats } from '@/lib/ip-tracker';

export async function GET() {
  const stats = getIpStats();
  
  if (!stats) {
    return NextResponse.json({ 
      message: 'No stats available yet or file not found.',
      ips: {},
      totalUnique: 0 
    });
  }

  // Sort IPs by last seen descending
  const sortedIps = Object.values(stats.ips).sort((a, b) => {
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
  });

  return NextResponse.json({
    totalUnique: stats.totalUnique,
    ips: sortedIps
  });
}

