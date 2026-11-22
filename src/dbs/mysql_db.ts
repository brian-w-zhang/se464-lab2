import { Product } from "../compiled_proto/app";
import { IDatabase } from "../interfaces";
import { Category, Order, User, UserPatchRequest } from "../types";
import mysql from "mysql2/promise";
import logger from "../logger";

export default class MySqlDB implements IDatabase {
  connection: mysql.Connection;

  async init() {
    this.connection = await mysql.createConnection({
      host: process.env.RDS_HOSTNAME,
      user: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      port: parseInt(process.env.RDS_PORT), // Convert port to a number
      database: process.env.RDS_DATABASE,
    });
    logger.info("MySQL connected!", { component: "Database" });
  }

  constructor() {
    this.init();
  }

  async queryProductById(productId) {
    return (await this.connection.query(`SELECT *
                                FROM products
                                WHERE id = "${productId}";`))[0][0] as Product;
  };

  async queryRandomProduct() {
    // let MySQL shuffle the table and return a single row
    return (
      await this.connection.query("SELECT * FROM products ORDER BY RAND() LIMIT 1;")
    )[0][0] as Product;
  };

  queryAllProducts = async (category?: string) => {
    // gRPC sends an unset category as undefined or "", so only filter on a real value
    if (category) {
      return (
        await this.connection.query("SELECT * FROM products WHERE categoryId = ?;", [category])
      )[0] as Product[];
    }
    return (await this.connection.query("SELECT * FROM products;"))[0] as Product[];
  };

  // Orders are split across `orders` and `order_items` in SQL, so join them and
  // rebuild each order's `products` list to match the shape stored in DynamoDB.
  // Item ids are numeric strings ("0", "1", ..., "10"), so sort by length then
  // value to keep each order's products in their original insertion order.
  private queryOrdersWithProducts = async (where = "", params: string[] = []) => {
    const [rows] = await this.connection.query(
      `SELECT o.id, o.userId, o.totalAmount, oi.productId, oi.quantity
       FROM orders o
       LEFT JOIN order_items oi ON oi.orderId = o.id
       ${where}
       ORDER BY LENGTH(oi.id), oi.id;`,
      params,
    );

    const orders = new Map<string, Order>();
    for (const row of rows as any[]) {
      if (!orders.has(row.id)) {
        orders.set(row.id, { id: row.id, userId: row.userId, totalAmount: row.totalAmount, products: [] });
      }
      if (row.productId !== null) {
        orders.get(row.id).products.push({ productId: row.productId, quantity: row.quantity });
      }
    }
    return [...orders.values()];
  };

  queryAllCategories = async () => {
    return (await this.connection.query("SELECT * FROM categories;"))[0] as Category[];
  };

  queryAllOrders = async () => {
    return await this.queryOrdersWithProducts();
  };

  async queryOrdersByUser(id: string) {
    return await this.queryOrdersWithProducts("WHERE o.userId = ?", [id]);
  };

  queryOrderById = async (id: string) => {
    return (await this.queryOrdersWithProducts("WHERE o.id = ?", [id]))[0];
  };

  queryUserById = async (id: string) => {
    return (
      await this.connection.query(`SELECT id, email, name
                             FROM users
                             WHERE id = "${id}";`)
    )[0][0];
  };

  queryAllUsers = async () => {
    return (await this.connection.query("SELECT id, name, email FROM users"))[0] as User[];
  };

  insertOrder = async (order: Order) => {
    // the order row must exist first because order_items has a foreign key to it
    await this.connection.query(
      "INSERT INTO orders (id, userId, totalAmount) VALUES (?, ?, ?);",
      [order.id, order.userId, order.totalAmount],
    );

    // one row per product, inserted in a single statement; the ":<index>" suffix keeps ids unique
    // and preserves product order when sorted by queryOrdersWithProducts
    const items = (order.products ?? []).map((p, i) => [`${order.id}:${i}`, order.id, p.productId, p.quantity]);
    if (items.length > 0) {
      await this.connection.query(
        "INSERT INTO order_items (id, orderId, productId, quantity) VALUES ?;",
        [items],
      );
    }
  };

  updateUser = async (patch: UserPatchRequest) => {
    // gRPC (proto3) sends unset string fields as "", so only update fields that have a value
    const updates: string[] = [];
    const values: string[] = [];
    if (patch.email) {
      updates.push("email = ?");
      values.push(patch.email);
    }
    if (patch.password) {
      updates.push("password = ?");
      values.push(patch.password);
    }

    // no updates
    if (updates.length === 0) {
      return;
    }

    await this.connection.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?;`, [...values, patch.id]);
  };
};