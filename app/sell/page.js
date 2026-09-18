"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

// เกณฑ์แจ้งเตือนสต๊อกใกล้หมด
const LOW_STOCK_THRESHOLD = 5;

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  const grandTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  function addToCart(product) {
    setErrorMsg("");
    setSuccessMsg("");

    if (product.stock <= 0) {
      setErrorMsg(`${product.name} หมดสต๊อก`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setErrorMsg(`${product.name} คงเหลือไม่พอ`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          unit: product.unit,
          stock: product.stock,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(productId, rawValue) {
    setErrorMsg("");
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    let qty = parseInt(rawValue, 10);
    if (isNaN(qty) || qty < 1) qty = 1;
    if (qty > item.stock) {
      qty = item.stock;
      setErrorMsg(`${item.name} คงเหลือไม่พอ (สูงสุด ${item.stock} ${item.unit})`);
    }

    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clearCart() {
    setCart([]);
  }

  // ส่งข้อความแจ้งเตือนไป Telegram ผ่าน API route ของเราเอง (ไม่ยิงตรงจาก client)
  // ทำงานแบบ fire-and-forget: ถ้า error ก็แค่ log ไว้ ไม่ทำให้ระบบขายพัง
  async function sendTelegramNotification(text) {
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        console.error("Telegram notify failed:", await res.text());
      }
    } catch (err) {
      // ไม่ throw ต่อ เพื่อไม่ให้กระทบ flow การขาย
      console.error("Telegram notify error:", err);
    }
  }

  // สร้างข้อความแจ้งเตือน Order ใหม่ (รูปแบบ HTML ตามที่กำหนด)
  function buildOrderMessage(item, newStock) {
    const now = new Date().toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return (
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- จำนวน: ${item.quantity} ชิ้น\n` +
      `- ราคารวม: ${(item.price * item.quantity).toFixed(2)} บาท\n` +
      `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ชิ้น\n` +
      `- เวลา: ${now}`
    );
  }

  // สร้างข้อความแจ้งเตือนสต๊อกใกล้หมด
  function buildLowStockMessage(item, newStock) {
    return (
      `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- คงเหลือเพียง: ${newStock} ชิ้น\n` +
      `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
    );
  }

  async function handleConfirmSale() {
    setErrorMsg("");
    setSuccessMsg("");

    if (cart.length === 0) {
      setErrorMsg("ยังไม่มีสินค้าในตะกร้า");
      return;
    }

    for (const item of cart) {
      const current = products.find((p) => p.id === item.productId);
      if (!current || item.quantity > current.stock) {
        setErrorMsg(`${item.name} คงเหลือไม่พอ กรุณาตรวจสอบตะกร้าอีกครั้ง`);
        return;
      }
    }

    setSubmitting(true);
    const soldAt = new Date().toISOString();

    const salesRows = cart.map((item) => ({
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      sold_at: soldAt,
    }));

    const { error: saleError } = await supabase.from("sales").insert(salesRows);
    if (saleError) {
      setErrorMsg(saleError.message);
      setSubmitting(false);
      return;
    }

    // อัปเดต stock ของแต่ละสินค้า พร้อมเก็บ stock ใหม่ไว้ใช้แจ้งเตือน
    const updatedStocks = []; // [{ item, newStock }]
    for (const item of cart) {
      const current = products.find((p) => p.id === item.productId);
      const newStock = (current?.stock ?? item.stock) - item.quantity;

      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", item.productId);

      if (updateError) {
        setErrorMsg(updateError.message);
        setSubmitting(false);
        fetchProducts();
        return;
      }

      updatedStocks.push({ item, newStock });
    }

    // ตัดสต๊อกสำเร็จแล้ว -> แสดงผลสำเร็จในเว็บทันที ไม่ต้องรอ Telegram
    setSuccessMsg(
      `ขายสำเร็จ ${cart.length} รายการ รวม ${grandTotal.toFixed(2)} บาท`
    );
    clearCart();
    setSubmitting(false);
    fetchProducts();

    // ยิงแจ้งเตือน Telegram แบบ async แยกออกไป ไม่ await ให้บล็อก UI
    // และห่อด้วย try-catch ในตัวฟังก์ชันแล้ว จึง error ที่นี่ไม่กระทบระบบขาย
    for (const { item, newStock } of updatedStocks) {
      sendTelegramNotification(buildOrderMessage(item, newStock));
      if (newStock <= LOW_STOCK_THRESHOLD) {
        sendTelegramNotification(buildLowStockMessage(item, newStock));
      }
    }
  }

  return (
    <div>
      <div className="sell-summary-bar">
        <div>
          <div className="sell-summary-label">ยอดรวมทั้งหมด</div>
          <div className="sell-summary-total">{grandTotal.toFixed(2)} บาท</div>
        </div>
        <button
          className="sell-confirm-btn"
          onClick={handleConfirmSale}
          disabled={submitting || cart.length === 0}
        >
          {submitting ? "กำลังบันทึก..." : "ยืนยันการขาย"}
        </button>
      </div>

      {errorMsg && (
        <p style={{ color: "red", fontWeight: "bold" }}>{errorMsg}</p>
      )}
      {successMsg && (
        <p style={{ color: "green", fontWeight: "bold" }}>{successMsg}</p>
      )}

      {loading ? (
        <p>กำลังโหลดข้อมูลสินค้า...</p>
      ) : (
        <div className="sell-layout">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>เลือกสินค้า</h2>
            <div className="product-grid">
              {products.map((p) => (
                <button
                  key={p.id}
                  className="product-card"
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                >
                  <div className="product-card-name">{p.name}</div>
                  <div className="product-card-price">{p.price} บาท</div>
                  <div className="product-card-stock">
                    คงเหลือ {p.stock} {p.unit}
                  </div>
                </button>
              ))}
              {products.length === 0 && <p>ยังไม่มีสินค้า</p>}
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>ตะกร้าสินค้า</h2>
            {cart.length === 0 ? (
              <p>ยังไม่มีสินค้าในตะกร้า</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>จำนวน</th>
                    <th>รวม</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        {item.name}
                        <div style={{ fontSize: "12px", color: "#888" }}>
                          {item.price} บาท/{item.unit}
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.productId, e.target.value)
                          }
                          style={{ width: "70px" }}
                        />
                      </td>
                      <td>{(item.price * item.quantity).toFixed(2)}</td>
                      <td>
                        <button onClick={() => removeFromCart(item.productId)}>
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                style={{ marginTop: "12px", backgroundColor: "#999" }}
              >
                ล้างตะกร้า
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
