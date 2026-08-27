import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../auth";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5 shadow-2xl">
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-500/15 text-brand-400 flex items-center justify-center mx-auto">
            <Shield size={22} />
          </div>
          <h1 className="text-xl font-bold text-white">Sign in</h1>
          <p className="text-sm text-gray-400">
            Use a local account to access the API and dashboard.
          </p>
        </div>
        <div className="space-y-3">
          <Input
            label="Username"
            value={form.username}
            onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
            onKeyDown={async (e) => {
              if (e.key !== "Enter" || submitting) return;
              e.preventDefault();
              setSubmitting(true);
              try {
                await login(form.username, form.password);
              } catch {
                toast.error("Invalid username or password");
              } finally {
                setSubmitting(false);
              }
            }}
          />
          <Button
            variant="primary"
            className="w-full justify-center"
            disabled={!form.username || !form.password || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await login(form.username, form.password);
              } catch {
                toast.error("Invalid username or password");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}
