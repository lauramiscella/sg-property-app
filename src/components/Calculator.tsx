"use client";

import { useState } from "react";
import {
  assessAffordability,
  assessProgression,
  estimateAccruedInterest,
  breakevenSchedule,
  maxAffordability,
  BuyerProfile,
  RATE_NOTES,
} from "@/lib/finance";
import { fmtSGD, fmtPct } from "@/lib/format";
import { Card, Field, Select, TextInput, Kpi, Segmented } from "./ui";

type Sub = "buy" | "maxprice" | "prog" | "breakeven";

export default function Calculator() {
  const [sub, setSub] = useState<Sub>("buy");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Segmented<Sub>
          value={sub}
          onChange={setSub}
          options={[
            { value: "buy", label: "Purchase Outlay" },
            { value: "maxprice", label: "What Can I Afford?" },
            { value: "prog", label: "Sell & Buy (Upgrade)" },
            { value: "breakeven", label: "Sell Without Losing" },
          ]}
        />
        <span className="text-xs text-muted">Rates verified {RATE_NOTES.verified}</span>
      </div>
      {sub === "buy" ? (
        <SinglePurchase />
      ) : sub === "maxprice" ? (
        <MaxPrice />
      ) : sub === "prog" ? (
        <Progression />
      ) : (
        <Breakeven />
      )}
      <RateSources />
    </div>
  );
}

function SinglePurchase() {
  const [price, setPrice] = useState(1_800_000);
  const [profile, setProfile] = useState<BuyerProfile>("SC");
  const [count, setCount] = useState(1);
  const [loans, setLoans] = useState(0);
  const [income, setIncome] = useState(18_000);
  const [debt, setDebt] = useState(0);
  const [age, setAge] = useState(35);
  const [tenure, setTenure] = useState(30);
  const [rate, setRate] = useState(3.5);

  const r = assessAffordability({
    price,
    profile,
    propertyCount: count,
    outstandingLoans: loans,
    grossMonthlyIncome: income,
    monthlyDebt: debt,
    borrowerAge: age,
    loanTenureYears: tenure,
    interestRate: rate / 100,
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_1fr]">
      <Card title="Your inputs" subtitle="Everything is editable.">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Purchase price (SGD)">
              <TextInput type="number" value={String(price)} onChange={(v) => setPrice(Number(v) || 0)} />
            </Field>
          </div>
          <Field label="Buyer profile">
            <Select value={profile} onChange={(v) => setProfile(v as BuyerProfile)} placeholder=""
              options={[
                { value: "SC", label: "Singapore Citizen" },
                { value: "PR", label: "PR" },
                { value: "Foreigner", label: "Foreigner" },
                { value: "Entity", label: "Entity" },
              ]} />
          </Field>
          <Field label="Property # (ABSD)">
            <Select value={String(count)} onChange={(v) => setCount(Number(v))} placeholder=""
              options={[{ value: "1", label: "1st" }, { value: "2", label: "2nd" }, { value: "3", label: "3rd+" }]} />
          </Field>
          <div className="col-span-2">
            <Field label="Outstanding home loans (sets LTV)">
              <Select value={String(loans)} onChange={(v) => setLoans(Number(v))} placeholder=""
                options={[{ value: "0", label: "None" }, { value: "1", label: "1" }, { value: "2", label: "2 or more" }]} />
            </Field>
          </div>
          <Field label="Gross income /mo">
            <TextInput type="number" value={String(income)} onChange={(v) => setIncome(Number(v) || 0)} />
          </Field>
          <Field label="Existing debt /mo">
            <TextInput type="number" value={String(debt)} onChange={(v) => setDebt(Number(v) || 0)} />
          </Field>
          <Field label="Borrower age">
            <TextInput type="number" value={String(age)} onChange={(v) => setAge(Number(v) || 0)} />
          </Field>
          <Field label="Loan tenure (yrs)">
            <TextInput type="number" value={String(tenure)} onChange={(v) => setTenure(Number(v) || 0)} />
          </Field>
          <div className="col-span-2">
            <Field label="Actual interest rate % (repayment only)">
              <TextInput type="number" value={String(rate)} onChange={(v) => setRate(Number(v) || 0)} />
            </Field>
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        <Card title="Upfront cost">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Buyer's Stamp Duty" value={fmtSGD(r.bsd)} sub={`eff. ${RATE_NOTES.bsdEffective}`} accent="amber" />
            <Kpi label={`ABSD (${fmtPct(r.absdRate * 100, 0)})`} value={fmtSGD(r.absd)} sub={`${profile} · #${count}`} tone={r.absd > 0 ? "down" : "default"} accent={r.absd > 0 ? "brick" : "olive"} />
            <Kpi label="Min cash downpayment" value={fmtSGD(r.minCashDownpayment)} sub={`${fmtPct(r.ltvCap * 100, 0)} LTV`} accent="gold" />
            <Kpi label="Total downpayment" value={fmtSGD(r.totalDownpayment)} sub="cash + CPF" accent="plum" />
            <Kpi label="Stamp duty total" value={fmtSGD(r.totalStampDuty)} accent="amber" />
            <Kpi label="Cash on completion" value={fmtSGD(r.totalUpfrontCash)} sub="min cash + BSD + ABSD" tone="down" accent="brick" />
          </div>
        </Card>
        <Card title="Loan & repayment" subtitle="Lower of the LTV cap and the TDSR-supportable loan.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="LTV cap" value={fmtPct(r.ltvCap * 100, 0)} sub={`${loans} loan(s)${r.reduced ? " · reduced" : ""}`} accent="plum" />
            <Kpi label="Max loan by LTV" value={fmtSGD(r.maxLoanByLtv)} accent="amber" />
            <Kpi label="Max loan by TDSR" value={fmtSGD(r.maxLoanByTdsr)} sub="stressed at 4%" accent="gold" />
            <Kpi label="Eligible loan" value={fmtSGD(r.eligibleLoan)} sub={`bound by ${r.bindingConstraint}`} tone="up" accent="emerald" />
            <Kpi label="Est. monthly repayment" value={fmtSGD(r.estMonthlyRepayment)} sub={`at ${rate}% / ${tenure}yr`} accent="amber" />
            <Kpi label="Repayment vs income" value={income > 0 ? fmtPct((r.estMonthlyRepayment / income) * 100) : "—"} sub="TDSR limit 55%" accent="olive" />
          </div>
          {r.bindingConstraint === "TDSR" && (
            <p className="mt-3 rounded-lg border border-clay/25 bg-clay/5 px-3 py-2 text-xs text-clay">
              Income is the binding limit here, not the LTV cap — the buyer can borrow less than {fmtPct(r.ltvCap * 100, 0)} of
              value, so more cash/CPF is needed than the headline downpayment.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Progression() {
  const [sale, setSale] = useState(1_600_000);
  const [loan, setLoan] = useState(600_000);
  const [fee, setFee] = useState(2);
  const [gst, setGst] = useState(9);
  const [cpf, setCpf] = useState(250_000);
  const [accr, setAccr] = useState(55_000);
  const [years, setYears] = useState(8);
  const [newRegime, setNewRegime] = useState(false);
  const [next, setNext] = useState(2_400_000);
  const [profile, setProfile] = useState<BuyerProfile>("SC");
  const [order, setOrder] = useState<"sellfirst" | "buyfirst">("sellfirst");
  const [nTenure, setNTenure] = useState(25);
  const [nAge, setNAge] = useState(40);

  const r = assessProgression({
    salePrice: sale,
    outstandingMortgage: loan,
    agentFeePct: fee,
    gstPct: gst,
    cpfPrincipalUsed: cpf,
    cpfAccruedInterest: accr,
    yearsHeld: years,
    boughtOnOrAfterJul2025: newRegime,
    nextPrice: next,
    nextProfile: profile,
    order,
    nextTenureYears: nTenure,
    nextAge: nAge,
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_1fr]">
      <Card title="Your inputs" subtitle="Pull the loan & CPF figures from the client's statements.">
        <div className="mb-2 text-xs font-semibold text-ink-soft">1 · Sell the current property</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Expected sale price">
              <TextInput type="number" value={String(sale)} onChange={(v) => setSale(Number(v) || 0)} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Outstanding mortgage">
              <TextInput type="number" value={String(loan)} onChange={(v) => setLoan(Number(v) || 0)} />
            </Field>
          </div>
          <Field label="Agent fee %">
            <TextInput type="number" value={String(fee)} onChange={(v) => setFee(Number(v) || 0)} />
          </Field>
          <Field label="GST %">
            <TextInput type="number" value={String(gst)} onChange={(v) => setGst(Number(v) || 0)} />
          </Field>
          <div className="col-span-2">
            <Field label="CPF principal used">
              <TextInput type="number" value={String(cpf)} onChange={(v) => setCpf(Number(v) || 0)} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="CPF accrued interest (from CPF statement)">
              <TextInput type="number" value={String(accr)} onChange={(v) => setAccr(Number(v) || 0)} />
            </Field>
          </div>
          <Field label="Years held">
            <TextInput type="number" value={String(years)} onChange={(v) => setYears(Number(v) || 0)} />
          </Field>
          <div className="flex items-end">
            <button
              onClick={() => setAccr(estimateAccruedInterest(cpf, years))}
              className="h-9 w-full rounded-lg border border-line bg-card px-2 text-xs font-medium text-amber hover:border-amber"
            >
              Estimate @2.5%
            </button>
          </div>
          <div className="col-span-2">
            <Field label="Purchased on/after 4 Jul 2025? (SSD schedule)">
              <Select value={newRegime ? "yes" : "no"} onChange={(v) => setNewRegime(v === "yes")} placeholder=""
                options={[{ value: "no", label: "No — 3-yr SSD (12/8/4%)" }, { value: "yes", label: "Yes — 4-yr SSD (16/12/8/4%)" }]} />
            </Field>
          </div>
        </div>

        <div className="mb-2 mt-4 text-xs font-semibold text-ink-soft">2 · Buy the next property</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Next purchase price">
              <TextInput type="number" value={String(next)} onChange={(v) => setNext(Number(v) || 0)} />
            </Field>
          </div>
          <Field label="Buyer profile">
            <Select value={profile} onChange={(v) => setProfile(v as BuyerProfile)} placeholder=""
              options={[{ value: "SC", label: "Citizen" }, { value: "PR", label: "PR" }, { value: "Foreigner", label: "Foreigner" }]} />
          </Field>
          <Field label="Order">
            <Select value={order} onChange={(v) => setOrder(v as "sellfirst" | "buyfirst")} placeholder=""
              options={[{ value: "sellfirst", label: "Sell, then buy" }, { value: "buyfirst", label: "Buy, then sell" }]} />
          </Field>
          <Field label="Next loan tenure">
            <TextInput type="number" value={String(nTenure)} onChange={(v) => setNTenure(Number(v) || 0)} />
          </Field>
          <Field label="Age at next buy">
            <TextInput type="number" value={String(nAge)} onChange={(v) => setNAge(Number(v) || 0)} />
          </Field>
        </div>
      </Card>

      <div className="space-y-5">
        <Card title="Cash freed from the sale">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Net sale balance" value={fmtSGD(r.netSaleBalance)} sub="after loan, costs, SSD" accent="amber" />
            <Kpi label={`Seller's Stamp Duty (${fmtPct(r.ssdRate * 100, 0)})`} value={fmtSGD(r.ssd)} sub={r.ssd > 0 ? "still within holding period" : "past holding period"} tone={r.ssd > 0 ? "down" : "default"} accent={r.ssd > 0 ? "brick" : "olive"} />
            <Kpi label="Cash in hand" value={fmtSGD(r.cashInHand)} sub="after CPF refund" tone={r.cashInHand < 0 ? "down" : "up"} accent="emerald" />
          </div>
          <table className="mt-4 w-full text-sm">
            <tbody>
              <Row label="Sale price" value={fmtSGD(sale)} />
              <Row label="Less outstanding mortgage" value={`−${fmtSGD(loan)}`} />
              <Row label={`Less selling costs (${fee}% + ${gst}% GST)`} value={`−${fmtSGD(r.sellingCost)}`} />
              <Row label={`Less Seller's Stamp Duty (${fmtPct(r.ssdRate * 100, 0)})`} value={`−${fmtSGD(r.ssd)}`} />
              <Row label="Net sale balance" value={fmtSGD(r.netSaleBalance)} strong />
              <Row label="Of which CPF refund" value={fmtSGD(r.cpfRefund)} />
              <Row label="Cash in hand" value={fmtSGD(r.cashInHand)} strong />
            </tbody>
          </table>
          {r.ssd > 0 && (
            <p className="mt-3 rounded-lg border border-clay/25 bg-clay/5 px-3 py-2 text-xs text-clay">
              Selling within the holding period triggers {fmtPct(r.ssdRate * 100, 0)} SSD ({fmtSGD(r.ssd)}) on the sale
              price. Holding a little longer to clear the period may save this entirely.
            </p>
          )}
        </Card>

        <Card title="The next purchase">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Next BSD" value={fmtSGD(r.nextBsd)} accent="amber" />
            <Kpi label={`Next ABSD (${fmtPct(r.nextAbsdRate * 100, 0)})`} value={fmtSGD(r.nextAbsd)} sub={order === "buyfirst" ? "2nd property" : "only property"} tone={r.nextAbsd > 0 ? "down" : "default"} accent={r.nextAbsd > 0 ? "brick" : "olive"} />
            <Kpi label={`Downpayment (${fmtPct((1 - r.nextLtvCap) * 100, 0)})`} value={fmtSGD(r.nextDownpayment)} sub="cash + CPF" accent="plum" />
            <Kpi label="Funds from sale" value={fmtSGD(r.fundsForNext)} sub="cash + CPF" tone="up" accent="emerald" />
            <Kpi label="Total needed" value={fmtSGD(r.totalNeeded)} sub="downpayment + duties" accent="gold" />
            <Kpi label={r.surplus >= 0 ? "Surplus" : "Shortfall"} value={fmtSGD(Math.abs(r.surplus))} sub={r.surplus >= 0 ? "after next buy" : "top-up required"} tone={r.surplus >= 0 ? "up" : "down"} accent={r.surplus >= 0 ? "emerald" : "brick"} />
          </div>
          {order === "buyfirst" ? (
            <p className="mt-3 rounded-lg border border-clay/25 bg-clay/5 px-3 py-2 text-xs text-clay">
              Buying before selling means ABSD is payable upfront as a 2nd property. Married Singaporean couples can
              apply to IRAS for <b>ABSD remission</b> if the first home is sold within 6 months (completed property) —
              this shows ABSD <i>before</i> any remission. Confirm eligibility with IRAS.
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-sage/30 bg-sage/5 px-3 py-2 text-xs text-[#4f6141]">
              Selling first: the next home counts as the only property, so ABSD is {fmtPct(r.nextAbsdRate * 100, 0)} for a{" "}
              {profile} buyer — the cleaner route for cash flow.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function MaxPrice() {
  const [income, setIncome] = useState(18_000);
  const [debt, setDebt] = useState(0);
  const [cash, setCash] = useState(300_000);
  const [cpf, setCpf] = useState(150_000);
  const [age, setAge] = useState(35);
  const [tenure, setTenure] = useState(30);
  const [rate, setRate] = useState(3.5);
  const [profile, setProfile] = useState<BuyerProfile>("SC");
  const [count, setCount] = useState(1);
  const [loans, setLoans] = useState(0);

  const r = maxAffordability({
    grossMonthlyIncome: income,
    monthlyDebt: debt,
    borrowerAge: age,
    loanTenureYears: tenure,
    cashAvailable: cash,
    cpfAvailable: cpf,
    profile,
    propertyCount: count,
    outstandingLoans: loans,
    interestRate: rate / 100,
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_1fr]">
      <Card title="Your inputs" subtitle="What you earn and what you have to put down.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gross income /mo">
            <TextInput type="number" value={String(income)} onChange={(v) => setIncome(Number(v) || 0)} />
          </Field>
          <Field label="Existing debt /mo">
            <TextInput type="number" value={String(debt)} onChange={(v) => setDebt(Number(v) || 0)} />
          </Field>
          <Field label="Cash available">
            <TextInput type="number" value={String(cash)} onChange={(v) => setCash(Number(v) || 0)} />
          </Field>
          <Field label="CPF available">
            <TextInput type="number" value={String(cpf)} onChange={(v) => setCpf(Number(v) || 0)} />
          </Field>
          <Field label="Buyer profile">
            <Select value={profile} onChange={(v) => setProfile(v as BuyerProfile)} placeholder=""
              options={[{ value: "SC", label: "Citizen" }, { value: "PR", label: "PR" }, { value: "Foreigner", label: "Foreigner" }]} />
          </Field>
          <Field label="Property # (ABSD)">
            <Select value={String(count)} onChange={(v) => setCount(Number(v))} placeholder=""
              options={[{ value: "1", label: "1st" }, { value: "2", label: "2nd" }, { value: "3", label: "3rd+" }]} />
          </Field>
          <div className="col-span-2">
            <Field label="Outstanding home loans (sets LTV)">
              <Select value={String(loans)} onChange={(v) => setLoans(Number(v))} placeholder=""
                options={[{ value: "0", label: "None" }, { value: "1", label: "1" }, { value: "2", label: "2 or more" }]} />
            </Field>
          </div>
          <Field label="Borrower age">
            <TextInput type="number" value={String(age)} onChange={(v) => setAge(Number(v) || 0)} />
          </Field>
          <Field label="Loan tenure (yrs)">
            <TextInput type="number" value={String(tenure)} onChange={(v) => setTenure(Number(v) || 0)} />
          </Field>
          <div className="col-span-2">
            <Field label="Interest rate % (repayment)">
              <TextInput type="number" value={String(rate)} onChange={(v) => setRate(Number(v) || 0)} />
            </Field>
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        <Card title="What you can afford">
          <div className="mb-1 rounded-xl border border-emerald/30 bg-emerald/5 px-5 py-4">
            <div className="text-[11px] uppercase tracking-wide text-[#3f7d57]">Max purchase price</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums text-[#3f7d57]">{fmtSGD(r.maxPrice)}</div>
            <div className="mt-1 text-xs text-muted">Limited by {r.binding} · uses {fmtSGD(r.fundsAvailable)} cash + CPF and a {fmtSGD(r.loanAtMax)} loan</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Eligible loan" value={fmtSGD(r.loanAtMax)} sub={`≤ ${fmtPct(r.ltvCap * 100, 0)} LTV & TDSR`} accent="amber" />
            <Kpi label="Downpayment" value={fmtSGD(r.downpaymentAtMax)} sub="cash + CPF" accent="plum" />
            <Kpi label="BSD + ABSD" value={fmtSGD(r.bsdAtMax + r.absdAtMax)} sub="stamp duties" accent="brick" />
            <Kpi label="Max loan by TDSR" value={fmtSGD(r.maxLoanByTdsr)} sub="stressed at 4%" accent="gold" />
            <Kpi label="Cash + CPF used" value={fmtSGD(r.cashCpfUsed)} sub={`of ${fmtSGD(r.fundsAvailable)}`} accent="olive" />
            <Kpi label="Est. monthly repayment" value={fmtSGD(r.estMonthlyRepayment)} sub={`at ${rate}% / ${tenure}yr`} accent="amber" />
          </div>
          <p className="mt-3 text-xs text-muted">
            {r.binding === "Loan (TDSR)"
              ? "Income is the ceiling — a bigger cash pile won't lift the price much until income rises, because TDSR caps the loan."
              : "Cash/CPF is the ceiling — earning more won't help until you have more for the downpayment and stamp duties."}
            {" "}This is the maximum; buying below it leaves a buffer for renovation, legal fees and rate rises.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Breakeven() {
  const [price, setPrice] = useState(1_800_000);
  const [profile, setProfile] = useState<BuyerProfile>("SC");
  const [count, setCount] = useState(1);
  const [newRegime, setNewRegime] = useState(true);
  const [fee, setFee] = useState(2);
  const [gst, setGst] = useState(9);
  const [includeHolding, setIncludeHolding] = useState(false);
  const [maint, setMaint] = useState(350);
  const [tax, setTax] = useState(3_500);
  const [loanAmt, setLoanAmt] = useState(1_350_000);
  const [loanRate, setLoanRate] = useState(3.5);

  const { entryCost, bsd, absd, annualHolding, rows } = breakevenSchedule({
    price,
    profile,
    propertyCount: count,
    boughtOnOrAfterJul2025: newRegime,
    agentFeePct: fee,
    gstPct: gst,
    monthlyMaintenance: includeHolding ? maint : 0,
    annualPropertyTax: includeHolding ? tax : 0,
    loanAmount: includeHolding ? loanAmt : 0,
    loanInterestPct: includeHolding ? loanRate : 0,
  });

  // The "floor" is the first year SSD hits 0 — pure cost drag, no SSD.
  const floor = rows.find((r) => r.ssdRate === 0) ?? rows[rows.length - 1];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_1fr]">
      <Card title="Your inputs" subtitle="If I had to sell in year 1, 2, 3… how much must my home be worth so I don't lose money?">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Purchase price (SGD)">
              <TextInput type="number" value={String(price)} onChange={(v) => setPrice(Number(v) || 0)} />
            </Field>
          </div>
          <Field label="Buyer profile">
            <Select value={profile} onChange={(v) => setProfile(v as BuyerProfile)} placeholder=""
              options={[{ value: "SC", label: "Citizen" }, { value: "PR", label: "PR" }, { value: "Foreigner", label: "Foreigner" }, { value: "Entity", label: "Entity" }]} />
          </Field>
          <Field label="Property # (ABSD)">
            <Select value={String(count)} onChange={(v) => setCount(Number(v))} placeholder=""
              options={[{ value: "1", label: "1st" }, { value: "2", label: "2nd" }, { value: "3", label: "3rd+" }]} />
          </Field>
          <Field label="Agent fee %">
            <TextInput type="number" value={String(fee)} onChange={(v) => setFee(Number(v) || 0)} />
          </Field>
          <Field label="GST %">
            <TextInput type="number" value={String(gst)} onChange={(v) => setGst(Number(v) || 0)} />
          </Field>
          <div className="col-span-2">
            <Field label="Bought on/after 4 Jul 2025? (SSD schedule)">
              <Select value={newRegime ? "yes" : "no"} onChange={(v) => setNewRegime(v === "yes")} placeholder=""
                options={[{ value: "yes", label: "Yes — 4-yr SSD" }, { value: "no", label: "No — 3-yr SSD" }]} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Include yearly running costs?">
              <Select value={includeHolding ? "yes" : "no"} onChange={(v) => setIncludeHolding(v === "yes")} placeholder=""
                options={[{ value: "no", label: "No — just buy & sell costs" }, { value: "yes", label: "Yes — add maintenance, tax, interest" }]} />
            </Field>
          </div>
          {includeHolding && (
            <>
              <Field label="Maintenance $/mo">
                <TextInput type="number" value={String(maint)} onChange={(v) => setMaint(Number(v) || 0)} />
              </Field>
              <Field label="Property tax $/yr">
                <TextInput type="number" value={String(tax)} onChange={(v) => setTax(Number(v) || 0)} />
              </Field>
              <Field label="Loan amount">
                <TextInput type="number" value={String(loanAmt)} onChange={(v) => setLoanAmt(Number(v) || 0)} />
              </Field>
              <Field label="Loan interest %">
                <TextInput type="number" value={String(loanRate)} onChange={(v) => setLoanRate(Number(v) || 0)} />
              </Field>
            </>
          )}
        </div>
        {includeHolding && (
          <p className="mt-2 text-[11px] text-muted">
            Adds ≈{fmtSGD(annualHolding)}/year to the target. Interest is approximated as loan × rate; check your
            IRAS property tax notice for the exact tax. New launches pay little of this while building; resale pays
            from day one.
          </p>
        )}
      </Card>

      <div className="space-y-5">
        <Card title="What you've put in">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="All-in cost to buy" value={fmtSGD(entryCost)} sub="price + BSD + ABSD" accent="amber" />
            <Kpi label="Stamp duty paid" value={fmtSGD(bsd + absd)} sub={`BSD ${fmtSGD(bsd)} + ABSD ${fmtSGD(absd)}`} accent="plum" />
            <Kpi
              label="Safe-to-sell year"
              value={`Year ${floor.year}+`}
              sub={`needs just ${fmtPct(floor.breakevenGrowthPct)} rise (no more SSD)`}
              accent="emerald"
              tone="up"
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Plain English: buying costs you stamp duty going in and agent fee going out, so even after the SSD
            period your home must be worth a bit more than you paid before selling breaks even. Selling earlier
            adds SSD on top — that&apos;s why year 1 needs the biggest rise.
          </p>
        </Card>

        <Card
          title="If you sold in year…"
          subtitle="What your home must be worth that year to walk away without losing money."
        >
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full sm:min-w-[460px] text-sm">
              <thead>
                <tr className="border-b border-line bg-card-2 text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5 font-medium">Sell in</th>
                  <th className="px-3 py-2.5 text-right font-medium">SSD penalty</th>
                  {annualHolding > 0 && <th className="px-3 py-2.5 text-right font-medium">Running costs so far</th>}
                  <th className="px-3 py-2.5 text-right font-medium">Home must be worth</th>
                  <th className="px-3 py-2.5 text-right font-medium">That&apos;s a rise of</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className={`border-b border-line/60 last:border-0 ${r.ssdRate === 0 ? "bg-emerald/5" : ""}`}>
                    <td className="px-3 py-2.5 font-medium text-ink">Year {r.year}{r.ssdRate === 0 && <span className="ml-1.5 rounded bg-emerald/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald">SSD-free</span>}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${r.ssdRate > 0 ? "text-brick" : "text-muted"}`}>{r.ssdRate > 0 ? fmtPct(r.ssdRate * 100, 0) : "none"}</td>
                    {annualHolding > 0 && <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtSGD(r.holdingCosts)}</td>}
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-ink">{fmtSGD(r.breakevenPrice)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber">{fmtPct(r.breakevenGrowthPct)} <span className="font-normal text-muted">({fmtPct(r.breakevenCagrPct)}/yr)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Covers stamp duties, agent fee + GST, SSD{annualHolding > 0 ? ", and your yearly running costs" : ""}.
            {annualHolding === 0 && " Toggle on running costs (maintenance, property tax, loan interest) for a fuller picture."}
            {" "}Sense-check the &ldquo;/yr&rdquo; figure against real project growth on the Performance &amp; Compare tab —
            if breakeven needs 8%/yr and similar projects grew 5%/yr, the timeline is optimistic.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={`border-b border-line last:border-0 ${strong ? "font-semibold text-ink" : "text-ink-soft"}`}>
      <td className="py-1.5">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{value}</td>
    </tr>
  );
}

function RateSources() {
  return (
    <Card title="Rate sources" subtitle={`Verified ${RATE_NOTES.verified} — cooling measures change, so confirm before advising.`}>
      <ul className="space-y-1.5 text-sm">
        <li className="text-ink-soft">
          BSD bands eff. {RATE_NOTES.bsdEffective}; ABSD eff. {RATE_NOTES.absdEffective} (unchanged, no Budget 2026
          change); SSD eff. {RATE_NOTES.ssdEffective} for buys on/after that date, else the older 3-yr 12/8/4%;
          {" "}{RATE_NOTES.ltvTdsrEffective}; LTV 75/45/35% by outstanding loans, reduced to 55/25/15% if
          tenure &gt; 30yr or age + tenure &gt; 65. CPF accrued interest at 2.5% p.a.
        </li>
        {RATE_NOTES.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" className="text-amber hover:underline">
              {s.label} ↗
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
