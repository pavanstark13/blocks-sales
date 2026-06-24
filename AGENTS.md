<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Feature Parity: Blocks ↔ RMC

This app has two parallel business modules: **Blocks** (cement blocks, sizes 4"/6"/8") and **RMC** (Ready Mix Concrete, grades M10–M40).

**Any feature added to one module MUST be added to the other.**

| Blocks component | RMC equivalent |
|---|---|
| `src/components/BulkEntry.tsx` | `src/components/rmc/RMCBulkEntry.tsx` |
| `src/components/BlocksReport.tsx` | `src/components/rmc/RMCReport.tsx` |
| `src/components/Dashboard.tsx` | `src/components/rmc/RMCDashboard.tsx` |
| `src/components/SalesTable.tsx` | `src/components/rmc/RMCSalesTable.tsx` |
| `src/components/Customers.tsx` | `src/components/rmc/RMCCustomers.tsx` |
| `src/components/Ledger.tsx` | `src/components/rmc/RMCLedger.tsx` |
| `src/components/Outstanding.tsx` | `src/components/rmc/RMCOutstanding.tsx` |
| `src/app/api/report/route.ts` | `src/app/api/rmc/report/route.ts` |

When adding a feature, adapt for the module's domain:
- Blocks uses `size` (4/6/8), `address`, `phone`; unit = blocks; color = blue
- RMC uses `grade` (M10–M40), `site_address`, `pump_charge`; unit = m³; color = purple
