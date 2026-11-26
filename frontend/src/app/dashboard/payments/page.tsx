"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiUrl, fetchApi } from "../api";

type Payment = {
  id: string; purpose: "LEVEL_4_INSTALLMENT" | "EXAM_FEE"; description: string | null;
  amountUsd: string; status: string; createdAt: string;
  lead: { id: number; firstName: string; lastName: string | null; email: string | null };
  createdBy: { name: string };
};

export default function PaymentsPage() {
  const search = useSearchParams();
  const [leadId, setLeadId] = useState(search.get("leadId") || "");
  const [purpose, setPurpose] = useState<Payment["purpose"]>("LEVEL_4_INSTALLMENT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [createdUrl, setCreatedUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const result = await fetchApi<{ data: Payment[] }>(`${apiUrl}/payments/requests`);
      setPayments(result.data);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load payments"); }
  }

  useEffect(() => { void refresh(); }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setCreatedUrl("");
    try {
      const result = await fetchApi<{ data: { url: string } }>(`${apiUrl}/payments/requests`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: Number(leadId), purpose, amountUsd: amount, description: description || undefined }),
      });
      setCreatedUrl(result.data.url); setAmount(""); setDescription("");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create payment link"); }
    finally { setBusy(false); }
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this payment link?")) return;
    setMessage("");
    try {
      await fetchApi(`${apiUrl}/payments/requests/${id}/cancel`, { method: "PATCH" });
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not cancel payment link"); }
  }

  async function newLink(id: string) {
    setMessage(""); setCreatedUrl("");
    try {
      const result = await fetchApi<{ data: { url: string } }>(`${apiUrl}/payments/requests/${id}/new-link`, { method: "POST" });
      setCreatedUrl(result.data.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create a new link"); }
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-semibold text-slate-900">Payment links</h1>
      <p className="mt-1 text-sm text-slate-600">Create a link after agreeing the amount with the customer. Check any payments on the old site first. Payments do not enrol a student automatically.</p></div>
    <form onSubmit={create} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Create a request</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">Lead ID
          <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" type="number" min="1" required value={leadId} onChange={e => setLeadId(e.target.value)} />
        </label>
        <label className="text-sm font-medium">Payment purpose
          <select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={purpose} onChange={e => setPurpose(e.target.value as Payment["purpose"])}>
            <option value="LEVEL_4_INSTALLMENT">CIPS Level 4 instalment</option><option value="EXAM_FEE">Exam fee</option>
          </select>
        </label>
        <label className="text-sm font-medium">Agreed amount (USD)
          <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" inputMode="decimal" pattern="\d+(\.\d{1,2})?" required placeholder="214.00" value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
        <label className="text-sm font-medium">{purpose === "EXAM_FEE" ? "Exam and sitting details" : "Description (optional)"}
          <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" required={purpose === "EXAM_FEE"} placeholder={purpose === "EXAM_FEE" ? "e.g. CIPS Level 4 CR exam, remote" : "CIPS Level 4 instalment"} value={description} onChange={e => setDescription(e.target.value)} />
        </label>
      </div>
      <button disabled={busy} className="mt-5 rounded-lg bg-[#0B73B9] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Creating..." : "Create payment link"}</button>
    </form>
    {message && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    {createdUrl && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
      <p className="font-semibold text-green-900">Link ready to share with the customer</p>
      <a href={createdUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-[#0B73B9] underline">{createdUrl}</a>
      <button type="button" onClick={() => void navigator.clipboard.writeText(createdUrl)} className="mt-3 rounded border border-green-300 px-3 py-1.5">Copy link</button>
    </div>}
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Recent requests</h2>
      <div className="space-y-3">{payments.length === 0 && <p className="text-sm text-slate-500">No payment requests yet.</p>}
        {payments.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm">
          <div><Link className="font-semibold text-[#0B73B9]" href={`/dashboard/leads/${payment.lead.id}`}>{payment.lead.firstName} {payment.lead.lastName}</Link>
            <p className="text-slate-600">{payment.purpose === "EXAM_FEE" ? "Exam fee" : "Level 4 instalment"} · ${payment.amountUsd} · {payment.status}</p>
            {payment.description && <p className="text-slate-500">{payment.description}</p>}</div>
          {payment.status === "OPEN" && <div className="flex gap-2">
            <button type="button" onClick={() => void newLink(payment.id)} className="rounded border border-slate-300 px-3 py-1.5 text-slate-700">New share link</button>
            <button type="button" onClick={() => void cancel(payment.id)} className="rounded border border-red-200 px-3 py-1.5 text-red-700">Cancel link</button>
          </div>}
        </div>)}
      </div>
    </section>
  </div>;
}
