import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const run = searchParams.get('run');

  const database = db();

  const preview = await database.all(
    `SELECT COUNT(*) as cnt FROM rmc_sales WHERE balance > 0 AND status = 'CLOSED'`
  );
  const toFix = Number((preview[0] as { cnt: number })?.cnt ?? 0);

  if (!run) {
    return NextResponse.json({
      message: 'RMC status fix — add ?run=1 to apply',
      records_to_fix: toFix,
      description: 'Sets status=OPEN for all rmc_sales rows where balance > 0 but status is CLOSED',
    });
  }

  await database.run(
    `UPDATE rmc_sales SET status = 'OPEN' WHERE balance > 0 AND status = 'CLOSED'`
  );

  const after = await database.all(
    `SELECT status, COUNT(*) as cnt FROM rmc_sales GROUP BY status`
  );

  return NextResponse.json({
    success: true,
    rows_updated: toFix,
    status_breakdown: after,
    message: `Done. ${toFix} records updated to OPEN.`,
  });
}
