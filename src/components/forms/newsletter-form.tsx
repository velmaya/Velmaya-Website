"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Footer newsletter signup. Client-side validated with clear success/error
// feedback. Persistence (Supabase newsletter_subscribers) is wired in a later
// milestone — on success today we acknowledge the signup in the UI.
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setStatus("error");
      return;
    }
    setStatus("success");
    setEmail("");
  }

  if (status === "success") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-6 max-w-sm rounded-md border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground"
      >
        Thanks — you&rsquo;re on the list. We&rsquo;ll email you when new pieces
        drop.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 max-w-sm">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address for new-drop updates
      </label>
      <div className="flex gap-2">
        <Input
          id="newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "newsletter-error" : undefined}
          placeholder="Email for new drops"
          className="border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50"
        />
        <Button type="submit" variant="accent">
          Join
        </Button>
      </div>
      {status === "error" && (
        <p
          id="newsletter-error"
          role="alert"
          className="mt-2 text-sm text-primary-foreground/90"
        >
          Please enter a valid email address.
        </p>
      )}
    </form>
  );
}
