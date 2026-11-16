"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/football/finance";
import Icon from "@/components/Icon";

export const fm = formatMoney;

export function ClubSquadModal({ club, squad, onClose }: { club: any; squad: any[]; onClose: () => void }) {
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [offerAmount, setOfferAmount] = useState<number>(10);
  const [busy, setBusy] = useState(false);

  async function sendOffer() {
    if (!selectedPlayer) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("manager_offers").insert({
      room_id: "00000000-0000-0000-0000-000000000000",
      buyer_id: user.id,
      buyer_club: "my-club-id",
      seller_id: club.user_id || user.id,
      seller_club: club.id,
      player_id: selectedPlayer.id,
      amount: offerAmount,
      season: "2025/2026",
      status: "open"
    });

    setBusy(false);
    if (error) alert("فشل إرسال العرض: " + error.message);
    else {
      alert("تم إرسال العرض بنجاح إلى النادي!");
      setSelectedPlayer(null);
    }
  }

  return (
    <div className="tb bk-modal" role="presentation" onClick={onClose}>
      <div className="tb-panel gx-cut" role="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px" }}>
        <button type="button" className="tb-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>

        <header className="bk-mh">
          <h2>قائمة لاعبي نادي {club.name}</h2>
        </header>

        <div className="tb-stage" style={{ padding: "20px", maxHeight: "450px", overflowY: "auto" }}>
          <table className="tr-table" style={{ width: "100%", color: "#fff" }}>
            <thead>
              <tr>
                <th>اللاعب</th>
                <th>المركز</th>
                <th>التقييم</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.position}</td>
                  <td className="is-gold">{player.rating}</td>
                  <td>
                    <button 
                      className="gx-btn-small" 
                      onClick={() => setSelectedPlayer(player)}
                    >
                      شراء / تفاوض
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedPlayer && (
            <div style={{ marginTop: "20px", background: "#111", padding: "15px", borderRadius: "6px", border: "1px solid #d4af37" }}>
              <h3 style={{ color: "#fff", marginBottom: "10px" }}>تقديم عرض لشراء {selectedPlayer.name}</h3>
              <input 
                type="number" 
                value={offerAmount} 
                onChange={(e) => setOfferAmount(Number(e.target.value))}
                style={{ padding: "8px", width: "100%", background: "#000", color: "#fff", border: "1px solid #444", marginBottom: "10px" }}
              />
              <button className="gx-btn" disabled={busy} onClick={sendOffer}>
                {busy ? "جاري الإرسال..." : "إرسال العرض الرسمي"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}