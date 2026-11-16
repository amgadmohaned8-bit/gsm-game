"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/football/finance";

export const fm = formatMoney;

export function TransferWindowLog() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDeals() {
      const { data, error } = await supabase
        .from("transfers")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) setDeals(data);
      setLoading(false);
    }
    loadDeals();
  }, []);

  if (loading) return <div>جاري تحميل سجل الانتقالات...</div>;

  return (
    <div className="tr-container" style={{ padding: "20px" }}>
      <header className="tr-header">
        <h1 style={{ color: "#d4af37", marginBottom: "15px" }}>سجل انتقالات الدوري</h1>
      </header>

      <table className="tr-table" style={{ width: "100%", color: "#fff" }}>
        <thead>
          <tr>
            <th>اللاعب</th>
            <th>من نادي</th>
            <th>إلى نادي</th>
            <th>القيمة</th>
            <th>التاريخ / الجولة</th>
          </tr>
        </thead>
        <tbody>
          {deals.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", color: "#888", padding: "20px" }}>
                لا توجد انتقالات مسجلة حتى الآن في هذا الموسم.
              </td>
            </tr>
          ) : (
            deals.map((deal) => (
              <tr key={deal.id}>
                <td>{deal.player_id}</td>
                <td>{deal.from_club}</td>
                <td>{deal.to_club}</td>
                <td className="is-gold">{fm(deal.fee)}</td>
                <td>الجولة {deal.matchday}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}