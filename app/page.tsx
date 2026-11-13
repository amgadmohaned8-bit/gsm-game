
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { nextRoute } from "@/lib/onboarding";
import GsmMark from "@/components/GsmMark";
import Icon from "@/components/Icon";
import "./home.css";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("success");
  const [loading, setLoading] = useState(false);
  // already signed in (the session is kept on the device): skip the form
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !off) {
          router.replace(await nextRoute(supabase, session.user.id));
          return;
        }
      } catch { /* show the form */ }
      if (!off) setChecking(false);
    })();
    return () => { off = true; };
  }, [router]);

  // gentle mouse parallax on the stadium layers (skipped for reduced motion)
  const stageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", String(e.clientX / window.innerWidth - 0.5));
        el.style.setProperty("--py", String(e.clientY / window.innerHeight - 0.5));
      });
    };
    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  function changeMode(newMode: "login" | "register") {
    setMode(newMode);
    setMessage("");
    setShowPassword(false);
  }
  async function navigateAfterLogin(userId: string) {
  router.replace(await nextRoute(supabase, userId));
  router.refresh();
}

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (loading) return;

    if (mode === "register") {
      if (password !== confirmPassword) {
        setMessageType("error");
        setMessage("Passwords do not match.");
        return;
      }

      if (password.length < 8) {
        setMessageType("error");
        setMessage("Password must be at least 8 characters.");
        return;
      }

      if (!name.trim()) {
        setMessageType("error");
        setMessage("Please enter your manager name.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              manager_name: name.trim(),
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        setMessageType("success");

        if (data.session && data.user) {
  await navigateAfterLogin(data.user.id);
} else {
  setMessage(
    "Account created! Please check your email to confirm your account before logging in."
  );
}

      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

       if (error) throw error;

const { data: authData } = await supabase.auth.getUser();

if (!authData.user) {
  throw new Error("Could not retrieve your account.");
}

await navigateAfterLogin(authData.user.id);
      }

    } catch (error: unknown) {
      setMessageType("error");

      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const ticker = [
    "Pick a league",
    "Take over a club",
    "Sign your players",
    "Set your formation",
    "Win the title",
    "Build your legacy",
  ];

  if (checking) {
    return (
      <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", background: "#05070d" }} aria-busy="true">
        <GsmMark size={72} />
      </main>
    );
  }

  return (
    <main className="lx gx-grain" ref={stageRef}>
      <div className="gx-curtain" aria-hidden="true" />

      <div className="lx-layer lx-layer-bg" aria-hidden="true">
        <div className="lx-bg gx-kb" />
      </div>
      <div className="lx-shade" aria-hidden="true" />
      <div className="lx-flood lx-flood-a" aria-hidden="true" />
      <div className="lx-flood lx-flood-b" aria-hidden="true" />

      <div className="lx-layer lx-layer-word" aria-hidden="true">
        <span className="lx-word">GSM</span>
      </div>

      <div className="lx-layer lx-layer-manager">
        <Image
          src="/animations/manager.png"
          alt="Football manager"
          width={900}
          height={1300}
          priority
          className="lx-manager"
        />
      </div>

      <header className="lx-top">
        <div className="lx-logo">
          <GsmMark size={42} />
          <div>
            <strong>GSM</strong>
            <span>Global Soccer Manager</span>
          </div>
        </div>
        <span className="lx-season">
          Season <b>2026/27</b>
        </span>
      </header>

      <div className="lx-main">
        <section className="lx-copy">
          <p className="lx-kicker">Football management game</p>
          <h1>
            <span className="gx-slant">Your club.</span>
            <span className="gx-slant">Your rules.</span>
            <span className="gx-slant lx-gold">Your legacy.</span>
          </h1>
        </section>

        <section className="lx-panel gx-cut" aria-label="Sign in">
          <div className="lx-tabs" role="tablist" aria-label="Account">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => changeMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => changeMode("register")}
            >
              Create account
            </button>
          </div>

          <div className="lx-form-wrap" key={mode}>
            <div className="lx-heading">
              <h2>
                {mode === "login" ? "Welcome back, Manager." : "Start your career."}
              </h2>
              <p>
                {mode === "login"
                  ? "Your club is waiting for you."
                  : "Create your manager profile and step into the dugout."}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className="field">
                  <label htmlFor="manager-name">Manager name</label>
                  <div className="field-input">
                    <span className="field-icon"><Icon name="user" /></span>
                    <input
                      id="manager-name"
                      type="text"
                      placeholder="Enter your manager name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="field">
                <label htmlFor="email">Email</label>
                <div className="field-input">
                  <span className="field-icon"><Icon name="mail" /></span>
                  <input
                    id="email"
                    type="email"
                    placeholder="manager@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="field-input">
                  <span className="field-icon"><Icon name="lock" /></span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                  />
                  <button
                    type="button"
                    className="show-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div className="field">
                  <label htmlFor="confirm-password">Confirm password</label>
                  <div className="field-input">
                    <span className="field-icon"><Icon name="lock" /></span>
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
              )}

              {mode === "login" && (
                <div className="form-options">
                  <label>
                    <input type="checkbox" />
                    Remember me
                  </label>
                  <button type="button">Forgot password?</button>
                </div>
              )}

              {message && (
                <div
                  className="auth-message"
                  data-type={messageType}
                  role={messageType === "error" ? "alert" : "status"}
                >
                  {message}
                </div>
              )}

              <button className="gx-btn lx-submit" type="submit" disabled={loading}>
                <span>
                  {loading
                    ? "Please wait..."
                    : mode === "login"
                      ? "Enter the game"
                      : "Create account"}
                </span>
                <Icon name="arrow-right" size={22} strokeWidth={2.2} />
              </button>
            </form>
          </div>
        </section>
      </div>

      <div className="lx-ticker" aria-hidden="true">
        <div className="lx-ticker-track">
          {[0, 1].map((copy) => (
            <ul key={copy}>
              {ticker.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </main>
  );
}
