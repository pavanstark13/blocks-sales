import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const type = searchParams.get('type');

  const database = db();

  let sql = `SELECT * FROM rmc_cement`;
  const params: string[] = [];
  const conditions: string[] = [];

  if (month) { conditions.push(`month_label = ?`); params.push(month); }
  if (type) { conditions.push(`entry_type = ?`); params.push(type.toUpperCase()); }
  if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
  sql += ` ORDER BY date ASC, id ASC`;

  const rows = await database.all(sql, ...params);
  return NextResponse.json({ rows, total: rows.length });
}
