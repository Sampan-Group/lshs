"use client"

import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/app/contexts/AuthContext"
import { apiUrl, fetchApi } from "../api"

type Staff = {
  id: number
  name: string
  email: string
  role: "ADMIN" | "MANAGER" | "SALES_PERSON"
  isActive: boolean
  activated: boolean
}

type StaffInput = {
  name: string
  email: string
  role: "MANAGER" | "SALES_PERSON"
}

const fieldClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0B73B9] focus:ring-2 focus:ring-[#0B73B9]/15"

export default function StaffPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<StaffInput>({ name: "", email: "", role: "SALES_PERSON" })
  const [createdEmail, setCreatedEmail] = useState("")
  const staffQuery = useQuery({
    queryKey: ["staff"],
    enabled: user?.role === "ADMIN",
    queryFn: () => fetchApi<{ success: true; data: Staff[] }>(`${apiUrl}/staff`),
  })
  const addStaff = useMutation({
    mutationFn: (input: StaffInput) => fetchApi<{ success: true; data: Staff }>(`${apiUrl}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    onSuccess: ({ data }) => {
      setCreatedEmail(data.email)
      setForm({ name: "", email: "", role: "SALES_PERSON" })
      queryClient.invalidateQueries({ queryKey: ["staff"] })
    },
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreatedEmail("")
    addStaff.mutate({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() })
  }

  return (
    <main className="mx-auto max-w-6xl space-y-7 px-5 py-7 sm:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0B73B9]">Administration</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Staff access</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Approve a staff email before that person creates a CRM password. Only administrators can add staff.</p>
      </header>

      <section id="add-staff" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Add staff member</h2>
        <p className="mt-1 text-sm text-slate-500">After approval, ask them to open the sign-in page, enter this email, create a password, and verify their email.</p>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-slate-700">Full name
            <input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClass} />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">Email address
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClass} />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">CRM role
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as StaffInput["role"] })} className={fieldClass}>
              <option value="SALES_PERSON">Sales person — assigned leads only</option>
              <option value="MANAGER">Manager — all leads</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={addStaff.isPending} className="rounded-lg bg-[#0B73B9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#085C92] disabled:opacity-50">
              {addStaff.isPending ? "Adding..." : "Approve staff email"}
            </button>
          </div>
        </form>
        {createdEmail && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{createdEmail} is approved. Ask them to open <a href="/signin" className="font-semibold underline">the sign-in page</a> and set up their account.</p>}
        {addStaff.isError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{addStaff.error instanceof Error ? addStaff.error.message : "Unable to add staff."}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Approved staff</h2>
        {staffQuery.isPending && <p className="mt-4 text-sm text-slate-500">Loading staff...</p>}
        {staffQuery.isError && <p role="alert" className="mt-4 text-sm text-red-700">{staffQuery.error instanceof Error ? staffQuery.error.message : "Unable to load staff."}</p>}
        {staffQuery.data && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-4">Name</th><th className="py-3 pr-4">Email</th><th className="py-3 pr-4">Role</th><th className="py-3">Status</th></tr></thead>
              <tbody>
                {staffQuery.data.data.map((staff) => (
                  <tr key={staff.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-medium text-slate-900">{staff.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{staff.email}</td>
                    <td className="py-3 pr-4 text-slate-600">{staff.role.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="py-3 text-slate-600">{!staff.isActive ? "Inactive" : staff.activated ? "Active" : "Awaiting setup"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
