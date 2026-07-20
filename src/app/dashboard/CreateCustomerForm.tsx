"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCustomer, type CreateCustomerResult } from "./actions";

export default function CreateCustomerForm() {
  const [state, formAction, pending] = useActionState<
    CreateCustomerResult | null,
    FormData
  >(createCustomer, null);

  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful add.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          name="email"
          required
          placeholder="customer@email.com"
          className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />
        <input
          type="text"
          name="name"
          placeholder="Customer name (optional)"
          className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add customer"}
        </button>
      </div>

      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-green-600">Customer added.</p>
      )}
    </form>
  );
}
