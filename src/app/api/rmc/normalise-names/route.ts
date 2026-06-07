import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const RENAMES: Record<string, string> = {
  'Kgn Electricals':         'KGN Electricals',
  'KGN ELECTRICALS':         'KGN Electricals',
  'SRR DEVELOPERS':          'SRR Developers',
  'UMESH':                   'Umesh',
  'PRAVEEN':                 'Praveen',
  'RK CORPORATION':          'RK Corporation',
  'MSR ENTERPRISES':         'MSR Enterprises',
  'Msr Enterprises':         'MSR Enterprises',
  'PAVAN':                   'Pavan',
  'HARISH GOWDA':            'Harish Gowda',
  'DAYABHAVAN':              'Dayabhavan',
  'RELYONN INFRA PROJECTS':  'Relyonn Infra Projects',
  'GOVINDAPPA':              'Govindappa',
  'RAJESH ENGINEER':         'Rajesh Engineer',
  'KUMAR':                   'Kumar',
  'DHANANJAY':               'Dhananjay',
  'NAGANNA':                 'Naganna',
  'MAKLI GOWDRU':            'Makli Gowdru',
  'SHREE G R INFRA':         'Shree G R Infra',
  'SHIVRAJ':                 'Shivraj',
  'SECRETARY':               'Secretary',
  'MANJUNATH':               'Manjunath',
  'Tmr Construction':        'TMR Construction',
  // New customers from per-customer files
  'ANAGHAA CONSTRUCTIONS':   'Anaghaa Constructions',
  'Anaghaa Contructions':    'Anaghaa Constructions',
  'KARNATAKA INFRATECH':     'Karnataka Infratech',
  'KARNATAKA INFRA TECH':    'Karnataka Infratech',
  'PRAVRIDDHI INFRATECH':    'Pravriddhi Infratech',
  'SECRETARY BGS':           'Secretary BGS',
  'Secretary':               'Secretary BGS',
  'SGR Ground Engineering Projects': 'SGR Ground Engineering',
  'YANKEE CONSTRUCTIONS LLP': 'Yankee Constructions LLP',
  'KEB MADHU':               'KEB Madhu',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const run = searchParams.get('run');

  if (!run) {
    return NextResponse.json({
      message: 'Customer name normalisation — add ?run=1 to apply',
      renames: Object.entries(RENAMES).map(([from, to]) => ({ from, to })),
      total: Object.keys(RENAMES).length,
    });
  }

  const database = db();
  let salesUpdated = 0;
  let paymentsUpdated = 0;

  for (const [from, to] of Object.entries(RENAMES)) {
    const salesCount = await database.get(
      `SELECT COUNT(*) as cnt FROM rmc_sales WHERE customer_name = ?`, from
    );
    const payCount = await database.get(
      `SELECT COUNT(*) as cnt FROM rmc_payments WHERE customer_name = ?`, from
    );
    const sc = Number(salesCount?.cnt ?? 0);
    const pc = Number(payCount?.cnt ?? 0);
    if (sc > 0) {
      await database.run(`UPDATE rmc_sales SET customer_name = ? WHERE customer_name = ?`, to, from);
      salesUpdated += sc;
    }
    if (pc > 0) {
      await database.run(`UPDATE rmc_payments SET customer_name = ? WHERE customer_name = ?`, to, from);
      paymentsUpdated += pc;
    }
  }

  return NextResponse.json({
    success: true,
    sales_rows_updated: salesUpdated,
    payments_rows_updated: paymentsUpdated,
    message: `Done. ${salesUpdated} sales rows and ${paymentsUpdated} payment rows updated.`,
  });
}
