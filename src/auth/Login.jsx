import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const signIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F5EFE0",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif",
        color: "#0F1E33",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFFFFF",
          border: "1px solid #E0D8C4",
          borderRadius: 14,
          padding: 20,
          boxShadow: "0 10px 30px rgba(15, 30, 51, 0.08)",
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 600, color: "#1E3A5F" }}>Iniciar sesión</h2>
        <div style={{ marginTop: 6, fontSize: 13, color: "#5A6B80" }}>
          Acceso seguro a la plataforma clínica.
        </div>

        <form onSubmit={signIn} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#5A6B80" }}>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="tu@email.com"
              required
              autoComplete="email"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #E0D8C4",
                fontSize: 14,
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#5A6B80" }}>
            Contraseña
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #E0D8C4",
                fontSize: 14,
                outline: "none",
              }}
            />
          </label>

          <button
            disabled={loading}
            type="submit"
            style={{
              marginTop: 4,
              padding: "11px 12px",
              borderRadius: 12,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background: "#1E3A5F",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {error ? (
            <div style={{ marginTop: 4, color: "#A04545", fontSize: 13 }}>{error}</div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

