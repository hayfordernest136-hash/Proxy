const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "brokeflex_data",
    waitForConnections: true,
    connectionLimit: 2,
  });

  var refillNotes = JSON.stringify({
    full_name: "John Doe",
    email: "customer@example.com",
    contact_number: "233501234567",
    network: "MTN",
    bundle: "MTN 1GB",
    delivery_number: "233501234567",
  });

  var sql1 =
    "INSERT INTO orders (order_number, product_name, plan_name, proxy_type, quantity, unit_price, total_amount, currency, delivery_method, customer_email, customer_name, order_type, refill_notes, status, payment_status, payment_reference, payment_provider, fulfillment_reference, delivery_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
  var params1 = [
    100001,
    "Data Bundle",
    "MTN 1GB",
    "MTN",
    1,
    10.0,
    10.0,
    "GHS",
    "data_bundle",
    "customer@example.com",
    "John Doe",
    "data",
    refillNotes,
    "paid",
    "paid",
    "PAY-REF-001",
    "paystack",
    "REMA-REF-001",
    "pending",
  ];
  var [r1] = await pool.query(sql1, params1);
  var dataOrderId = r1.insertId;
  await pool.query(
    "INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, ?, ?, NOW())",
    [dataOrderId, "paid", "Payment received for data bundle order."],
  );
  await pool.query(
    "INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, ?, ?, NOW())",
    [dataOrderId, "processing", "Order sent to Rema Data API for fulfillment."],
  );
  console.log("Data order created: ID=" + dataOrderId);

  var sql2 =
    "INSERT INTO orders (order_number, product_name, plan_name, proxy_type, quantity, unit_price, total_amount, currency, delivery_method, customer_email, customer_name, order_type, refill_email, refill_password, status, payment_status, payment_reference, payment_provider, delivery_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
  var params2 = [
    100002,
    "Rotating Residential Proxy",
    "Starter",
    "Residential",
    1,
    14.99,
    14.99,
    "GHS",
    "email",
    "proxy@example.com",
    "Jane Smith",
    "proxy",
    "proxy@example.com",
    "proxy-pw-123",
    "paid",
    "paid",
    "PAY-REF-002",
    "paystack",
    "pending",
  ];
  var [r2] = await pool.query(sql2, params2);
  var proxyOrderId = r2.insertId;
  await pool.query(
    "INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, ?, ?, NOW())",
    [proxyOrderId, "paid", "Payment received for proxy order."],
  );
  await pool.query(
    "INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, ?, ?, NOW())",
    [proxyOrderId, "processing", "Proxy order is being processed."],
  );
  console.log("Proxy order created: ID=" + proxyOrderId);

  await pool.end();
  console.log("Done! Test orders created successfully.");
}

main().catch(console.error);
