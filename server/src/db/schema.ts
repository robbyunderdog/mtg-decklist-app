import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  customType,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: citext("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cards = pgTable(
  "cards",
  {
    scryfallId: uuid("scryfall_id").primaryKey(),
    oracleId: uuid("oracle_id").notNull(),
    name: text("name").notNull(),
    setCode: text("set_code").notNull(),
    collectorNumber: text("collector_number").notNull(),
    manaCost: text("mana_cost"),
    typeLine: text("type_line"),
    oracleText: text("oracle_text"),
    colors: text("colors").array(),
    cmc: numeric("cmc"),
    imageNormal: text("image_normal"),
    imageSmall: text("image_small"),
    imageArtCrop: text("image_art_crop"),
    priceUsd: numeric("price_usd"),
    priceUsdFoil: numeric("price_usd_foil"),
    priceEur: numeric("price_eur"),
    priceTix: numeric("price_tix"),
    legalities: jsonb("legalities"),
    scryfallUri: text("scryfall_uri"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cards_name_trgm").using("gin", sql`${table.name} gin_trgm_ops`),
    index("idx_cards_oracle_id").on(table.oracleId),
  ]
);

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    format: text("format"),
    status: text("status").notNull().default("in_progress"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_decks_user_id").on(table.userId),
    check("status_check", sql`${table.status} in ('in_progress','complete','archived')`),
  ]
);

export const deckCards = pgTable(
  "deck_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.scryfallId),
    quantity: integer("quantity").notNull(),
    checkedQuantity: integer("checked_quantity").notNull().default(0),
    board: text("board").notNull().default("main"),
    foil: boolean("foil").notNull().default(false),
  },
  (table) => [
    index("idx_deck_cards_deck_id").on(table.deckId),
    unique("uq_deck_cards_deck_card_board_foil").on(
      table.deckId,
      table.cardId,
      table.board,
      table.foil
    ),
    check("quantity_positive", sql`${table.quantity} > 0`),
    check(
      "checked_quantity_in_range",
      sql`${table.checkedQuantity} >= 0 and ${table.checkedQuantity} <= ${table.quantity}`
    ),
    check("board_check", sql`${table.board} in ('main','side','maybe','commander')`),
  ]
);

