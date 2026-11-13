
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import "./contract.css";

const experiences = [
  { level: "C", title: "Beginner Coach" },
  { level: "B", title: "Professional Coach" },
  { level: "A", title: "Elite Coach" },
];

export default function ContractPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [managerName, setManagerName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [experience, setExperience] = useState("C");
  const [signature, setSignature] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const displayedAvatar = previewUrl || avatar;

  useEffect(() => {
    if (!previewUrl) return;

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    async function loadContract() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.replace("/");
          return;
        }

        const user = authData.user;
        setUserId(user.id);

        const name =
          user.user_metadata?.manager_name ||
          user.email?.split("@")[0] ||
          "Manager";

        setManagerName(name);

        const { data, error } = await supabase
          .from("manager_contracts")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

if (data?.signed_at && data?.signature_data) {
  // already signed: never ask again
  router.replace(data.selected_club ? "/game/dashboard" : "/game/leagues");
  return;
}

if (data) {
  setManagerName(data.manager_name || name);
          // Load previously uploaded photo
          const savedAvatar = data.avatar || "";

          setAvatar(
            savedAvatar.startsWith("http") ? savedAvatar : ""
          );

          setExperience(data.experience || "C");
          setSignature(data.signature_data || null);
          setSignedAt(data.signed_at || null);
        }
      } catch (error) {
        console.error("Contract loading error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadContract();
  }, [router]);

  function handlePhotoChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Please choose a JPG, PNG or WEBP image.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB.");
      e.target.value = "";
      return;
    }

    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function getCanvasContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const context = canvas.getContext("2d");
    if (!context) return null;

    return { canvas, context };
  }

  function startDrawing(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    const result = getCanvasContext();
    if (!result) return;

    const { canvas, context } = result;
    const rect = canvas.getBoundingClientRect();

    const x =
      ((e.clientX - rect.left) / rect.width) * canvas.width;

    const y =
      ((e.clientY - rect.top) / rect.height) * canvas.height;

    context.beginPath();
    context.moveTo(x, y);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#182B49";

    canvas.setPointerCapture(e.pointerId);

    setDrawing(true);
    setHasSignature(true);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;

    const result = getCanvasContext();
    if (!result) return;

    const { canvas, context } = result;
    const rect = canvas.getBoundingClientRect();

    const x =
      ((e.clientX - rect.left) / rect.width) * canvas.width;

    const y =
      ((e.clientY - rect.top) / rect.height) * canvas.height;

    context.lineTo(x, y);
    context.stroke();
  }

  function stopDrawing() {
    setDrawing(false);
  }

  function clearSignature() {
    const result = getCanvasContext();

    if (result) {
      result.context.clearRect(
        0,
        0,
        result.canvas.width,
        result.canvas.height
      );
    }

    setHasSignature(false);
    setSignature(null);
    setSignedAt(null);
  }

  async function signContract() {
    if (!userId || !managerName.trim()) return;

    if (!hasSignature && !signature) {
      alert("Please sign your contract first.");
      return;
    }

    setSaving(true);

    try {
      let finalAvatar = avatar;

      // Upload selected photo to Supabase Storage
      if (photoFile) {
        const extension =
          photoFile.name.split(".").pop()?.toLowerCase() || "jpg";

        const filePath =
          `${userId}/${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("manager-avatars")
          .upload(filePath, photoFile, {
            contentType: photoFile.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("manager-avatars")
          .getPublicUrl(filePath);

        finalAvatar = publicData.publicUrl;
      }

      const canvasSignature =
        signature ||
        canvasRef.current?.toDataURL("image/png");

      if (!canvasSignature) {
        throw new Error("Signature could not be created.");
      }

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("manager_contracts")
        .upsert(
          {
            user_id: userId,
            manager_name: managerName.trim(),
            avatar: finalAvatar,
            experience,
            signature_data: canvasSignature,
            signed_at: now,
            updated_at: now,
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      setAvatar(finalAvatar);
      setPhotoFile(null);
      setPreviewUrl("");
      setSignature(canvasSignature);
      setSignedAt(now);

     alert("Your manager contract has been signed successfully!");

router.replace("/game/leagues");
router.refresh();
    } catch (error) {
      console.error("Contract saving error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="gsm-loading">
        PREPARING YOUR OFFICIAL CONTRACT...
      </main>
    );
  }

  return (
    <main className="gsm-contract-page">

      <div className="gx-curtain" aria-hidden="true" />
      <div className="ct-bg gx-kb" aria-hidden="true" />
      <GameHud step={1} />

      <section className="gsm-paper">

        <div className="gsm-top">
          <div className="gsm-seal">
            <GsmMark size={46} />
          </div>

          <div className="gsm-title">
            <span>GLOBAL SOCCER MANAGER</span>
            <h1>MANAGER APPOINTMENT</h1>
            <p>OFFICIAL MANAGER CONTRACT</p>
          </div>

          <div className="gsm-number">
            CONTRACT
            <strong>GSM-2026</strong>
          </div>
        </div>

        <div className="gsm-divider" />

        <div className="gsm-welcome">
          <span>THE BEGINNING OF A LEGACY</span>
          <h2>Welcome, Manager.</h2>
          <p>
            Your journey in football management officially begins here.
          </p>
        </div>

        <div className="gsm-profile">

          <div className="gsm-avatar">
            {displayedAvatar ? (
              <img
                src={displayedAvatar}
                alt="Manager portrait"
              />
            ) : (
              <span className="gsm-no-photo">
                NO PHOTO
              </span>
            )}
          </div>

          <div className="gsm-profile-info">
            <label>MANAGER FULL NAME</label>
            <h2>{managerName}</h2>

            <label>POSITION</label>
            <strong>HEAD COACH</strong>
          </div>

        </div>

        <div className="gsm-section">
          <h3>01 / MANAGER PROFILE</h3>

          <p>
            Upload your official manager portrait.
          </p>

          <label className="gsm-upload">
            <span><Icon name="upload" size={18} /></span>
            {photoFile ? "CHANGE PHOTO" : "UPLOAD YOUR PHOTO"}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
            />
          </label>

          <p className="gsm-photo-hint">
            JPG, PNG or WEBP · Maximum size 5MB
          </p>
        </div>

        <div className="gsm-section">
          <h3>02 / TRAINING EXPERIENCE</h3>

          <p>
            Select your starting coaching qualification.
          </p>

          <div className="gsm-experiences">
            {experiences.map((item) => (
              <button
                key={item.level}
                type="button"
                className={
                  experience === item.level ? "active" : ""
                }
                onClick={() => setExperience(item.level)}
              >
                <strong>{item.level}</strong>
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="gsm-section gsm-terms">
          <h3>03 / OFFICIAL APPOINTMENT TERMS</h3>

          <p>
            I hereby accept my appointment as a football manager
            within the Global Soccer Manager universe.
          </p>

          <p>
            I acknowledge my responsibility for managing my
            football career, team development and sporting decisions.
          </p>

          <p>
            My manager identity and signed contract will be
            associated with my GSM account.
          </p>
        </div>

        <div className="gsm-section">
          <h3>04 / MANAGER SIGNATURE</h3>

          <p>
            Sign below using your finger, stylus or mouse.
          </p>

          <div className="gsm-signature">
            {signature ? (
              <img
                src={signature}
                alt="Manager signature"
                className="gsm-signature-image"
              />
            ) : (
              <canvas
                ref={canvasRef}
                width={900}
                height={240}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                onPointerLeave={stopDrawing}
              />
            )}
          </div>

          <div className="gsm-signature-footer">
            <span>MANAGER SIGNATURE</span>

            <button
              type="button"
              onClick={clearSignature}
            >
              CLEAR / REDO
            </button>
          </div>

          {signedAt && (
            <p className="gsm-signed-date">
              Previously signed:{" "}
              {new Date(signedAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="gsm-final">
          <div className="gsm-stamp">
            GSM
            <span>APPROVAL</span>
          </div>

          <div className="gsm-final-text">
            GLOBAL SOCCER MANAGER
            <br />
            YOUR CLUB. YOUR RULES. YOUR LEGACY.
          </div>
        </div>

        <button
          type="button"
          className="gsm-sign-button"
          onClick={signContract}
          disabled={saving}
        >
          {saving
            ? "PROCESSING CONTRACT..."
            : "SIGN & ACCEPT CONTRACT"}
          {" →"}
        </button>

        <footer className="gsm-footer">
          <span>GSM OFFICIAL DOCUMENT</span>
          <span>GSM © 2026</span>
          <span>MANAGER CONTRACT</span>
        </footer>

      </section>
    </main>
  );
}
