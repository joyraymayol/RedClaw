import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both w-full max-w-sm duration-500">
      <LoginForm />
    </div>
  );
}
