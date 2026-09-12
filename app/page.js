"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ProductsPage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // ฟอร์มเพิ่มสินค้าใหม่
  const [newProduct, setNewProduct] = useState({
    sku: "",
    name: "",
    price: "",
    stock: "",
    unit: "",
  });

  // แถวที่กำลังแก้ไข (inline edit) และข้อมูลชั่วคราวระหว่างแก้ไข
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  // โหลดข้อมูลสินค้าตอนเปิดหน้า
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setProducts(data);
      setErrorMsg("");
    }
    setLoading(false);
  }

  // จัดการค่าที่พิมพ์ในฟอร์มเพิ่มสินค้าใหม่
  function handleNewProductChange(e) {
    const { name, value } = e.target;
    setNewProduct((prev) => ({ ...prev, [name]: value }));
  }

  // เพิ่มสินค้าใหม่ลงตาราง products
  async function handleAddProduct(e) {
    e.preventDefault();
    if (!newProduct.sku || !newProduct.name) {
      setErrorMsg("กรุณากรอก SKU และชื่อสินค้า");
      return;
    }

    const { error } = await supabase.from("products").insert([
      {
        sku: newProduct.sku,
        name: newProduct.name,
        price: parseFloat(newProduct.price) || 0,
        stock: parseInt(newProduct.stock, 10) || 0,
        unit: newProduct.unit,
      },
    ]);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // เคลียร์ฟอร์มและโหลดข้อมูลใหม่
    setNewProduct({ sku: "", name: "", price: "", stock: "", unit: "" });
    fetchProducts();
  }

  // ลบสินค้า
  async function handleDelete(id) {
    const confirmed = window.confirm("ต้องการลบสินค้านี้ใช่หรือไม่?");
    if (!confirmed) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    fetchProducts();
  }

  // เริ่มแก้ไขแถว: เก็บค่าปัจจุบันไว้ใน editValues
  function startEdit(product) {
    setEditingId(product.id);
    setEditValues({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditValues((prev) => ({ ...prev, [name]: value }));
  }

  // บันทึกการแก้ไขสินค้า
  async function saveEdit(id) {
    const { error } = await supabase
      .from("products")
      .update({
        sku: editValues.sku,
        name: editValues.name,
        price: parseFloat(editValues.price) || 0,
        stock: parseInt(editValues.stock, 10) || 0,
        unit: editValues.unit,
      })
      .eq("id", id);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setEditingId(null);
    setEditValues({});
    fetchProducts();
  }

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {errorMsg && (
        <p style={{ color: "red", fontWeight: "bold" }}>{errorMsg}</p>
      )}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleAddProduct}>
          <div className="form-row">
            <input
              name="sku"
              placeholder="SKU"
              value={newProduct.sku}
              onChange={handleNewProductChange}
            />
            <input
              name="name"
              placeholder="ชื่อสินค้า"
              value={newProduct.name}
              onChange={handleNewProductChange}
            />
            <input
              name="price"
              type="number"
              step="0.01"
              placeholder="ราคา"
              value={newProduct.price}
              onChange={handleNewProductChange}
            />
            <input
              name="stock"
              type="number"
              placeholder="คงเหลือ"
              value={newProduct.stock}
              onChange={handleNewProductChange}
            />
            <input
              name="unit"
              placeholder="หน่วย (เช่น ชิ้น, ขวด)"
              value={newProduct.unit}
              onChange={handleNewProductChange}
            />
          </div>
          <button type="submit">เพิ่มสินค้า</button>
        </form>
      </div>

      {/* ตารางแสดงรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const isEditing = editingId === product.id;
              return (
                <tr key={product.id}>
                  {isEditing ? (
                    <>
                      <td>
                        <input
                          name="sku"
                          value={editValues.sku}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          name="name"
                          value={editValues.name}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          name="price"
                          type="number"
                          step="0.01"
                          value={editValues.price}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          name="stock"
                          type="number"
                          value={editValues.stock}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          name="unit"
                          value={editValues.unit}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <button onClick={() => saveEdit(product.id)}>
                          บันทึก
                        </button>{" "}
                        <button onClick={cancelEdit}>ยกเลิก</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{product.sku}</td>
                      <td>{product.name}</td>
                      <td>{product.price}</td>
                      <td>{product.stock}</td>
                      <td>{product.unit}</td>
                      <td>
                        <button onClick={() => startEdit(product)}>
                          แก้ไข
                        </button>{" "}
                        <button onClick={() => handleDelete(product.id)}>
                          ลบ
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>
                  ยังไม่มีสินค้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
