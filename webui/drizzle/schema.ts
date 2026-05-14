import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, mediumtext } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const conversions = mysqlTable("conversions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  partNumbers: json("partNumbers").notNull(), // string[]
  options: json("options").notNull(),         // ConversionOptions
  status: mysqlEnum("status", ["pending", "running", "done", "error"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  zipKey: varchar("zipKey", { length: 512 }),  // S3 key for the zip file
  logs: mediumtext("logs"),                    // JSON array of log entries (for polling)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversion = typeof conversions.$inferSelect;
export type InsertConversion = typeof conversions.$inferInsert;
