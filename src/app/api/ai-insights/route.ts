import { NextRequest, NextResponse } from 'next/server';

// Supports multiple AI providers — uses the first available key:
//   GOOGLE_GEMINI_API_KEY  (free tier: 15 RPM, generous limits)
//   GROQ_API_KEY           (free tier: Llama 3.3 70B, very fast)
//   ANTHROPIC_API_KEY      (paid)

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  // Try models in order until one works
  const models = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
  ];

  let lastErr = '';
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
    const body = await res.text();
    if (res.status === 404) { lastErr = body; continue; } // try next model
    throw new Error(`Gemini error ${res.status}: ${body.slice(0, 300)}`);
  }
  throw new Error(`No working Gemini model found. Last error: ${lastErr.slice(0, 200)}`);
}

async function callGroq(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  return (message.content[0] as { type: string; text: string }).text;
}

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;
  const anthroKey = process.env.ANTHROPIC_API_KEY;

  if (!geminiKey && !groqKey && !anthroKey) {
    return NextResponse.json(
      {
        error: 'No AI API key configured.',
        setup: 'Add one of these to Vercel → Settings → Environment Variables:\n• GOOGLE_GEMINI_API_KEY (free — get at aistudio.google.com)\n• GROQ_API_KEY (free — get at console.groq.com)\n• ANTHROPIC_API_KEY (paid)',
      },
      { status: 503 }
    );
  }

  const { reportData, module: mod } = await req.json();

  const moduleLabel = mod === 'rmc' ? 'Ready Mix Concrete (RMC)' : 'Cement Blocks';
  const unitLabel   = mod === 'rmc' ? 'm³' : 'blocks';
  const productLabel = mod === 'rmc' ? 'concrete grades (M20/M25/M30 etc.)' : 'block sizes (4"/6"/8")';

  const stats = reportData.stats ?? {};
  const monthly: {month_label:string;revenue:number;volume:number;outstanding:number;collection_rate:number}[] = reportData.monthly ?? [];
  const topCustomers: {customer_name:string;revenue:number;outstanding:number}[] = (reportData.top_customers ?? reportData.topCustomers ?? []).slice(0, 10);
  const grades = (reportData.grades ?? reportData.sizes ?? []).slice(0, 8);
  const ageing = reportData.ageing ?? {};

  const recent = monthly.slice(-3);
  const revTrend = recent.map(m => `${m.month_label}: ₹${(m.revenue/100000).toFixed(1)}L`).join(', ');
  const volTrend = recent.map(m => `${m.month_label}: ${m.volume} ${unitLabel}`).join(', ');

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
${monthly.map(m => `${m.month_label}: ₹${(m.revenue/100000).toFixed(1)}L, ${m.volume}${unitLabel}, ${m.collection_rate}%`).join('\n')}

**Top 10 customers (name, revenue ₹L, outstanding ₹L)**
${topCustomers.map(c => `${c.customer_name}: ₹${(c.revenue/100000).toFixed(1)}L revenue, ₹${(c.outstanding/100000).toFixed(1)}L outstanding`).join('\n')}

**${productLabel} breakdown (type, revenue ₹L, volume)**
${grades.map((g: {grade?:string;size?:number;revenue:number;volume:number}) => `${g.grade ?? g.size}: ₹${(g.revenue/100000).toFixed(1)}L, ${g.volume}${unitLabel}`).join('\n')}

**Outstanding ageing**
- 0-15 days: ₹${((ageing.d0_15??0)/100000).toFixed(1)}L
- 16-30 days: ₹${((ageing.d16_30??0)/100000).toFixed(1)}L
- 31-60 days: ₹${((ageing.d31_60??0)/100000).toFixed(1)}L
- 61-90 days: ₹${((ageing.d61_90??0)/100000).toFixed(1)}L
- 90+ days: ₹${((ageing.d90plus??0)/100000).toFixed(1)}L

---

Respond ONLY with a JSON object in this exact structure (no markdown fences, no explanation outside the JSON):
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
- All rupee values in the JSON must be plain numbers, not strings`;

  try {
    let raw: string;
    let provider: string;

    if (geminiKey) {
      raw = await callGemini(geminiKey, prompt);
      provider = 'Gemini 1.5 Flash';
    } else if (groqKey) {
      raw = await callGroq(groqKey, prompt);
      provider = 'Groq / Llama 3.3';
    } else {
      raw = await callAnthropic(anthroKey!, prompt);
      provider = 'Claude';
    }

    // Strip accidental markdown fences
    const clean = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json({ ok: true, analysis: parsed, provider });
  } catch (err) {
    return NextResponse.json(
      { error: `AI analysis failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
