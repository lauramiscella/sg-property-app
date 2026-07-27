# SG Private Property — Transaction Intelligence

A Next.js app for retrieving and analysing **private residential property transactions in Singapore**, straight from the **URA data service**. Whole-island coverage, four analysis frameworks, one calm dashboard.

It runs immediately on a clearly-labelled **sample dataset** so you can explore the interface, and switches to **live URA data** the moment you add an access key.

## The four frameworks

1. **Price / PSF trends** — median & average price-per-sqft over time (monthly / quarterly / yearly), with a 25th–75th percentile band, transaction volume, year-on-year change, and growth over the window. Filter to any slice of the market.
2. **Comparables / project drill-down** — every matching caveat in a sortable, paginated table (date, project, district, type, sale type, tenure, floor, size, price, PSF). Export the matched set to CSV.
3. **Rental yield** — gross yield by district or project and unit band (Studio/1BR → 4BR+), computed as annualised median rent ÷ median price for the comparable segment. Clearly flagged as a gross, market-level estimate.
4. **Appreciation** — project-level PSF growth: entry vs latest median PSF, total growth and CAGR, with an expandable per-year chart. Plus an **affordability calculator** (BSD, ABSD, LTV, TDSR, monthly repayment) for translating a price into the cash and loan a buyer actually needs.

## Getting the data live (URA access key)

1. Register for a **free** account at the URA API portal: <https://eservice.ura.gov.sg/maps/api/reg.html> (API home: <https://eservice.ura.gov.sg/maps/api/>).
2. After approval you'll receive an **AccessKey** by email.
3. Copy `.env.example` to `.env.local` and paste it in:

   ```bash
   cp .env.example .env.local
   # then edit .env.local:
   # URA_ACCESS_KEY=your-key-here
   ```

4. Restart the app. The badge in the top-right flips from **SAMPLE DATA** to **LIVE · URA**.

The app fetches a daily token, pulls all four transaction batches (last ~5 years of caveats, whole island) plus the recent rental quarters, normalises everything, and caches the snapshot to disk (twice-daily refresh, or hit **Refresh data**).

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

For a production build:

```bash
npm run build
npm run start
```

Requires Node 18.18+ (built and tested on Node 22).

## How the numbers are produced (so you can trust them)

- **PSF** = price ÷ sqft, using the caveat's **net price** where one is recorded. Area is converted from URA's sqm (× 10.76391).
- **Median** is used as the headline everywhere (robust to the odd penthouse or fire-sale); average is shown alongside.
- **Rental yield** is **gross** — it does *not* net off maintenance, property tax, vacancy, or agent fees. Rent and sale caveats are matched at district/unit-band level, not per unit, so it's a market signal, not a specific unit's return.
- **Appreciation** is **project-level**. URA caveats carry no unit identifier, so genuine buy-then-sell pairs can't be reconstructed — this measures how a project's median PSF moved, not one owner's gain.
- **Stamp duty / financing** rates (BSD, ABSD, LTV, TDSR) are stamped with their effective dates in the calculator and are all **editable**. Cooling measures change — the app links to IRAS and MAS so you confirm current rates before advising anyone. Nothing is presented as guaranteed-current.

## Project layout

```
src/
  app/
    api/                 URA-backed JSON endpoints (meta, transactions,
                         psf-trends, rental-yield, appreciation, refresh)
    layout.tsx, page.tsx
  lib/
    ura.ts               URA data-service client + normalisation
    store.ts             daily cache; URA-or-sample selection
    sampleData.ts        deterministic synthetic fallback dataset
    analysis.ts          the four frameworks (pure functions)
    finance.ts           BSD / ABSD / LTV / TDSR math
    format.ts, query.ts, params.ts, types.ts
  components/            dashboard, filter bar, and one panel per framework
```

## A note on the sample data

Until a URA key is set, every figure is **synthetic** and the UI says so in red. It's shaped to be plausible (real projects, believable PSF trajectories and yields) purely so the interface is explorable — do not quote it. Add your key for real caveats.
