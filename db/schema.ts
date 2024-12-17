import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const servers = pgTable("servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  apiKey: text("api_key").notNull(),
  status: text("status").default("offline").notNull(),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  lastSuccessfulAuthAt: timestamp("last_successful_auth_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const streams = pgTable("streams", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").references(() => servers.id).notNull(),
  name: text("name").notNull(),
  streamKey: text("stream_key").notNull(),
  status: text("status").default("offline").notNull(),
  stats: jsonb("stats").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  streamId: integer("stream_id").references(() => streams.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serverRelations = relations(servers, ({ many }) => ({
  streams: many(streams),
}));

export const streamRelations = relations(streams, ({ one, many }) => ({
  server: one(servers, {
    fields: [streams.serverId],
    references: [servers.id],
  }),
  permissions: many(permissions),
}));

export const userRelations = relations(users, ({ many }) => ({
  permissions: many(permissions),
}));

export const permissionRelations = relations(permissions, ({ one }) => ({
  user: one(users, {
    fields: [permissions.userId],
    references: [users.id],
  }),
  stream: one(streams, {
    fields: [permissions.streamId],
    references: [streams.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const insertServerSchema = createInsertSchema(servers);
export const selectServerSchema = createSelectSchema(servers);
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;

export const insertStreamSchema = createInsertSchema(streams);
export const selectStreamSchema = createSelectSchema(streams);
export type Stream = typeof streams.$inferSelect;
export type NewStream = typeof streams.$inferInsert;

export const insertPermissionSchema = createInsertSchema(permissions);
export const selectPermissionSchema = createSelectSchema(permissions);
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
