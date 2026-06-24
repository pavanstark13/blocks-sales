import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured. Add it in Vercel → Settings → Environment Variables.' },
      { status: 503 }
    );
  }

  const { reportData, module: mod } = await req.json();
  const client = new Anthropic({ apiKey });

  const moduleLabel = mod === 'rmc' ? 'Ready Mix Concrete (RMC)' : 'Cement Blocks';
  const unitLabel = mod === 'rmc' ? 'm³' : 'blocks';
  const productLabel = mod === 'rmc' ? 'concrete grades (M20/M25/M30 etc.)' : 'block sizes (4"/6"/8")';

  // Summarise data compactly for the prompt
  const stats = reportData.stats ?? {};
  const monthly: {month_label:string;revenue:number;volume:number;outstanding:number;collection_rate:number;orders:number}[] = reportData.monthly ?? [];
  const topCustomers: {customer_name:string;revenue:number;volume:number;outstanding:number;orders:number}[] = (reportData.top_customers ?? reportData.topCustomers ?? []).slice(0, 10);
  const grades = (reportData.grades ?? reportData.sizes ?? []).slice(0, 8);
  const ageing = reportData.ageing ?? {};

  // Month-over-month trend (last 3)
  const recent = monthly.slice(-3);
  const revTrend = recent.map((m: {month_label:string;revenue:number}) => `${m.month_label}: ₹${(m.revenue/100000).toFixed(1)}L`).join(', ');
  const volTrend = recent.map((m: {month_label:string;volume:number}) => `${m.month_label}: ${m.volume} ${unitLabel}`).join(', ');

  const prompt = `You are a business analyst for a ${moduleLabel} manufacturing company in India.

Analyse this sales data and provide concise, actionable insights for the business owner.

## Business Data Summary

**Overall (all time)**
- Total Revenue: ₹${(stats.total_revenue/100000).toFixed(1)}L
- Total Volume: ${stats.total_volume} ${unitLabel}
- Total Orders: ${stats.total_orders}
- Unique Customers: ${stats.total_customers}
- Outstanding Balance: ₹${(stats.total_outstanding/100000).toFixed(1)}L
- Collection Rate: ${stats.total_revenue > 0 ? Math.round(((stats.total_revenue - stats.total_outstanding)/stats.total_revenue)*100) : 0}%

**Recent 3-month trend**
- Revenue: ${revTrend}
- Volume: ${volTrend}

**All monthly data (month, revenue ₹L, volume ${unitLabel}, collection%)**
${monthly.map((m:{month_label:string;revenue:number;volume:number;collection_rate:number}) =>
  `${m.month_label}: ₹${(m.revenue/100000).toFixed(1)}L, ${m.volume}${unitLabel}, ${m.collection_rate}%`
).join('\n')}

**Top 10 customers (name, revenue ₹L, outstanding ₹L)**
${topCustomers.map((c:{customer_name:string;revenue:number;outstanding:number}) =>
  `${c.customer_name}: ₹${(c.revenue/100000).toFixed(1)}L revenue, ₹${(c.outstanding/100000).toFixed(1)}L outstanding`
).join('\n')}

**${productLabel} breakdown (type, revenue ₹L, volume)**
${grades.map((g:{grade?:string;size?:number;revenue:number;volume:number}) =>
  `${g.grade ?? g.size}: ₹${(g.revenue/100000).toFixed(1)}L, ${g.volume}${unitLabel}`
).join('\n')}

**Outstanding ageing**
- 0-15 days: ₹${((ageing.d0_15??0)/100000).toFixed(1)}L
- 16-30 days: ₹${((ageing.d16_30??0)/100000).toFixed(1)}L
- 31-60 days: ₹${((ageing.d31_60??0)/100000).toFixed(1)}L
- 61-90 days: ₹${((ageing.d61_90??0)/100000).toFixed(1)}L
- 90+ days: ₹${((ageing.d90plus??0)/100000).toFixed(1)}L

---

Respond ONLY with a JSON object in this exact structure (no markdown, no explanation):
{
  "projection": {
    "next_month_revenue": <number in rupees>,
    "next_month_volume": <number in ${unitLabel}>,
    "confidence": "low|medium|high",
    "trend": "growing|stable|declining",
    "reasoning": "<2 sentences max>"
  },
  "insights": [
    { "type": "positive|neutral|warning", "title": "<short title>", "body": "<2 sentences>" }
  ],
  "issues": [
    { "severity": "high|medium|low", "title": "<short title>", "body": "<2 sentences>", "customer": "<name or null>" }
  ],
  "recommendations": [
    { "priority": "high|medium|low", "action": "<verb phrase>", "detail": "<1 sentence>" }
  ]
}

Rules:
- insights: 3-5 items, mix of positive and neutral observations
- issues: 2-4 items, focus on collection risk, declining customers, overdue amounts
- recommendations: 3-5 items, specific and actionable (name specific customers when relevant)
- All rupee values in the JSON should be numbers, not strings`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text.trim();
    // Strip any accidental markdown fences
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json({ ok: true, analysis: parsed });
  } catch (err) {
    return NextResponse.json(
      { error: `AI analysis failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
