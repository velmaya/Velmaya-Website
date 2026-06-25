"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<"name" | "email" | "message", string>>;

// Contact form. Client-validated with per-field errors and a success state.
// Backend delivery (email/Supabase) lands in a later milestone; on success we
// surface a prefilled mailto so the message can still be sent today.
export function ContactForm() {
  const [values, setValues] = useState({
    name: "",
    email: "",
    order: "",
    message: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  function set(field: keyof typeof values, v: string) {
    setValues((prev) => ({ ...prev, [field]: v }));
    if (errors[field as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!values.name.trim()) e.name = "Please enter your name.";
    if (!EMAIL_RE.test(values.email.trim()))
      e.email = "Please enter a valid email address.";
    if (values.message.trim().length < 10)
      e.message = "Please add a little more detail (10+ characters).";
    return e;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length === 0) setSubmitted(true);
  }

  if (submitted) {
    const subject = `Velmaya enquiry${values.order ? ` — order ${values.order}` : ""}`;
    const body = `Name: ${values.name}\nEmail: ${values.email}${
      values.order ? `\nOrder: ${values.order}` : ""
    }\n\n${values.message}`;
    const mailto = `mailto:${siteConfig.contact.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-border bg-card p-6"
      >
        <h2 className="font-display text-xl text-foreground">
          Thanks, {values.name.split(" ")[0]}!
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We&rsquo;ve got your message and will reply to{" "}
          <span className="text-foreground">{values.email}</span> soon. For the
          fastest response, WhatsApp is always open. You can also send this
          straight from your email app:
        </p>
        <Button asChild className="mt-4">
          <a href={mailto}>Open in email app</a>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-xl border border-border bg-card p-6"
    >
      <h2 className="font-display text-xl text-foreground">Send a message</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Prefer not to use WhatsApp? Drop us a note.
      </p>
      <div className="mt-5 space-y-4">
        <Field
          id="contact-name"
          label="Your name"
          error={errors.name}
          required
        >
          <Input
            id="contact-name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            placeholder="Your name"
          />
        </Field>

        <Field
          id="contact-email"
          label="Email address"
          error={errors.email}
          required
        >
          <Input
            id="contact-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            placeholder="Email address"
          />
        </Field>

        <Field id="contact-order" label="Order number (optional)">
          <Input
            id="contact-order"
            type="text"
            value={values.order}
            onChange={(e) => set("order", e.target.value)}
            placeholder="Order number (optional)"
          />
        </Field>

        <Field
          id="contact-message"
          label="Your message"
          error={errors.message}
          required
        >
          <textarea
            id="contact-message"
            rows={4}
            value={values.message}
            onChange={(e) => set("message", e.target.value)}
            aria-invalid={!!errors.message}
            aria-describedby={
              errors.message ? "contact-message-error" : undefined
            }
            placeholder="Your message"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
          />
        </Field>

        <Button type="submit" className="w-full">
          Send message
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
        {required ? " (required)" : ""}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
