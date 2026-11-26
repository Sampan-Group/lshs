"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/app/dashboard/api";

type Payment = {
  purpose: "LEVEL_4_INSTALLMENT" | "EXAM_FEE";
  description: string | null; amountUsd: string; status: string;
  lead: { firstName: string; lastName: string | null };
};

export default function PayPage() {
  const { token } = useParams<{ token: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${apiUrl}/payments/public/${token}`, { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.message); return body.data as Payment; })
      .then(setPayment)
      .catch(error => setError(error instanceof Error ? error.message : "Payment link unavailable"));
  }, [token]);

  async function pay() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiUrl}/payments/public/${token}/start`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Could not start payment");
      window.location.assign(body.data.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not start payment");
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <Link href="/" className="text-sm font-semibold text-[#0B73B9]">London School of Higher Studies</Link>
      <h1 className="mt-8 text-3xl font-semibold">Payment request</h1>
      {!payment && !error && <p className="mt-4 text-slate-600">Loading your payment details...</p>}
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {payment && <>
        <div className="mt-6 space-y-4 rounded-xl bg-slate-50 p-5">
          <div><p className="text-xs uppercase tracking-wide text-slate-500">For</p><p className="font-medium">{payment.lead.firstName} {payment.lead.lastName}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Purpose</p><p className="font-medium">{payment.description || (payment.purpose === "EXAM_FEE" ? "Exam fee" : "CIPS Level 4 instalment")}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Amount</p><p className="text-3xl font-bold">${payment.amountUsd} <span className="text-base font-normal">USD</span></p></div>
        </div>
        {payment.status === "PAID" ? <p className="mt-6 rounded-lg bg-green-50 p-4 font-semibold text-green-800">Payment confirmed. Thank you.</p> :
          payment.status === "REVIEW" ? <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-900">Payment received and under review. Please contact the school before trying again.</p> :
          payment.status === "CANCELLED" ? <p className="mt-6 rounded-lg bg-slate-100 p-4">This payment link has been cancelled.</p> :
          <button onClick={() => void pay()} disabled={busy} className="mt-6 w-full rounded-lg bg-[#0B73B9] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Opening secure checkout..." : "Pay securely"}</button>}
      </>}
    </div>
  </main>;
}
