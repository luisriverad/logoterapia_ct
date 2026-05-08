import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function Monogram({ size = 96 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Claudia Talamantes Dosal"
    >
      <defs>
        <linearGradient id="ctGold" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E9C77B" />
          <stop offset="55%" stopColor="#C9A24A" />
          <stop offset="100%" stopColor="#8C6A28" />
        </linearGradient>
        <linearGradient id="ctRing" x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5EFE0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#E0D8C4" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Outer ring */}
      <circle cx="60" cy="60" r="56" stroke="url(#ctRing)" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="49" stroke="#C9A24A" strokeOpacity="0.55" strokeWidth="0.75" />

      {/* C */}
      <path
        d="M78 38 C 66 30, 48 32, 40 44 C 32 56, 34 72, 44 80 C 54 88, 70 88, 78 82"
        stroke="url(#ctGold)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* T */}
      <path
        d="M50 50 H 88 M 69 50 V 92"
        stroke="url(#ctGold)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Decorative dots */}
      <circle cx="60" cy="8" r="1.5" fill="#C9A24A" />
      <circle cx="60" cy="112" r="1.5" fill="#C9A24A" />
    </svg>
  );
}

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
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
        background: "#F5EFE0",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif",
        color: "#0F1E33",
      }}
    >
      {/* ============ PANEL DE MARCA ============ */}
      <aside
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "56px 56px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          color: "#F5EFE0",
          background:
            "radial-gradient(120% 80% at 0% 0%, #284B7A 0%, #1E3A5F 45%, #0F1E33 100%)",
          minHeight: "100vh",
        }}
      >
        {/* Texturas decorativas */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 85% 15%, rgba(201,162,74,0.18), transparent 45%), radial-gradient(circle at 10% 90%, rgba(201,162,74,0.12), transparent 40%)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 40,
            right: 40,
            width: 220,
            height: 220,
            border: "1px solid rgba(245,239,224,0.18)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 70,
            right: 70,
            width: 160,
            height: 160,
            border: "1px solid rgba(201,162,74,0.35)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        {/* Header de marca */}
        <header style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#C9A24A",
              boxShadow: "0 0 0 4px rgba(201,162,74,0.18)",
            }}
          />
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#E0D8C4",
              fontWeight: 600,
            }}
          >
            Logoterapia · Consulta Privada
          </span>
        </header>

        {/* Núcleo de marca */}
        <div style={{ position: "relative", display: "grid", gap: 28 }}>
          <Monogram size={104} />

          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
                fontSize: "clamp(40px, 5vw, 64px)",
                lineHeight: 1.02,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "#F5EFE0",
              }}
            >
              Claudia
              <br />
              <span style={{ fontStyle: "italic", color: "#E9C77B" }}>Talamantes</span>
              <br />
              Dosal
            </h1>
            <div
              style={{
                marginTop: 18,
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: "#E0D8C4",
                fontSize: 13,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 36,
                  height: 1,
                  background: "#C9A24A",
                }}
              />
              Logoterapeuta
            </div>
          </div>
        </div>

        {/* Cita inferior */}
        <footer style={{ position: "relative", maxWidth: 460 }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 20,
              fontStyle: "italic",
              lineHeight: 1.5,
              color: "#F5EFE0",
              opacity: 0.92,
            }}
          >
            “Cuando ya no podemos cambiar la situación, nos vemos obligados a cambiarnos a
            nosotros mismos.”
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#C9A24A",
              fontWeight: 600,
            }}
          >
            Viktor E. Frankl
          </div>
        </footer>
      </aside>

      {/* ============ PANEL DE LOGIN ============ */}
      <main
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 28px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#FFFFFF",
            border: "1px solid #E0D8C4",
            borderRadius: 18,
            padding: "32px 28px",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.6) inset, 0 20px 50px rgba(15, 30, 51, 0.10)",
          }}
        >
          {/* Logo compacto solo visible en pantallas pequeñas */}
          <div
            className="login-mobile-brand"
            style={{ display: "none", textAlign: "center", marginBottom: 8 }}
          >
            <Monogram size={64} />
            <div
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 22,
                marginTop: 8,
                color: "#1E3A5F",
              }}
            >
              Claudia Talamantes Dosal
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "#8C6A28",
                marginTop: 4,
              }}
            >
              Logoterapeuta
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#8C6A28",
              fontWeight: 600,
            }}
          >
            Bienvenida
          </div>
          <h2
            style={{
              margin: "6px 0 0",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 32,
              fontWeight: 500,
              color: "#1E3A5F",
              letterSpacing: "-0.01em",
            }}
          >
            Iniciar sesión
          </h2>
          <div style={{ marginTop: 6, fontSize: 13, color: "#5A6B80" }}>
            Acceso seguro a la plataforma clínica.
          </div>

          <div
            aria-hidden
            style={{
              height: 1,
              background:
                "linear-gradient(to right, transparent, #E0D8C4 30%, #E0D8C4 70%, transparent)",
              margin: "20px 0 4px",
            }}
          />

          <form onSubmit={signIn} style={{ display: "grid", gap: 14, marginTop: 16 }}>
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
                  padding: "11px 13px",
                  borderRadius: 10,
                  border: "1px solid #E0D8C4",
                  fontSize: 14,
                  outline: "none",
                  background: "#FBF7EC",
                  transition: "border-color 120ms ease, box-shadow 120ms ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#C9A24A";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,162,74,0.18)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E0D8C4";
                  e.currentTarget.style.boxShadow = "none";
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
                  padding: "11px 13px",
                  borderRadius: 10,
                  border: "1px solid #E0D8C4",
                  fontSize: 14,
                  outline: "none",
                  background: "#FBF7EC",
                  transition: "border-color 120ms ease, box-shadow 120ms ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#C9A24A";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,162,74,0.18)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E0D8C4";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </label>

            <button
              disabled={loading}
              type="submit"
              style={{
                marginTop: 6,
                padding: "13px 14px",
                borderRadius: 12,
                border: "1px solid #15294A",
                cursor: loading ? "not-allowed" : "pointer",
                background:
                  "linear-gradient(180deg, #284B7A 0%, #1E3A5F 60%, #15294A 100%)",
                color: "#F5EFE0",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.04em",
                opacity: loading ? 0.8 : 1,
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.18) inset, 0 8px 18px rgba(15,30,51,0.18)",
                transition: "transform 120ms ease, box-shadow 120ms ease",
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {error ? (
              <div
                role="alert"
                style={{
                  marginTop: 4,
                  color: "#7A2E2E",
                  background: "#F7E6E1",
                  border: "1px solid #E8C9C0",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            ) : null}
          </form>

          <div
            style={{
              marginTop: 22,
              paddingTop: 16,
              borderTop: "1px dashed #E0D8C4",
              fontSize: 11,
              color: "#8B8470",
              textAlign: "center",
              letterSpacing: "0.08em",
            }}
          >
            © {new Date().getFullYear()} · Claudia Talamantes Dosal · Logoterapia
          </div>
        </div>
      </main>

      {/* Responsive: en pantallas chicas, una sola columna y se muestra el brand compacto */}
      <style>{`
        @media (max-width: 880px) {
          aside { display: none !important; }
          main { min-height: 100vh; }
          .login-mobile-brand { display: block !important; }
          div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
