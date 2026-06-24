import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import records from './data.json';

interface CementRecord {
  date: string;
  month_label: string;
  entry_type: string;
  vehicle_no: string | null;
  company: string | null;
  inward_total: number;
  cem1_qty: number;
  cem2_qty: number;
  cem3_qty: number;
  consumption_text: string | null;
  cem1_consumption: number;
  cem2_consumption: number;
  cem3_consumption: number;
  cem1_balance: number | null;
  cem2_balance: number | null;
  cem3_balance: number | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const run = searchParams.get('run');
  const force = searchParams.get('force'); // ?force=1 clears and re-imports

  const database = db();
  const rows = records as CementRecord[];

  const inwardCount = rows.filter(r => r.entry_type === 'INWARD').length;
  const consumptionCount = rows.filter(r => r.entry_type === 'CONSUMPTION').length;
  const months = [...new Set(rows.map(r => r.month_label))];

  if (!run) {
    const existing = await database.get(`SELECT COUNT(*) as cnt FROM rmc_cement`);
    return NextResponse.json({
      message: 'RMC cement import — add ?run=1 to import, ?run=1&force=1 to clear and re-import',
      total_in_file: rows.length,
      inward_records: inwardCount,
      consumption_records: consumptionCount,
      months,
      existing_records: existing?.cnt ?? 0,
    });
  }

  const existing = await database.get(`SELECT COUNT(*) as cnt FROM rmc_cement`);
  const existingCount = Number(existing?.cnt ?? 0);

  if (existingCount > 0 && !force) {
    return NextResponse.json(
      { error: `Already imported: ${existingCount} records. Use ?run=1&force=1 to clear and re-import.`, count: existingCount },
      { status: 409 }
    );
  }

  if (existingCount > 0 && force) {
    await database.run(`DELETE FROM rmc_cement`);
  }

  let inserted = 0;
  for (const r of rows) {
    await database.run(
      `INSERT INTO rmc_cement
        (date, month_label, entry_type, vehicle_no, company,
         inward_total, cem1_qty, cem2_qty, cem3_qty,
         consumption_text, cem1_consumption, cem2_consumption, cem3_consumption,
         cem1_balance, cem2_balance, cem3_balance)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      r.date, r.month_label, r.entry_type, r.vehicle_no, r.company,
      r.inward_total, r.cem1_qty, r.cem2_qty, r.cem3_qty,
      r.consumption_text, r.cem1_consumption, r.cem2_consumption, r.cem3_consumption,
      r.cem1_balance, r.cem2_balance, r.cem3_balance
    );
    inserted++;
  }

  return NextResponse.json({
    success: true,
    inserted,
    cleared: existingCount > 0 && !!force,
    message: `Done. ${inserted} cement records imported (${inwardCount} inward + ${consumptionCount} consumption). Aug 2025 – Jun 2026.`,
  });
}
