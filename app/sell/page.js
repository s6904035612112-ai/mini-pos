"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับเลือกใส่ตะกร้า)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ตะกร้าสินค้าที่กำลังจะขาย: [{ productId, sku, name, price, unit, stock, quantity }]
  const [cart, setCart] = useState([]);

  // สถานะข้อความแจ้งเตือน/ยืนยัน
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

  // ยอดรวมทั้งหมดในตะกร้า
  const grandTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // เพิ่มสินค้าลงตะกร้า (ถ้ามีอยู่แล้วให้เพิ่มจำนวนขึ้น 1 โดยไม่เกิน stock)
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

  // แก้จำนวนสินค้าในตะกร้า (คุมไม่ให้ต่ำกว่า 1 หรือเกิน stock)
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

  // ยืนยันการขายทั้งตะกร้า
  async function handleConfirmSale() {
    setErrorMsg("");
    setSuccessMsg("");

    if (cart.length === 0) {
      setErrorMsg("ยังไม่มีสินค้าในตะกร้า");
      return;
    }

    // ตรวจสอบ stock อีกครั้งก่อนบันทึกจริง (กันกรณีสต๊อกเปลี่ยนระหว่างเลือกสินค้า)
    for (const item of cart) {
      const current = products.find((p) => p.id === item.productId);
      if (!current || item.quantity > current.stock) {
        setErrorMsg(`${item.name} คงเหลือไม่พอ กรุณาตรวจสอบตะกร้าอีกครั้ง`);
        return;
      }
    }

    setSubmitting(true);
    const soldAt = new Date().toISOString();

    // 1) บันทึกทุกรายการในตะกร้าลงตาราง sales (แถวละ 1 สินค้า)
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

    // 2) อัปเดต stock ของแต่ละสินค้าให้ลดลงตามจำนวนที่ขาย
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
    }

    setSuccessMsg(
      `ขายสำเร็จ ${cart.length} รายการ รวม ${grandTotal.toFixed(2)} บาท`
    );
    clearCart();
    setSubmitting(false);
    fetchProducts();
  }

  return (
    <div>
      {/* แถบสรุปยอดรวม ตรึงไว้ด้านบน ตัวใหญ่ ให้เห็นชัดทั้งฝั่งผู้ขายและลูกค้า */}
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
          {/* ฝั่งซ้าย: รายการสินค้าให้กดเพิ่มลงตะกร้า */}
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

          {/* ฝั่งขวา: ตะกร้าสินค้าที่จะขาย */}
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
